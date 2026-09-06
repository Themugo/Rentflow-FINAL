import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface SendContractNotificationRequest {
  tenantEmail: string;
  tenantName: string;
  companyName: string;
  contractTitle: string;
  propertyInfo: string;
  validFrom: string;
  validUntil: string;
  portalUrl: string;
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

// Validate URL is from trusted domain
function isValidPortalUrl(url: string, allowedDomains: string[]): boolean {
  try {
    const parsedUrl = new URL(url);
    return allowedDomains.some(domain => 
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function getAllowedPortalDomains(): string[] {
  const siteUrl = getEnv("SITE_URL", "https://www.calqulus.site");
  const configuredHost = new URL(siteUrl).hostname;
  return [...new Set([configuredHost, "calqulus.site", "www.calqulus.site", "localhost"])];
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
    
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      throw new Error("Email service is not configured");
    }

    const { 
      tenantEmail, 
      tenantName, 
      companyName, 
      contractTitle, 
      propertyInfo,
      validFrom,
      validUntil,
      portalUrl 
    }: SendContractNotificationRequest = await req.json();

    // Validate email format
    if (!isValidEmail(tenantEmail)) {
      console.error("Invalid email format:", tenantEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Validate portal URL is from trusted domain
    const allowedDomains = getAllowedPortalDomains();
    if (!isValidPortalUrl(portalUrl, allowedDomains)) {
      console.error("Invalid portal URL domain:", portalUrl);
      return new Response(
        JSON.stringify({ error: "Invalid portal URL" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Escape all user-supplied values for HTML
    const safeTenantName = escapeHtml(tenantName);
    const safeCompanyName = escapeHtml(companyName);
    const safeContractTitle = escapeHtml(contractTitle);
    const safePropertyInfo = escapeHtml(propertyInfo);
    const safeValidFrom = escapeHtml(validFrom);
    const safeValidUntil = escapeHtml(validUntil);
    // portalUrl is validated above, but we still escape for safety in href
    const safePortalUrl = escapeHtml(portalUrl);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${safeCompanyName} <onboarding@resend.dev>`,
        to: [tenantEmail],
        subject: `Action Required: Please Sign Your Lease Agreement - ${safeContractTitle}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { padding: 30px 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
              .contract-box { background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .contract-box h3 { color: #0369a1; margin: 0 0 15px 0; font-size: 18px; }
              .detail-row { display: flex; margin-bottom: 8px; }
              .detail-label { color: #6b7280; min-width: 120px; }
              .detail-value { color: #111827; font-weight: 500; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .cta-button:hover { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); }
              .warning { background-color: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0; }
              .warning-title { color: #b45309; font-weight: 600; margin-bottom: 5px; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${safeCompanyName}</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Contract Signature Required</p>
              </div>
              <div class="content">
                <p>Dear ${safeTenantName},</p>
                <p>A new lease agreement has been prepared for you and requires your digital signature.</p>
                
                <div class="contract-box">
                  <h3>📋 Contract Details</h3>
                  <div class="detail-row">
                    <span class="detail-label">Contract:</span>
                    <span class="detail-value">${safeContractTitle}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Property:</span>
                    <span class="detail-value">${safePropertyInfo}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Valid From:</span>
                    <span class="detail-value">${safeValidFrom}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Valid Until:</span>
                    <span class="detail-value">${safeValidUntil}</span>
                  </div>
                </div>

                <div style="text-align: center;">
                  <a href="${safePortalUrl}" class="cta-button">Review &amp; Sign Contract</a>
                </div>

                <div class="warning">
                  <div class="warning-title">⚠️ Action Required</div>
                  <p style="margin: 0; color: #92400e;">Please review and sign this contract at your earliest convenience. Your digital signature is legally binding.</p>
                </div>

                <p>If you have any questions about this contract, please contact us directly.</p>
                <p>Best regards,<br><strong>${safeCompanyName}</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated message from ${safeCompanyName}.</p>
                <p>If you did not expect this email, please contact us immediately.</p>
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
    console.error("Error sending contract notification email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
