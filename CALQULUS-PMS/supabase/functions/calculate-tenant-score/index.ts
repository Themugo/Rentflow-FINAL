import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

import { requireEnv } from "../_shared/env.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  try {
    // ── Caller authentication ─────────────────────────────────────────
    // Previously unauthenticated — this read a tenant's entire payment
    // history (a data leak on its own) and wrote credit_score for any
    // tenantId supplied. Only the tenant themselves, their manager, or
    // a webhost admin may trigger a recalculation.
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
    if (!["tenant", "manager", "submanager", "webhost"].includes(callerRole)) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    // tenants.id is its own gen_random_uuid(), never equal to the auth user
    // id — the link lives in user_roles.tenant_id (same pattern as
    // export-pdf / verify-mpesa-payment / create-invoice-checkout).
    // Comparing tenantId to caller.id directly always failed, so a real
    // tenant could never trigger their own score recalculation.
    const callerTenantId: string | null = (roleRow as any)?.tenant_id ?? null;

    const allowed = await checkRateLimit(supabase, caller.id, "calculate-tenant-score", 30, { failClosed: true });
    if (!allowed) return rateLimitResponse(req);

    const { tenantId } = await req.json();

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenantId is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (callerRole === "tenant" && (!callerTenantId || tenantId !== callerTenantId)) {
      return new Response(JSON.stringify({ error: "Forbidden: you can only view your own score" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    if (["manager", "submanager"].includes(callerRole)) {
      let effectiveManagerId = caller.id;
      if (callerRole === "submanager") {
        const { data: rel } = await supabase.from("manager_submanagers")
          .select("manager_id").eq("submanager_user_id", caller.id).maybeSingle();
        effectiveManagerId = (rel as any)?.manager_id ?? caller.id;
      }
      const { data: tenantOwner } = await supabase.from("tenants").select("manager_id").eq("id", tenantId).maybeSingle();
      if (!tenantOwner || (tenantOwner as any).manager_id !== effectiveManagerId) {
        return new Response(JSON.stringify({ error: "Forbidden: tenant is not in your managed portfolio" }), {
          status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    // Fetch payment history
    const { data: payments } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("tenant_id", tenantId);

    if (!payments || payments.length === 0) {
      return new Response(JSON.stringify({ score: 0 }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const total = payments.length;
    let onTime = 0;
    let late = 0;
    let missed = 0;

    for (const p of payments) {
      if (p.status === "paid") {
        if (new Date(p.created_at) <= new Date(p.due_date)) onTime++;
        else late++;
      } else {
        missed++;
      }
    }

    // Scoring logic
    let score =
      (onTime / total) * 70 +
      ((total - missed) / total) * 20 +
      (1 - late / total) * 10;

    score = Math.round(score);

    // Update tenant — requires tenants.credit_score column
    await supabase
      .from("tenants")
      .update({ credit_score: score })
      .eq("id", tenantId);

    return new Response(JSON.stringify({ score }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
