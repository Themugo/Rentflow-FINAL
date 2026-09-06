import { requireEnv, getEnv } from "../_shared/env.ts";
/**
 * send-receipt-email/index.ts
 * Branded HTML receipt email — shows due date, amount paid, method, balance
 */
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { createClient } from "supabase/supabase-js@2";
import { checkRoleAccess } from "../_shared/authorization.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { serve } from "std/http/server.ts";

const fmt = (n: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(n);
const esc = (s: string) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;

  // No tenant/invoice id is passed here (raw tenantEmail string), so we
  // can't verify the specific tenant relationship — but require the caller
  // be an approved manager/submanager/webhost (the real callers: ReceiptsTab,
  // PropertyBillingTab, PhysicalDocumentEntry), closing the "any
  // authenticated user can email arbitrary receipt content to any address"
  // hole. Service-role/cron callers (process-payment, auto-send-receipt,
  // reconcile-bank) are unaffected.
  if (gate.userId) {
    const access = await checkRoleAccess(gate.userId, ["manager", "submanager", "webhost"]);
    if (!access.allowed) {
      return new Response(JSON.stringify({ error: access.error ?? "Forbidden" }), {
        status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
  }

  if (gate.userId) {
    const rlSupabase = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const rateOk = await checkRateLimit(rlSupabase, gate.userId, "send-receipt-email", 60, { failClosed: true });
    if (!rateOk) return rateLimitResponse(req);
  }

  try {
    const RESEND_API_KEY = getEnv("RESEND_API_KEY");
    const FROM = getEnv("RESEND_FROM_EMAIL", "onboarding@resend.dev");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not set" }),
        { status: 503, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const {
      tenantEmail, tenantName, invoiceNumber, amount, paidDate, dueDate,
      property, unit, mpesaReceipt, bankRef, paymentMethod = "M-Pesa",
      outstandingBalance = 0, companyName = "Property Management",
      primaryColor = "#2F6FED", secondaryColor = "#1B3A6B",
      footerMessage = "Thank you for your payment!", logoUrl,
    } = body;

    if (!tenantEmail || !invoiceNumber || !amount) {
      return new Response(JSON.stringify({ error: "tenantEmail, invoiceNumber, amount required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const ref = mpesaReceipt || bankRef || "N/A";
    const methodIcon = paymentMethod.toLowerCase().includes("bank") ? "🏦"
      : paymentMethod.toLowerCase().includes("airtel") ? "📲" : "📱";

    const formattedPaid = new Date(paidDate).toLocaleDateString("en-KE", { year:"numeric", month:"long", day:"numeric" });
    const formattedDue = dueDate ? new Date(dueDate).toLocaleDateString("en-KE", { year:"numeric", month:"long", day:"numeric" }) : null;
    const logoHtml = logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(companyName)}" style="max-height:50px;max-width:160px;margin-bottom:8px;" />` : "";

    const balanceHtml = outstandingBalance > 0
      ? `<tr><td style="padding:12px 16px;color:#666;border-top:2px solid #e2e8f0;font-weight:600;">Outstanding Balance</td>
         <td style="padding:12px 16px;text-align:right;font-weight:700;color:#dc2626;font-size:16px;border-top:2px solid #e2e8f0;">${esc(fmt(outstandingBalance))}</td></tr>`
      : `<tr style="background:#f0fdf4;"><td style="padding:12px 16px;color:#166534;font-weight:600;">Account Status</td>
         <td style="padding:12px 16px;text-align:right;font-weight:700;color:#166534;">✓ Fully paid up</td></tr>`;

    const balCallout = outstandingBalance > 0
      ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px;margin:16px 0;">
           <p style="margin:0;color:#92400e;font-size:13px;"><strong>⚠️ Outstanding: ${esc(fmt(outstandingBalance))}</strong> — Please clear to avoid late fees.</p></div>`
      : `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;margin:16px 0;">
           <p style="margin:0;color:#166534;font-size:13px;">✅ <strong>Account up to date.</strong> No balance due.</p></div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Payment Receipt — ${esc(invoiceNumber)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5;">
<div style="max-width:600px;margin:32px auto;padding:20px;">
<div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:${esc(primaryColor)};padding:24px 32px;text-align:center;">
    ${logoHtml}
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">✓ Payment Received</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;">${esc(companyName)}</p>
  </div>
  <div style="padding:28px 32px;">
    <p style="margin:0 0 20px;">Dear <strong>${esc(tenantName)}</strong>,</p>
    <p style="margin:0 0 20px;color:#555;">Payment of <strong>${esc(fmt(Number(amount)))}</strong> received for <strong>${esc(property)} — Unit ${esc(unit)}</strong>.</p>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <div style="background:${esc(secondaryColor)};color:#fff;padding:11px 16px;font-weight:700;font-size:13px;">PAYMENT RECEIPT</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 16px;color:#666;font-size:13px;">Invoice #</td><td style="padding:11px 16px;text-align:right;font-weight:600;">${esc(invoiceNumber)}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;background:#fafafa;"><td style="padding:11px 16px;color:#666;font-size:13px;">Property / Unit</td><td style="padding:11px 16px;text-align:right;font-weight:600;">${esc(property)} — ${esc(unit)}</td></tr>
        ${formattedDue ? `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 16px;color:#666;font-size:13px;">Due Date</td><td style="padding:11px 16px;text-align:right;font-weight:600;">${esc(formattedDue)}</td></tr>` : ""}
        <tr style="border-bottom:1px solid #e2e8f0;background:#fafafa;"><td style="padding:11px 16px;color:#666;font-size:13px;">Payment Date</td><td style="padding:11px 16px;text-align:right;font-weight:600;">${esc(formattedPaid)}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:11px 16px;color:#666;font-size:13px;">Method</td><td style="padding:11px 16px;text-align:right;font-weight:600;">${methodIcon} ${esc(paymentMethod)}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;background:#fafafa;"><td style="padding:11px 16px;color:#666;font-size:13px;">Reference</td><td style="padding:11px 16px;text-align:right;font-weight:600;font-family:monospace;">${esc(ref)}</td></tr>
        <tr style="background:${esc(primaryColor)};"><td style="padding:14px 16px;color:#fff;font-weight:700;font-size:15px;">Amount Paid</td><td style="padding:14px 16px;text-align:right;color:#fff;font-weight:800;font-size:20px;">${esc(fmt(Number(amount)))}</td></tr>
        ${balanceHtml}
      </table>
    </div>
    ${balCallout}
    <div style="text-align:center;color:#888;font-size:13px;border-top:1px solid #f1f5f9;padding-top:20px;">
      <p style="margin:0 0 6px;">${esc(footerMessage)}</p>
      <p style="margin:0;font-size:11px;color:#aaa;">Automated receipt — keep for your records.</p>
    </div>
  </div>
</div>
</div></body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${companyName} <${FROM}>`,
        to: [tenantEmail],
        subject: `Payment Receipt — ${invoiceNumber} — ${fmt(Number(amount))}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (errText.includes("verify a domain") || errText.includes("testing emails")) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "Domain not verified" }),
          { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      throw new Error(`Resend: ${errText}`);
    }

    const result = await res.json();
    return new Response(JSON.stringify({ success: true, id: result.id }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("send-receipt-email error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
