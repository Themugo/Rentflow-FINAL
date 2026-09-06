/**
 * send-admin-invitation/index.ts
 *
 * Issues a CALQULUS ADMIN (webhost) invitation. Webhost-only — the
 * middleware enforces the caller's role server-side. Creates the
 * admin_invitations row (secure token, 72h expiry, single-use) and
 * emails the acceptance link. Every issuance is audit-logged.
 *
 * There is NO public admin registration; this is the only way an
 * admin account is created (besides the one-time dev bootstrap).
 */

import { serve } from "std/http/server.ts";
import { getEnv } from "../_shared/env.ts";
import { withMiddleware, errorResponse } from "../_shared/middleware.ts";

const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface SendAdminInviteRequest {
  email?: string;
  displayName?: string;
  adminType?: string;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(
  withMiddleware(
    {
      functionName: "send-admin-invitation",
      allowedRoles: ["webhost"],
      rateLimit: { maxPerHour: 10, failClosed: false },
    },
    async (req, ctx) => {
      const { email, displayName, adminType }: SendAdminInviteRequest = await req.json();

      if (!email || !displayName?.trim()) {
        throw errorResponse("email and displayName are required", 400);
      }

      // Operator tier is chosen by the inviter at issuance. 'owner' can
      // never be granted through an invitation — there is exactly one owner.
      const tier = adminType === "business" ? "business" : "admin";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw errorResponse("Invalid email address", 400);
      }

      // Authorization hardening: only admins who may create admins
      // (platform owner/business, or super_admin permission level).
      const { data: platformAdmin } = await ctx.supabase
        .from("platform_admins")
        .select("admin_type, can_create_admins, suspended")
        .eq("user_id", ctx.user!.id)
        .maybeSingle();
      const { data: permissions } = await ctx.supabase
        .from("admin_permissions")
        .select("admin_level, can_create_webhosts")
        .eq("user_id", ctx.user!.id)
        .maybeSingle();

      const mayCreate =
        (platformAdmin && !platformAdmin.suspended &&
          (platformAdmin.admin_type === "owner" || platformAdmin.admin_type === "business" || platformAdmin.can_create_admins)) ||
        (permissions && (permissions.admin_level === "super_admin" || permissions.can_create_webhosts));

      if (!mayCreate) {
        throw errorResponse("Insufficient permissions to invite administrators", 403);
      }

      // Never invite an email that already holds a webhost role.
      const { data: existingUsers } = await ctx.supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        const { data: roles } = await ctx.supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", existing.id);
        if (roles?.some((r) => r.role === "webhost")) {
          throw errorResponse("This email already has administrator access", 409);
        }
      }

      // Supersede any still-pending invitation for this email.
      await ctx.supabase
        .from("admin_invitations")
        .update({ status: "revoked" })
        .eq("email", email.toLowerCase())
        .eq("status", "pending");

      const { data: invitation, error: insertError } = await ctx.supabase
        .from("admin_invitations")
        .insert({
          email: email.toLowerCase(),
          display_name: displayName.trim(),
          admin_type: tier,
          invited_by: ctx.user!.id,
        })
        .select("id, token, expires_at")
        .single();

      if (insertError || !invitation) {
        throw errorResponse("Failed to create invitation", 500);
      }

      const appUrl = getEnv("SITE_URL", "https://www.calqulus.site");
      const inviteUrl = `${appUrl}/webhost/invite?token=${invitation.token}`;

      // Audit: who invited whom (no token in the log).
      await ctx.supabase.from("activity_logs").insert({
        actor_id: ctx.user!.id,
        actor_role: "webhost",
        actor_email: ctx.user!.email ?? null,
        action: "admin_invitation_sent",
        entity_type: "admin_invitations",
        entity_id: invitation.id,
        metadata: { email: email.toLowerCase(), display_name: displayName.trim(), admin_type: tier },
      }).then(() => undefined, () => undefined);

      let emailSent = false;
      if (RESEND_API_KEY) {
        const safeName = escapeHtml(displayName.trim());
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "CALQULUS Platform <onboarding@resend.dev>",
            to: [email],
            subject: "You've been invited to CALQULUS ADMIN",
            html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
              <div style="max-width:560px;margin:0 auto;padding:24px;">
                <h2 style="margin:0 0 4px;">CALQULUS ADMIN</h2>
                <p style="color:#6b7280;margin:0 0 20px;">Restricted platform administration</p>
                <p>Hi ${safeName},</p>
                <p>You've been invited to accept a <strong>CALQULUS ADMIN</strong> role with platform-wide oversight.</p>
                <p style="margin:24px 0;"><a href="${inviteUrl}" style="background:#2C9183;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Accept your admin role</a></p>
                <p style="color:#6b7280;font-size:13px;">This link expires in 72 hours and can be used once. If you weren't expecting this invitation, ignore this email.</p>
              </div>
            </body></html>`,
          }),
        });
        emailSent = res.ok;
      }

      return {
        invitation: { id: invitation.id, expiresAt: invitation.expires_at },
        inviteUrl,
        emailSent,
        message: emailSent ? "Invitation sent" : "Invitation created — share the link manually",
      };
    },
  ),
);
