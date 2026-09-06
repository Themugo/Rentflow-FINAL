import { requireEnv, getEnv } from "../_shared/env.ts";
/**
 * bootstrap-webhost/index.ts
 *
 * ONE-TIME USE: Creates the first webhost administrator account and seeds platform_admins.
 * Can only be called when ZERO webhost accounts exist on the platform.
 * Once a webhost exists, this function permanently refuses to run.
 *
 * REQUIREMENT: The migration 20260530000000_platform_admin_hierarchy.sql
 * must have been applied BEFORE calling this function (creates platform_admins table).
 *
 * Call via Supabase Dashboard → Edge Functions → Test, or:
 *   curl -X POST https://<project-ref>.supabase.co/functions/v1/bootstrap-webhost \
 *     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"admin@yourplatform.com","password":"StrongPassword123!","fullName":"Platform Admin","bootstrapSecret":"your-secret"}'
 *
 * BOOTSTRAP_SECRET env var must be set in Supabase before calling.
 * After calling: delete or disable this function — it's not needed again.
 */
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const envName = (getEnv("ENVIRONMENT") || getEnv("NODE_ENV") || "").toLowerCase();
  const allowBootstrap = envName === "development" || envName === "dev" || envName === "local";
  if (!allowBootstrap) {
    return Response.json(
      { error: "bootstrap-webhost is disabled outside local development." },
      { status: 403, headers: getCorsHeaders(req) },
    );
  }

  const SUPABASE_URL = requireEnv("SUPABASE_URL");
  const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const BOOTSTRAP_SECRET = getEnv("BOOTSTRAP_SECRET");

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return Response.json(
      { error: "Unauthorized: service role authentication is required." },
      { status: 401, headers: getCorsHeaders(req) },
    );
  }

  try {
    const { email, password, fullName, bootstrapSecret } = await req.json();

    // ── 1. Validate bootstrap secret ──────────────────────────────────
    if (!BOOTSTRAP_SECRET) {
      return Response.json(
        { error: "BOOTSTRAP_SECRET env var not set. Set it in Supabase Edge Function secrets first." },
        { status: 500, headers: getCorsHeaders(req) }
      );
    }
    if (bootstrapSecret !== BOOTSTRAP_SECRET) {
      return Response.json({ error: "Invalid bootstrap secret" }, { status: 403, headers: getCorsHeaders(req) });
    }

    // ── 2. Validate inputs ─────────────────────────────────────────────
    if (!email || !password || !fullName) {
      return Response.json({ error: "email, password, and fullName are required" }, { status: 400, headers: getCorsHeaders(req) });
    }
    if (password.length < 10) {
      return Response.json({ error: "Password must be at least 10 characters for the platform admin" }, { status: 400, headers: getCorsHeaders(req) });
    }

    // ── 3. GUARD: refuse if any webhost already exists ─────────────────
    const { count: existingWebhosts } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "webhost");

    if ((existingWebhosts ?? 0) > 0) {
      return Response.json(
        { error: "Bootstrap refused: a webhost admin already exists. This function can only run once." },
        { status: 409, headers: getCorsHeaders(req) }
      );
    }

    // ── 4. Create auth user ────────────────────────────────────────────
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email:          email.toLowerCase().trim(),
      password,
      email_confirm:  true,
      user_metadata:  { full_name: fullName },
    });
    if (authError) throw authError;
    const userId = authData.user.id;

    // ── 5. Create profile ──────────────────────────────────────────────
    await supabase.from("profiles").upsert({
      id:        userId,
      full_name: fullName,
      email:     email.toLowerCase().trim(),
    });

    // ── 6. Create webhost role (super_admin) ───────────────────────────
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id:         userId,
      role:            "webhost",
      approval_status: "approved",
    });
    if (roleError) throw roleError;

    // ── 7. Create admin_permissions row ───────────────────────────────
    await supabase.from("admin_permissions").upsert({
      user_id:     userId,
      admin_level: "super_admin",
    }, { onConflict: "user_id" });

    // ── 8. Seed platform_admins (owner tier) ───────────────────────────
    // Requires migration 20260530000000 to be applied first.
    const { error: paError } = await supabase.from("platform_admins").upsert({
      user_id: userId,
      admin_type: "owner",
      display_name: fullName,
      email: email.toLowerCase().trim(),
      can_create_admins: true,
      can_manage_managers: true,
      can_manage_billing: true,
      can_manage_properties: true,
      can_manage_landlords: true,
      can_view_activity_logs: true,
      can_manage_platform_settings: true,
      is_immutable: true,
      created_by: userId,
    }, { onConflict: "user_id" });
    if (paError) {
      // Non-fatal: log but don't abort — bootstrap succeeded already
      console.warn("[BOOTSTRAP] platform_admins insert failed (table may not exist yet):", paError.message);
    }

    // ── 9. Log in security audit ───────────────────────────────────────
    await supabase.from("security_audit_log").insert({
      user_id:       userId,
      event_type:    "bootstrap_webhost_created",
      resource_type: "user_roles",
      resource_id:   userId,
      details:       { email, full_name: fullName, admin_level: "super_admin" },
      severity:      "critical",
    });

    return Response.json({
      success:  true,
      userId,
      email:    email.toLowerCase().trim(),
      message:  "Webhost admin + platform owner created. Log in at /webhost/login. IMPORTANT: delete or disable this edge function now — it is no longer needed.",
      loginUrl: "/webhost/login",
    }, { headers: getCorsHeaders(req) });

  } catch (err: any) {
    console.error("[BOOTSTRAP] Error:", err);
    return Response.json({ error: err.message }, { status: 500, headers: getCorsHeaders(req) });
  }
});
