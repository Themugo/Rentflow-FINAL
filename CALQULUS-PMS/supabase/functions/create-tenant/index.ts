import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

import { requireEnv } from "../_shared/env.ts";
serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  try {
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // ── Caller authentication ─────────────────────────────────────────
    // Previously unauthenticated — anyone could create a tenant record
    // against any property/unit belonging to any manager, silently
    // marking that unit "occupied" and corrupting that manager's
    // occupancy stats. Only a manager/submanager/webhost may create
    // tenants, and only inside a property they actually manage.
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { data: roleRow } = await supabase.from("user_roles")
      .select("role").eq("user_id", caller.id).maybeSingle();
    const callerRole = (roleRow as any)?.role;
    if (!["manager", "submanager", "webhost"].includes(callerRole)) {
      return new Response(JSON.stringify({ error: "Forbidden: only managers or platform admins may create tenants" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const allowed = await checkRateLimit(supabase, caller.id, "create-tenant", 60, { failClosed: true });
    if (!allowed) return rateLimitResponse(req);

    const { name, email, phone, unit, property, propertyId, unitId, moveInDate, deposit } = await req.json();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: "name and email are required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let effectiveManagerId = caller.id;
    if (callerRole === "submanager") {
      const { data: rel } = await supabase.from("manager_submanagers")
        .select("manager_id").eq("submanager_user_id", caller.id).maybeSingle();
      effectiveManagerId = (rel as any)?.manager_id ?? caller.id;
    }

    // Validate the property/unit relationship together. Never trust a caller
    // supplied propertyId or unitId independently: otherwise an authenticated
    // manager could attach a tenant to another manager's unit.
    if (callerRole !== "webhost") {
      if (!propertyId && !unitId) {
        return new Response(JSON.stringify({ error: "A managed property or unit is required" }), {
          status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      if (propertyId) {
        const { data: prop } = await supabase.from("properties").select("manager_id").eq("id", propertyId).maybeSingle();
        if (!prop || (prop as any).manager_id !== effectiveManagerId) {
          return new Response(JSON.stringify({ error: "Forbidden: property is not in your managed portfolio" }), {
            status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
      }

      if (unitId) {
        const { data: unit } = await supabase.from("units").select("property_id, properties!inner(manager_id)").eq("id", unitId).maybeSingle();
        const unitPropertyId = (unit as any)?.property_id;
        const unitManagerId = (unit as any)?.properties?.manager_id;
        if (!unit || unitManagerId !== effectiveManagerId || (propertyId && unitPropertyId !== propertyId)) {
          return new Response(JSON.stringify({ error: "Forbidden: unit is not in your managed property" }), {
            status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
      }
    }

    // Create the tenant record
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        unit: unit || null,
        property: property || null,
        property_id: propertyId || null,
        unit_id: unitId || null,
        manager_id: callerRole === "webhost" ? (effectiveManagerId || null) : effectiveManagerId,
        move_in_date: moveInDate || null,
        deposit: deposit || 0,
        status: "active",
      })
      .select()
      .single();

    if (tenantError) throw tenantError;

    // Mark unit as occupied if unitId provided
    if (unitId) {
      await supabase
        .from("units")
        .update({ status: "occupied", tenant_id: tenant.id })
        .eq("id", unitId);
      // Update property occupied count
      const { data: unitData } = await supabase
        .from("units")
        .select("property_id")
        .eq("id", unitId)
        .single();
      if (unitData?.property_id) {
        const { count } = await supabase
          .from("units")
          .select("id", { count: "exact", head: true })
          .eq("property_id", unitData.property_id)
          .eq("status", "occupied");
        await supabase
          .from("properties")
          .update({ occupied: count || 0 })
          .eq("id", unitData.property_id);
      }
    }

    // Send welcome email
    await supabase.functions.invoke("send-welcome-email", {
      body: { tenantId: tenant.id },
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, tenant }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
