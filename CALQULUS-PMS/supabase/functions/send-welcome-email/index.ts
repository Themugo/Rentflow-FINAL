import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface WelcomeEmailRequest {
  email: string;
  fullName: string;
  userType: "manager" | "tenant";
}

Deno.serve(async (req: Request): Promise<Response> => {

  if (req.method === "OPTIONS") return preflightResponse(req);


  try {
    // Auth check: require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { email, fullName, userType }: WelcomeEmailRequest = await req.json();

    // Only allow sending welcome email to the authenticated user's own email
    if (email !== user.email) {
      return new Response(JSON.stringify({ error: "Can only send welcome email to your own address" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const rateOk = await checkRateLimit(supabaseClient, user.id, "send-welcome-email", 10, { failClosed: true });
    if (!rateOk) return rateLimitResponse(req);

    const isManager = userType === "manager";
    const portalUrl = isManager ? "/dashboard" : "/portal";
    const roleTitle = isManager ? "Property Manager" : "Tenant";

    const managerOnboarding = `
      <h2 style="color: #1a1a2e; margin-top: 30px;">Getting Started as a Property Manager</h2>
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <ol style="color: #475569; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong>Add Your Properties</strong> - Start by adding your rental properties to the system</li>
          <li><strong>Set Up Units</strong> - Configure individual units within each property</li>
          <li><strong>Invite Tenants</strong> - Add tenants and link them to their units</li>
          <li><strong>Create Leases</strong> - Set up lease agreements with rent amounts and terms</li>
          <li><strong>Configure Payments</strong> - Set up M-Pesa or other payment methods</li>
          <li><strong>Generate Invoices</strong> - Monthly invoices can be auto-generated</li>
        </ol>
      </div>
      <h3 style="color: #1a1a2e;">Key Features Available to You:</h3>
      <ul style="color: #475569; line-height: 1.8;">
        <li>📊 Dashboard with real-time analytics</li>
        <li>🏠 Property and unit management</li>
        <li>👥 Tenant management and communications</li>
        <li>📄 Digital lease contracts with e-signatures</li>
        <li>💳 Automated billing and payment tracking</li>
        <li>🔧 Maintenance request handling</li>
        <li>📈 Financial reports and statements</li>
      </ul>
    `;

    const tenantOnboarding = `
      <h2 style="color: #1a1a2e; margin-top: 30px;">Getting Started as a Tenant</h2>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <ol style="color: #475569; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong>Complete Your Profile</strong> - Add your contact information</li>
          <li><strong>View Your Lease</strong> - Check your lease details and terms</li>
          <li><strong>Review Invoices</strong> - See your rent invoices and payment history</li>
          <li><strong>Make Payments</strong> - Pay rent via M-Pesa directly from the portal</li>
          <li><strong>Submit Requests</strong> - Report maintenance issues easily</li>
        </ol>
      </div>
      <h3 style="color: #1a1a2e;">What You Can Do in Your Portal:</h3>
      <ul style="color: #475569; line-height: 1.8;">
        <li>💳 Pay rent online via M-Pesa</li>
        <li>📄 View and sign lease contracts</li>
        <li>🧾 Access payment history and receipts</li>
        <li>🔧 Submit maintenance requests</li>
        <li>📞 Contact your property manager</li>
        <li>📊 View your account statements</li>
      </ul>
    `;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${isManager ? '#6366f1' : '#10b981'} 0%, ${isManager ? '#4f46e5' : '#059669'} 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to CALQULUS RMS! 🎉</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 16px;">Your ${roleTitle} Account is Ready</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            <p style="color: #1a1a2e; font-size: 18px; margin-bottom: 20px;">
              Hello <strong>${fullName}</strong>,
            </p>
            
            <p style="color: #475569; line-height: 1.6;">
              Thank you for joining CALQULUS RMS! Your account has been successfully created and you're all set to start using our property management platform.
            </p>

            ${isManager ? managerOnboarding : tenantOnboarding}

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.calqulus.site${portalUrl}" 
                 style="display: inline-block; background: ${isManager ? '#4f46e5' : '#10b981'}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Go to Your ${isManager ? 'Dashboard' : 'Portal'}
              </a>
            </div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
              <p style="color: #64748b; font-size: 14px; margin: 0;">
                Need help? Reply to this email or contact our support team.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; padding: 20px 30px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} CALQULUS RMS. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CALQULUS RMS <onboarding@resend.dev>",
        to: [email],
        subject: `Welcome to CALQULUS RMS, ${fullName}! 🏠`,
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Failed to send welcome email:", emailData);
      throw new Error(emailData.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
