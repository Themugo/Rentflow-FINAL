import { serve } from "std/http/server.ts";
import { Resend } from "resend/resend@2.0.0";
import { withMiddleware, errorResponse } from "../_shared/middleware.ts";
import { getEnv } from "../_shared/env.ts";
import { escapeHtml } from "../_shared/html.ts";

const resend = new Resend(getEnv("RESEND_API_KEY"));

const SIGNUP_ROLES = new Set(["manager", "agency", "landlord"]);

/**
 * Completes public signup (role row via service role) and emails webhosts.
 * Requires the caller's JWT. Identity comes from the session, not the body.
 */
serve(
  withMiddleware(
    {
      functionName: "notify-new-manager-signup",
      requireAuth: true,
      rateLimit: { maxPerHour: 5, failClosed: true },
    },
    async (req, ctx) => {
      if (!ctx.user || ctx.user.id === "service-role") {
        throw errorResponse("A user session is required", 401);
      }

      const body = await req.json().catch(() => ({})) as {
        managerName?: string;
        role?: string;
      };

      const metaRole = String(ctx.user.role || body.role || "manager").toLowerCase();
      const role = SIGNUP_ROLES.has(metaRole) ? metaRole : "manager";
      const email = ctx.user.email;
      if (!email) throw errorResponse("User email is required", 400);

      const name = escapeHtml(
        String(body.managerName || ctx.user.full_name || ctx.user.name || email).slice(0, 200),
      );
      const safeEmail = escapeHtml(email);
      const safeRole = escapeHtml(role);

      const approval = role === "landlord" ? "approved" : "pending";

      const { error: roleError } = await ctx.supabase.from("user_roles").upsert({
        user_id: ctx.user.id,
        role,
        tenant_id: null,
        approval_status: approval,
      }, { onConflict: "user_id,role", ignoreDuplicates: true });

      if (roleError) {
        console.error("[NEW-MANAGER-SIGNUP] role upsert failed", roleError);
        throw errorResponse("Failed to create role", 500);
      }

      if (!SIGNUP_ROLES.has(role) || role === "landlord") {
        return { success: true, notified: false };
      }

      const { data: webhostRoles, error: rolesError } = await ctx.supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "webhost");

      if (rolesError) throw new Error("Could not find webhost users");
      if (!webhostRoles?.length) return { success: true, notified: false };

      const webhostEmails: string[] = [];
      for (const row of webhostRoles) {
        const { data: profile } = await ctx.supabase
          .from("profiles")
          .select("email")
          .eq("id", row.user_id)
          .maybeSingle();
        if (profile?.email) webhostEmails.push(profile.email);
      }

      if (webhostEmails.length === 0) return { success: true, notified: false };

      const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0D2744; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">New ${safeRole} signup</h1>
        </div>
        <div style="background: #F7F9FC; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #334155;">A new ${safeRole} has signed up and is awaiting your approval:</p>
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="color: #64748b; padding: 8px 0;">Name:</td>
                <td style="color: #1e293b; font-weight: bold; padding: 8px 0;">${name}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 8px 0;">Email:</td>
                <td style="color: #1e293b; font-weight: bold; padding: 8px 0;">${safeEmail}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 8px 0;">Status:</td>
                <td style="padding: 8px 0;">Pending approval</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 14px; color: #64748b;">Log in to the webhost dashboard to approve or reject this account.</p>
        </div>
      </div>
    `;

      await resend.emails.send({
        from: "CALQULUS RMS <onboarding@resend.dev>",
        to: webhostEmails,
        subject: `New ${safeRole} signup: ${name} — pending approval`,
        html,
      });

      return { success: true, notified: true };
    },
  ),
);
