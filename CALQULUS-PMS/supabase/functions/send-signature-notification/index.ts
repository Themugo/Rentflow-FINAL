import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface SendSignatureNotificationRequest {
  managerEmail: string;
  tenantName: string;
  contractTitle: string;
  propertyInfo: string;
  signedAt: string;
  companyName: string;
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

    // Check if user has tenant role (tenants send this notification when they sign)
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "tenant" && roleData?.role !== "manager" && roleData?.role !== "webhost") {
      console.error("User does not have required permissions");
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(getEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const rateOk = await checkRateLimit(supabaseAdmin, user.id, "send-signature-notification", 60, { failClosed: true });
    if (!rateOk) return rateLimitResponse(req);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      throw new Error("Email service is not configured");
    }

    const {
      managerEmail,
      tenantName,
      contractTitle,
      propertyInfo,
      signedAt,
      companyName,
    }: SendSignatureNotificationRequest = await req.json();

    // Validate email format
    if (!isValidEmail(managerEmail)) {
      console.error("Invalid email format:", managerEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // For the real usage (a tenant notifying their own manager that they
    // just signed), verify managerEmail is actually that tenant's manager —
    // otherwise any tenant could send a fabricated "contract signed" email
    // to any address.
    if (roleData?.role === "tenant") {
      const { data: tenantRoleRow } = await supabaseAdmin
        .from("user_roles").select("tenant_id").eq("user_id", user.id).maybeSingle();
      const { data: tenantRow } = tenantRoleRow?.tenant_id
        ? await supabaseAdmin.from("tenants").select("manager_id").eq("id", tenantRoleRow.tenant_id).maybeSingle()
        : { data: null };
      const { data: managerProfile } = tenantRow?.manager_id
        ? await supabaseAdmin.from("profiles").select("email").eq("id", tenantRow.manager_id).maybeSingle()
        : { data: null };
      if (!managerProfile?.email || managerProfile.email.toLowerCase() !== managerEmail.toLowerCase()) {
        return new Response(
          JSON.stringify({ error: "Forbidden: managerEmail does not match your own manager" }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    }

    // Escape all user-supplied values for HTML
    const safeTenantName = escapeHtml(tenantName);
    const safeCompanyName = escapeHtml(companyName);
    const safeContractTitle = escapeHtml(contractTitle);
    const safePropertyInfo = escapeHtml(propertyInfo);
    const safeSignedAt = escapeHtml(signedAt);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${safeCompanyName} <onboarding@resend.dev>`,
        to: [managerEmail],
        subject: `✅ Contract Signed: ${safeTenantName} signed "${safeContractTitle}"`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { padding: 30px 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
              .success-box { background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .success-box h3 { color: #047857; margin: 0 0 15px 0; font-size: 18px; }
              .detail-row { display: flex; margin-bottom: 8px; }
              .detail-label { color: #6b7280; min-width: 120px; }
              .detail-value { color: #111827; font-weight: 500; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Contract Signed</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">A tenant has signed their lease agreement</p>
              </div>
              <div class="content">
                <p>Great news!</p>
                <p><strong>${safeTenantName}</strong> has signed their lease agreement.</p>
                
                <div class="success-box">
                  <h3>📋 Signature Details</h3>
                  <div class="detail-row">
                    <span class="detail-label">Tenant:</span>
                    <span class="detail-value">${safeTenantName}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Contract:</span>
                    <span class="detail-value">${safeContractTitle}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Property:</span>
                    <span class="detail-value">${safePropertyInfo}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Signed At:</span>
                    <span class="detail-value">${safeSignedAt}</span>
                  </div>
                </div>

                <p>You can view the signed contract and download the PDF from your dashboard.</p>
                
                <p>Best regards,<br><strong>${safeCompanyName} System</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated notification from ${safeCompanyName}.</p>
              </div>
            </div>
          </body>
          </html>
        `,
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
    console.error("Error sending signature notification email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
