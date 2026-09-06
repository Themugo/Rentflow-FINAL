import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv } from "../_shared/env.ts";
// This function returns structured JSON data that the frontend
// uses to generate PDFs client-side with jsPDF + autoTable.
// Heavy PDF generation happens client-side to avoid timeout limits.
serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  try {
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // ── Caller authentication ─────────────────────────────────────────
    // Previously unauthenticated — any authenticated (or in some Supabase
    // setups, unauthenticated) caller could pull full financial documents
    // (receipts, invoices, tenant statements, property statements) for
    // any managerId/tenantId/propertyId on the platform. This is a data
    // leak (rent amounts, payment history, contact details) even though
    // it doesn't write anything.
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { data: roleRow } = await supabase.from("user_roles")
      .select("role, tenant_id").eq("user_id", caller.id).maybeSingle();
    const callerRole = (roleRow as any)?.role;
    // tenants.id is its own gen_random_uuid(), never equal to the auth user
    // id — the auth<->tenant link lives in user_roles.tenant_id (same
    // pattern as get-payment-history / initiate-mpesa-stk-push). Comparing
    // tenantId to caller.id directly always failed, so a real tenant could
    // never pull their own statement through this path.
    const callerTenantId = (roleRow as any)?.tenant_id;

    let effectiveManagerId = caller.id;
    if (callerRole === "submanager") {
      const { data: rel } = await supabase.from("manager_submanagers")
        .select("manager_id").eq("submanager_user_id", caller.id).maybeSingle();
      effectiveManagerId = (rel as any)?.manager_id ?? caller.id;
    }

    const { type, id, managerId, month, tenantId, propertyId } = await req.json();

    // Authorize based on the resource being requested, per type.
    const forbidden = () => new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

    if (callerRole === "tenant") {
      // Tenants may only pull their own statement, identified via
      // user_roles.tenant_id (never the auth user id — see above).
      if (type !== "statement" || !callerTenantId || tenantId !== callerTenantId) return forbidden();
    } else if (["manager", "submanager"].includes(callerRole)) {
      if (type === "statement" || type === "receipt" || type === "invoice") {
        if (tenantId) {
          const { data: tenantRow } = await supabase.from("tenants").select("manager_id").eq("id", tenantId).maybeSingle();
          if (!tenantRow || (tenantRow as any).manager_id !== effectiveManagerId) return forbidden();
        } else if (managerId && managerId !== effectiveManagerId) {
          return forbidden();
        }
      }
      if (type === "property_statement" && propertyId) {
        const { data: propRow } = await supabase.from("properties").select("manager_id").eq("id", propertyId).maybeSingle();
        if (!propRow || (propRow as any).manager_id !== effectiveManagerId) return forbidden();
      }
    } else if (callerRole !== "webhost") {
      return forbidden();
    }

    let data: any = {};

    switch (type) {
      case "receipt": {
        const { data: payment } = await supabase
          .from("payments")
          .select("*, invoices(invoice_number, due_date, amount, tenants(name, email, phone, unit, property))")
          .eq("id", id)
          .single();
        // The `id` here is an unrelated document id supplied by the client —
        // the earlier ownership check only validated tenantId/managerId, so
        // without this the caller could pass their own tenant/manager and an
        // arbitrary payment id belonging to a different org. Re-check here.
        if (!payment) return forbidden();
        if (callerRole !== "webhost" && (payment as any).manager_id !== effectiveManagerId) {
          return forbidden();
        }
        const { data: settings } = await supabase
          .from("company_settings")
          .select("company_name, address, phone, email, logo_url")
          .eq("manager_user_id", managerId)
          .maybeSingle();
        data = { type: "receipt", payment, settings };
        break;
      }
      case "invoice": {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("*, tenants(name, email, phone, unit, property), other_charges(*)")
          .eq("id", id)
          .single();
        // Same IDOR guard as "receipt" above: verify the fetched invoice
        // actually belongs to the caller's (effective) manager before
        // returning it, since `id` is not otherwise scoped.
        if (!invoice) return forbidden();
        if (callerRole !== "webhost" && (invoice as any).manager_id !== effectiveManagerId) {
          return forbidden();
        }
        const { data: settings } = await supabase
          .from("company_settings")
          .select("company_name, address, phone, email, logo_url")
          .eq("manager_user_id", managerId)
          .maybeSingle();
        data = { type: "invoice", invoice, settings };
        break;
      }
      case "statement": {
        const { data: invoices } = await supabase
          .from("invoices")
          .select("*, payments(*)")
          .eq("tenant_id", tenantId)
          .order("due_date", { ascending: false });
        const { data: tenant } = await supabase
          .from("tenants")
          .select("name, email, phone, unit, property")
          .eq("id", tenantId)
          .single();
        const { data: settings } = await supabase
          .from("company_settings")
          .select("company_name, address, phone, email, logo_url")
          .eq("manager_user_id", managerId)
          .maybeSingle();
        data = { type: "statement", invoices, tenant, settings };
        break;
      }
      case "property_statement": {
        const { data: property } = await supabase
          .from("properties")
          .select("name, address")
          .eq("id", propertyId)
          .single();
        const { data: invoices } = await supabase
          .from("invoices")
          .select("amount, status, paid_date, tenants(name, unit)")
          .eq("property_id", propertyId)
          .gte("due_date", `${month}-01`)
          .lte("due_date", `${month}-31`);
        data = { type: "property_statement", property, invoices, month };
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Unknown export type" }), {
          status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
