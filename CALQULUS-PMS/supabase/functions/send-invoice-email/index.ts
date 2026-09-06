import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface SendInvoiceEmailRequest {
  tenantEmail?: string;
  to?: string;
  tenantName?: string;
  companyName?: string;
  pdfBase64?: string;
  fileName?: string;
  subject?: string;
  body?: string;
}

// HTML escape function to prevent XSS injection
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") return preflightResponse(req);


  try {

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check if user has manager role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "manager" && roleData?.role !== "webhost" && roleData?.role !== "submanager") {
      console.error("User does not have required permissions");
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(getEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const rateOk = await checkRateLimit(supabaseAdmin, user.id, "send-invoice-email", 60, { failClosed: true });
    if (!rateOk) return rateLimitResponse(req);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      throw new Error("Email service is not configured");
    }

    const {
      tenantEmail: tenantEmailInput,
      to,
      tenantName = "Tenant",
      companyName = "CALQULUS RMS",
      pdfBase64,
      fileName,
      subject,
      body,
    }: SendInvoiceEmailRequest = await req.json();
    const tenantEmail = tenantEmailInput || to;

    // Validate email format
    if (!tenantEmail || !isValidEmail(tenantEmail)) {
      console.error("Invalid email format:", tenantEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Escape all user-supplied values for HTML
    const safeTenantName = escapeHtml(tenantName);
    const safeCompanyName = escapeHtml(companyName);
    const safeBody = body ? escapeHtml(body).replace(/\n/g, "<br />") : "";
    const isGenericMessage = Boolean(body && !pdfBase64);
    const attachments = pdfBase64 && fileName
      ? [{ filename: fileName, content: pdfBase64 }]
      : undefined;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${safeCompanyName} <noreply@${getEnv("RESEND_FROM_DOMAIN", "resend.dev")}>`,
        to: [tenantEmail],
        subject: subject || `Account Statement from ${safeCompanyName}`,
        html: isGenericMessage ? `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9fafb; }
              .message { white-space: normal; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${safeCompanyName}</h1>
              </div>
              <div class="content">
                <p>Dear ${safeTenantName},</p>
                <div class="message">${safeBody}</div>
              </div>
              <div class="footer">
                <p>This is an automated message from ${safeCompanyName}.</p>
              </div>
            </div>
          </body>
          </html>
        ` : `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9fafb; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${safeCompanyName}</h1>
              </div>
              <div class="content">
                <p>Dear ${safeTenantName},</p>
                <p>Please find attached your account statement from ${safeCompanyName}.</p>
                <p>This statement includes a summary of your recent invoices and payment history.</p>
                <p>If you have any questions about your statement, please don't hesitate to contact us.</p>
                <p>Best regards,<br>${safeCompanyName}</p>
              </div>
              <div class="footer">
                <p>This is an automated message from ${safeCompanyName}.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        attachments,
      }),
    });

    const responseData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", responseData);
      throw new Error(responseData.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(req),
      },
    });
  } catch (error: any) {
    console.error("Error sending invoice email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
