import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { resolveEffectiveManagerIds } from "../_shared/notifyAuthz.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Authentication ─────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceCall = authHeader === `Bearer ${SERVICE_KEY}`;

  let callerUserId: string | null = null;

  if (!isServiceCall) {
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    const { data: roleRow } = await supabase.from("user_roles")
      .select("role").eq("user_id", caller.id).maybeSingle();
    if (!["webhost", "manager", "submanager"].includes((roleRow as any)?.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: only managers may export data" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    callerUserId = caller.id;

    const allowed = await checkRateLimit(
      supabase, caller.id, "export-excel", 5,
      { failClosed: true },
    );
    if (!allowed) return rateLimitResponse(req);
  }

  try {
    const { type, managerId, month, propertyId } = await req.json();

    if (!type || !managerId) {
      return new Response(JSON.stringify({ error: "type and managerId are required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ── Authorization: callers can only export data for their own manager ──
    // (user_roles has no manager_id column — comparing against it always
    // compared undefined to managerId and silently denied every manager,
    // not just unauthorized ones. Resolve the caller's effective manager
    // portfolio instead, same helper used elsewhere for this exact check.)
    if (!isServiceCall && callerUserId) {
      const { data: callerRole } = await supabase.from("user_roles")
        .select("role").eq("user_id", callerUserId).maybeSingle();
      if ((callerRole as any)?.role !== "webhost") {
        const effectiveManagerIds = await resolveEffectiveManagerIds(supabase, callerUserId, (callerRole as any)?.role ?? "manager");
        if (!effectiveManagerIds.has(managerId)) {
          return new Response(JSON.stringify({ error: "Forbidden: you can only export data for your own organization" }),
            { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
        }
      }
    }

    let rows: any[] = [];
    let headers: string[] = [];

    if (type === "payments") {
      headers = ["Invoice #", "Tenant", "Unit", "Amount", "Method", "Reference", "Date"];
      const { data } = await supabase
        .from("payments")
        .select("*, invoices(invoice_number, tenants(name, unit))")
        .eq("manager_id", managerId)
        .order("paid_at", { ascending: false });
      rows = (data || []).map((p: any) => [
        p.invoices?.invoice_number || "",
        p.invoices?.tenants?.name || "",
        p.invoices?.tenants?.unit || "",
        Number(p.amount),
        p.method || "",
        p.reference || "",
        p.paid_at?.slice(0, 10) || "",
      ]);
    } else if (type === "invoices") {
      headers = ["Invoice #", "Tenant", "Unit", "Amount", "Due Date", "Paid Date", "Status"];
      const { data } = await supabase
        .from("invoices")
        .select("*, tenants(name, unit)")
        .eq("manager_id", managerId)
        .order("due_date", { ascending: false });
      rows = (data || []).map((i: any) => [
        i.invoice_number || "",
        i.tenants?.name || "",
        i.tenants?.unit || "",
        Number(i.amount),
        i.due_date || "",
        i.paid_date || "",
        i.status || "",
      ]);
    } else if (type === "tenants") {
      headers = ["Name", "Email", "Phone", "Property", "Unit", "Move-in", "Deposit", "Status"];
      const { data } = await supabase
        .from("tenants")
        .select("*")
        .eq("manager_id", managerId);
      rows = (data || []).map((t: any) => [
        t.name, t.email, t.phone || "", t.property || "", t.unit || "",
        t.move_in_date || "", Number(t.deposit || 0), t.status,
      ]);
    } else {
      return new Response(JSON.stringify({ error: `Unknown export type: ${type}` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const csv = [headers, ...rows]
      .map((row) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return new Response(JSON.stringify({ csv, headers, rows, type }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
