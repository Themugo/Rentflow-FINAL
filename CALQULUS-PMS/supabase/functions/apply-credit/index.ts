/**
 * apply-credit/index.ts
 * Atomic tenant credit application. Financial writes live in the database RPC.
 */
import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { authenticateUser } from "../_shared/auth.ts";
import { checkRoleAccess } from "../_shared/authorization.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };
  try {
    const body = await req.json();
    const tenantId = String(body.tenant_id ?? "");
    if (!tenantId) return new Response(JSON.stringify({ error: "tenant_id is required" }), { status: 400, headers });

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";
    const isServiceCall = authHeader === `Bearer ${serviceKey}`;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let managerId: string | null = body.manager_id ? String(body.manager_id) : null;
    let recordedBy: string | null = null;
    if (!isServiceCall) {
      const caller = await authenticateUser(req);
      if (!caller.success) return caller.response;
      const access = await checkRoleAccess(caller.user.id, ["manager", "submanager"]);
      if (!access.allowed) return new Response(JSON.stringify({ error: access.error ?? "Forbidden" }), { status: 403, headers });
      recordedBy = caller.user.id;
      const { data: tenant, error } = await admin.from("tenants").select("manager_id").eq("id", tenantId).maybeSingle();
      if (error || !tenant?.manager_id) return new Response(JSON.stringify({ error: "Tenant not found" }), { status: 404, headers });
      managerId = tenant.manager_id;

      // checkRoleAccess above only confirms the caller HAS a manager/submanager
      // role somewhere on the platform — it does not confirm they own THIS
      // tenant's manager relationship. Because the RPC below runs on the
      // service-role client (auth.role() = 'service_role'), its own internal
      // ownership check is skipped, so this is the only place ownership is
      // actually enforced. Without it, any manager/submanager could apply
      // credit against another organization's tenant.
      const isOwningManager = caller.user.id === managerId;
      let isAuthorizedSubmanager = false;
      if (!isOwningManager) {
        const { data: rel } = await admin
          .from("manager_submanagers")
          .select("manager_id")
          .eq("submanager_user_id", caller.user.id)
          .eq("manager_id", managerId)
          .maybeSingle();
        isAuthorizedSubmanager = !!rel;
      }
      if (!isOwningManager && !isAuthorizedSubmanager) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
      }
    }

    const { data, error } = await admin.rpc("apply_tenant_credit_atomic", {
      p_tenant_id: tenantId,
      p_manager_id: managerId,
      p_recorded_by: recordedBy,
    });
    if (error) {
      console.error("[apply-credit] atomic RPC failed:", error.message);
      return new Response(JSON.stringify({ error: "Credit could not be applied atomically. Please retry." }), { status: 400, headers });
    }
    return new Response(JSON.stringify(data), { status: 200, headers });
  } catch (error) {
    console.error("[apply-credit] error:", error);
    return new Response(JSON.stringify({ error: "Unable to apply credit" }), { status: 400, headers });
  }
});
