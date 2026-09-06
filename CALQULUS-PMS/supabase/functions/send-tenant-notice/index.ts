/**
 * send-tenant-notice — email a saved tenant notice.
 * The notice row is already persisted by the UI; this function only delivers.
 */
import { serve } from "std/http/server.ts";
import { getEnv } from "../_shared/env.ts";
import {
  withMiddleware,
  errorResponse,
  ValidationError,
} from "../_shared/middleware.ts";

const RESEND_API_KEY = getEnv("RESEND_API_KEY");

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

serve(
  withMiddleware(
    {
      functionName: "send-tenant-notice",
      requireAuth: true,
      allowedRoles: ["manager", "submanager", "agency"],
      rateLimit: { maxPerHour: 60, failClosed: true },
    },
    async (req, ctx) => {
      const payload = await req.json();
      const tenantEmail = String(payload.tenantEmail ?? "").trim();
      const tenantName = String(payload.tenantName ?? "Tenant");
      const noticeType = String(payload.noticeType ?? "notice");
      const title = String(payload.title ?? "Notice");
      const body = String(payload.body ?? "");
      const property = payload.property ? String(payload.property) : "";
      const unit = payload.unit ? String(payload.unit) : "";

      if (!isValidEmail(tenantEmail) || !title || !body) {
        throw new ValidationError("tenantEmail, title, and body are required");
      }

      let managerId = ctx.user!.id;
      const { data: roleRow } = await ctx.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", ctx.user!.id)
        .maybeSingle();
      if (roleRow?.role === "submanager") {
        const { data: rel } = await ctx.supabase
          .from("manager_submanagers")
          .select("manager_id")
          .eq("submanager_user_id", ctx.user!.id)
          .maybeSingle();
        managerId = rel?.manager_id ?? ctx.user!.id;
      }

      const { data: tenant } = await ctx.supabase
        .from("tenants")
        .select("id, manager_id, email")
        .eq("email", tenantEmail)
        .eq("manager_id", managerId)
        .maybeSingle();

      if (!tenant) {
        throw errorResponse("Tenant is not in your managed portfolio", 403);
      }

      if (!RESEND_API_KEY) {
        return { sent: false, error: "EMAIL_NOT_CONFIGURED" };
      }

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "CALQULUS PMS <onboarding@resend.dev>",
          to: [tenantEmail],
          subject: title,
          html: `
            <p>Dear ${escapeHtml(tenantName)},</p>
            <p>${escapeHtml(noticeType.replace(/_/g, " "))}${property ? ` — ${escapeHtml(property)}` : ""}${unit ? ` / ${escapeHtml(unit)}` : ""}</p>
            <div>${escapeHtml(body).replace(/\n/g, "<br/>")}</div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const errBody = await emailResponse.json().catch(() => ({}));
        console.error("Resend API error:", errBody);
        return { sent: false, error: "EMAIL_SEND_FAILED" };
      }

      return { sent: true };
    }
  )
);
