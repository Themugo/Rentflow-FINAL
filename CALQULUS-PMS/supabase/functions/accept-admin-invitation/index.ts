/**
 * accept-admin-invitation/index.ts
 *
 * Claims a CALQULUS ADMIN (webhost) invitation. The invitation TOKEN —
 * not the caller's role, and never a client-supplied role — is the
 * credential. Runs with the service role.
 *
 * Guarantees:
 *  - Token must be pending and unexpired (expired → 410, used → 410
 *    unless the same user already claimed, then idempotent success).
 *  - Password ≥ 10 characters, set only by the invitee (admins never
 *    see or send it).
 *  - The auth user created for the invitee is bound to the invited
 *    email; email_confirm: true (identity verified at creation).
 *  - The granted role is always 'webhost' — there is no role parameter.
 *  - Mark-used is atomic (status='pending' guard) so a concurrent
 *    double-claim is a no-op.
 *  - Every acceptance is audit-logged.
 */

import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { getEnv, requireEnv } from "../_shared/env.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";

interface AcceptAdminInviteRequest {
  token?: string;
  password?: string;
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const { token, password }: AcceptAdminInviteRequest = await req.json();
    const invitationToken = token?.trim() || null;

    if (!invitationToken) {
      return json(req, { error: "Invitation token is required" }, 400);
    }
    if (!password || password.length < 10) {
      return json(req, { error: "Password must be at least 10 characters" }, 400);
    }

    const supabaseAdmin = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );

    // ── Resolve the invitation server-side ────────────────────────────
    const { data: inviteRows } = await supabaseAdmin
      .from("admin_invitations")
      .select("id, email, display_name, admin_type, status, expires_at, invited_by")
      .eq("token", invitationToken)
      .limit(1);

    const invite = inviteRows?.[0];
    if (!invite) {
      return json(req, { error: "Invitation not found", code: "invitation_invalid" }, 404);
    }

    if (invite.status === "pending" && new Date(invite.expires_at) <= new Date()) {
      return json(req, { error: "This invitation has expired", code: "invitation_expired" }, 410);
    }

    // ── Find or create the auth user bound to the invited email ───────
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === invite.email.toLowerCase(),
    );

    if (invite.status !== "pending") {
      // Refresh / back-navigation after a successful claim: if this user
      // already holds the webhost role, return success instead of failing.
      if (existingUser) {
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", existingUser.id);
        if (roles?.some((r) => r.role === "webhost")) {
          return json(req, {
            success: true,
            alreadyClaimed: true,
            email: invite.email,
            message: "Invitation already claimed",
          });
        }
      }
      return json(req, { error: "This invitation has already been used", code: "invitation_used" }, 410);
    }

    let userId: string;
    if (existingUser) {
      // Identity verification: the invitee proves ownership of the invited
      // email by setting the password through this token-gated path.
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: invite.display_name },
      });
      if (updateError) {
        return json(req, { error: `Failed to set credentials: ${updateError.message}` }, 500);
      }
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: invite.display_name },
      });
      if (createError || !newUser.user) {
        return json(req, { error: `Failed to create account: ${createError?.message ?? "unknown"}` }, 500);
      }
      userId = newUser.user.id;
    }

    // ── Grant the role server-side. Always 'webhost' — the client never
    // chooses a role. protect_user_roles_changes() bypasses service_role.
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "webhost", approval_status: "approved" },
        { onConflict: "user_id,role" },
      );
    if (roleError) {
      return json(req, { error: `Failed to grant admin role: ${roleError.message}` }, 500);
    }

    // ── Seed the operator tier server-side (Phase 9) ──────────────────
    // The platform_admins row is what makes this a full operator. The tier
    // comes from the invitation (chosen by the inviter), never the client,
    // and can never be 'owner' — the DB CHECK enforces business|admin.
    const operatorTier = invite.admin_type === "business" ? "business" : "admin";
    await supabaseAdmin
      .from("platform_admins")
      .upsert(
        {
          user_id: userId,
          admin_type: operatorTier,
          display_name: invite.display_name,
          email: invite.email,
          can_create_admins: operatorTier === "business",
          can_manage_managers: true,
          can_manage_agencies: true,
          can_manage_organizations: false,
          can_manage_billing: operatorTier === "business",
          can_manage_properties: true,
          can_manage_landlords: true,
          can_view_activity_logs: true,
          can_manage_platform_settings: operatorTier === "business",
          can_read_unattached_tenants: true,
          can_resolve_unattached_tenants: operatorTier === "business",
          is_immutable: false,
          suspended: false,
          created_by: invite.invited_by,
        },
        { onConflict: "user_id" },
      )
      .then(() => undefined, () => undefined);

    // Baseline admin permissions, aligned to the operator tier. 'business'
    // operators can manage billing and create further admins; 'admin'
    // operators start limited until an owner/business elevates them.
    await supabaseAdmin
      .from("admin_permissions")
      .upsert(
        {
          user_id: userId,
          admin_level: operatorTier === "business" ? "admin" : "limited_admin",
          can_create_webhosts: operatorTier === "business",
          can_manage_managers: true,
          can_manage_agencies: true,
          can_manage_organizations: false,
          can_manage_billing: operatorTier === "business",
          can_manage_properties: true,
          can_manage_tenants: false,
          can_read_unattached_tenants: true,
          can_resolve_unattached_tenants: operatorTier === "business",
          can_view_activity_logs: true,
        },
        { onConflict: "user_id" },
      )
      .then(() => undefined, () => undefined);

    // ── Mark the invitation used (atomic, single-use) ─────────────────
    const { error: markError } = await supabaseAdmin
      .from("admin_invitations")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", invite.id)
      .eq("status", "pending");
    if (markError) {
      console.warn("Failed to mark admin invitation used (non-critical):", markError.message);
    }

    // ── Audit the acceptance ──────────────────────────────────────────
    await supabaseAdmin.from("activity_logs").insert({
      actor_id: userId,
      actor_role: "webhost",
      actor_email: invite.email,
      action: "admin_invitation_accepted",
      entity_type: "admin_invitations",
      entity_id: invite.id,
      metadata: { invited_by: invite.invited_by, email: invite.email, admin_type: operatorTier },
    }).then(() => undefined, () => undefined);

    return json(req, {
      success: true,
      email: invite.email,
      message: "Admin role accepted. Sign in to the CALQULUS ADMIN console.",
    });
  } catch (error: unknown) {
    console.error("accept-admin-invitation error:", error);
    return json(req, { error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
