import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { callerRelatesToManager } from "../_shared/notifyAuthz.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

const logStep = (step: string, details?: Record<string, unknown>) => {
};

// HTML escape function to prevent XSS injection
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface NotificationRequest {
  managerId: string;
  tenantName: string;
  tenantEmail: string;
  propertyName: string;
  unit?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;


  try {
    logStep("Starting manager notification");

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const { managerId, tenantName, tenantEmail, propertyName, unit }: NotificationRequest = await req.json();

    if (!managerId || !tenantName || !tenantEmail || !propertyName) {
      logStep("Missing required fields", { managerId, tenantName, tenantEmail, propertyName });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    logStep("Fetching manager details", { managerId });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Previously any authenticated user could notify an arbitrary manager
    // with fully fabricated tenant-signup details. Require the caller to
    // actually be that manager, one of their submanagers, or (the real
    // flow, from TenantAuth.tsx) the tenant this signup notification is
    // about.
    if (gate.userId && !(await callerRelatesToManager(supabaseAdmin, gate.userId, managerId))) {
      logStep("Forbidden: caller has no relationship to managerId", { callerUserId: gate.userId, managerId });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get manager's email and name
    const { data: managerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", managerId)
      .maybeSingle();

    if (profileError || !managerProfile?.email) {
      logStep("Failed to get manager profile", { error: profileError?.message });
      return new Response(JSON.stringify({ error: "Manager not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    logStep("Manager found", { email: managerProfile.email, name: managerProfile.full_name });

    if (!RESEND_API_KEY) {
      logStep("Warning: RESEND_API_KEY not configured, skipping email");
      return new Response(JSON.stringify({ 
        success: true, 
        warning: "Email not sent - RESEND_API_KEY not configured" 
      }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const managerName = managerProfile.full_name ? escapeHtml(managerProfile.full_name) : "Property Manager";
    const safeTenantName = escapeHtml(tenantName);
    const safeTenantEmail = escapeHtml(tenantEmail);
    const safePropertyName = escapeHtml(propertyName);
    const unitInfo = unit ? ` (Unit ${escapeHtml(unit)})` : "";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 New Tenant Joined!</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${managerName}!</h2>
          
          <p style="color: #555; font-size: 16px;">
            Great news! A tenant you invited has completed their registration on CALQULUS RMS.
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Tenant Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 40%;">Name:</td>
                <td style="padding: 8px 0; color: #333; font-weight: 600;">${safeTenantName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Email:</td>
                <td style="padding: 8px 0; color: #333;">${safeTenantEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Property:</td>
                <td style="padding: 8px 0; color: #333;">${safePropertyName}${unitInfo}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #555; font-size: 16px;">
            The tenant can now access their portal to view lease details, pay rent, and submit maintenance requests.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          
          <p style="color: #888; font-size: 12px; text-align: center;">
            This is an automated notification from CALQULUS RMS.
          </p>
        </div>
      </body>
      </html>
    `;

    logStep("Sending email via Resend", { to: managerProfile.email });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CALQULUS RMS <onboarding@resend.dev>",
        to: [managerProfile.email],
        subject: `🎉 ${safeTenantName} has joined ${safePropertyName} on CALQULUS RMS`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      logStep("Email sending failed", { status: emailResponse.status, result: emailResult });
      return new Response(JSON.stringify({ 
        success: true, 
        emailError: emailResult.message || "Failed to send email"
      }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    logStep("Email sent successfully", { emailId: emailResult.id });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Error in notify-manager-tenant-signup", { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
