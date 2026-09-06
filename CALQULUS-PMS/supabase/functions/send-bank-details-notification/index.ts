/**
 * send-bank-details-notification/index.ts
 *
 * Emails a manager's tenants that their landlord's bank/M-Pesa payment
 * details were added or updated. This is a payment-redirection-phishing
 * risk if not tightly scoped: a message that says "your landlord updated
 * where to send rent" is exactly what an attacker would want to forge.
 *
 * Both the recipient list and the bank/paybill/till details are therefore
 * re-derived server-side rather than trusted from the request body:
 *   - `accountId` is looked up in `bank_details` and its `manager_id`
 *     (resolved through submanager -> parent manager, same as
 *     send-tenant-notice) must match the caller.
 *   - Every recipient email must belong to an actual tenant of that same
 *     manager — anything else is silently dropped from the send list, not
 *     just left unchecked.
 *   - The email content (bank name/account/paybill/till) comes from the
 *     fetched `bank_details` row, never from the request body.
 */
import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv, getEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const RESEND_API_KEY = getEnv("RESEND_API_KEY");
const MAX_RECIPIENTS = 200;

function escapeHtml(unsafe: string): string {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAdmin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (!["manager", "submanager", "webhost"].includes((roleRow as { role?: string } | null)?.role ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden: manager role required" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const allowed = await checkRateLimit(supabaseAdmin, user.id, "send-bank-details-notification", 20, { failClosed: true });
    if (!allowed) return rateLimitResponse(req);

    // Resolve the caller's effective manager (submanagers act on behalf of
    // their parent manager, same pattern as send-tenant-notice).
    let effectiveManagerId = user.id;
    if (roleRow?.role === "submanager") {
      const { data: rel } = await supabaseAdmin
        .from("manager_submanagers").select("manager_id").eq("submanager_user_id", user.id).maybeSingle();
      effectiveManagerId = rel?.manager_id ?? user.id;
    }

    const body = await req.json();
    const accountId = String(body.accountId ?? "");
    const managerName = String(body.managerName ?? "");
    const accountLabel = String(body.accountLabel ?? "");
    const isNew = Boolean(body.isNew);
    const requestedEmails: { email: string; name?: string }[] = Array.isArray(body.tenantEmails) ? body.tenantEmails : [];

    if (!accountId) {
      return new Response(JSON.stringify({ error: "accountId is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { data: bankDetails, error: bdErr } = await supabaseAdmin
      .from("bank_details")
      .select("manager_id, bank_name, account_name, account_number, branch_name, paybill_number, till_number")
      .eq("id", accountId)
      .maybeSingle();

    if (bdErr || !bankDetails) {
      return new Response(JSON.stringify({ error: "Bank account not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (roleRow?.role !== "webhost" && bankDetails.manager_id !== effectiveManagerId) {
      return new Response(JSON.stringify({ error: "Forbidden: not your bank account" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // Only notify emails that actually belong to this manager's own tenants —
    // anything else in the caller-supplied list is silently dropped.
    const candidateEmails = requestedEmails
      .map((t) => ({ email: String(t.email ?? "").trim().toLowerCase(), name: String(t.name ?? "Tenant") }))
      .filter((t) => t.email)
      .slice(0, MAX_RECIPIENTS);

    if (candidateEmails.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No recipients to notify" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { data: ownedTenants } = await supabaseAdmin
      .from("tenants")
      .select("email")
      .eq("manager_id", bankDetails.manager_id)
      .in("email", candidateEmails.map((t) => t.email));

    const ownedEmailSet = new Set((ownedTenants ?? []).map((t: { email: string | null }) => (t.email ?? "").toLowerCase()));
    const tenantEmails = candidateEmails.filter((t) => ownedEmailSet.has(t.email));

    if (tenantEmails.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No matching tenants to notify" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const action = isNew ? "added new" : "updated";
    const subject = `Payment Details ${isNew ? "Added" : "Updated"} - CALQULUS RMS`;
    const safeManagerName = escapeHtml(managerName);
    const safeAccountLabel = escapeHtml(accountLabel);

    const results = [];
    for (const tenant of tenantEmails) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1B3A6B 0%, #2F6FED 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Payment Details ${isNew ? "Added" : "Updated"}</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin-top: 0;">Hello ${escapeHtml(tenant.name)},</p>
            <p>Your landlord${safeManagerName ? ` (${safeManagerName})` : ""} has ${action} bank details${safeAccountLabel ? ` for <strong>${safeAccountLabel}</strong>` : ""}.</p>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #2F6FED; font-size: 16px;">Bank Transfer Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 40%;">Bank Name</td>
                  <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(bankDetails.bank_name)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Account Name</td>
                  <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(bankDetails.account_name)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Account Number</td>
                  <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(bankDetails.account_number)}</td>
                </tr>
                ${bankDetails.branch_name ? `
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Branch</td>
                  <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(bankDetails.branch_name)}</td>
                </tr>
                ` : ""}
              </table>
              ${bankDetails.paybill_number || bankDetails.till_number ? `
              <h3 style="margin-top: 20px; color: #2F6FED; font-size: 16px;">M-Pesa Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                ${bankDetails.paybill_number ? `
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 40%;">Paybill Number</td>
                  <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(bankDetails.paybill_number)}</td>
                </tr>
                ` : ""}
                ${bankDetails.till_number ? `
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Till Number</td>
                  <td style="padding: 8px 0; font-weight: 600;">${escapeHtml(bankDetails.till_number)}</td>
                </tr>
                ` : ""}
              </table>
              ` : ""}
            </div>
            <p>You can also view these details anytime in your tenant portal.</p>
            <p style="margin-bottom: 0; color: #64748b; font-size: 14px;">
              Best regards,<br>
              <strong>CALQULUS RMS Team</strong>
            </p>
          </div>
        </body>
        </html>
      `;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: "CALQULUS RMS <notifications@resend.dev>",
            to: [tenant.email],
            subject,
            html: emailHtml,
          }),
        });
        const data = await res.json();
        results.push({ email: tenant.email, success: res.ok, data });
      } catch (error) {
        console.error(`Failed to send email to ${tenant.email}:`, error);
        results.push({ email: tenant.email, success: false, error: String(error) });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return new Response(
      JSON.stringify({ success: true, message: `Sent ${successCount} of ${tenantEmails.length} emails`, results }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error sending bank details notification:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
