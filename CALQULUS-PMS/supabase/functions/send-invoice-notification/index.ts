import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { resolveEffectiveManagerIds } from "../_shared/notifyAuthz.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface SendInvoiceNotificationRequest {
  tenantEmail: string;
  tenantName: string;
  tenantPhone?: string;   // NEW: for SMS
  tenantWhatsapp?: string; // NEW: for WhatsApp
  companyName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  property?: string;
  unit?: string;
  description?: string;
  sendSms?: boolean;      // NEW: send SMS notification
  sendWhatsapp?: boolean; // NEW: send WhatsApp notification
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

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
    const rateOk = await checkRateLimit(supabaseAdmin, user.id, "send-invoice-notification", 120, { failClosed: true });
    if (!rateOk) return rateLimitResponse(req);

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      // Return a structured partial-success rather than throwing.
      // The invoice was already created/updated — we just can't send email.
      // The caller (manager UI or edge fn) can show a warning toast.
      return new Response(JSON.stringify({
        success: false,
        emailSent: false,
        error: "EMAIL_NOT_CONFIGURED",
        message: "Invoice saved but email not sent — RESEND_API_KEY is not set in Supabase Edge Function secrets.",
      }), {
        status: 200, // Not a 500 — the invoice itself succeeded
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { 
      tenantEmail, 
      tenantPhone,
      tenantWhatsapp,
      tenantName, 
      companyName, 
      invoiceNumber, 
      amount, 
      dueDate,
      property,
      unit,
      description,
      sendSms = false,
      sendWhatsapp = false,
    }: SendInvoiceNotificationRequest = await req.json();

    // Validate email format
    if (!isValidEmail(tenantEmail)) {
      console.error("Invalid email format:", tenantEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email address format" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Verify tenantEmail is actually one of the caller's own tenants —
    // otherwise this becomes a "spoofed official invoice" phishing vector
    // sendable to any address via the platform's trusted email domain.
    if (roleData?.role !== "webhost") {
      const effectiveManagerIds = await resolveEffectiveManagerIds(supabaseAdmin, user.id, roleData?.role ?? "manager");
      const { data: ownedTenant } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("email", tenantEmail)
        .in("manager_id", Array.from(effectiveManagerIds))
        .maybeSingle();
      if (!ownedTenant) {
        return new Response(
          JSON.stringify({ error: "Forbidden: tenantEmail is not in your managed portfolio" }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    }

    // Escape all user-supplied values for HTML
    const safeTenantName = escapeHtml(tenantName);
    const safeCompanyName = escapeHtml(companyName);
    const safeInvoiceNumber = escapeHtml(invoiceNumber);
    const safeProperty = property ? escapeHtml(property) : null;
    const safeUnit = unit ? escapeHtml(unit) : null;
    const safeDescription = description ? escapeHtml(description) : null;
    const formattedAmount = formatCurrency(amount);
    const formattedDueDate = formatDate(dueDate);

    const propertyInfo = safeProperty && safeUnit 
      ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Property</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeProperty} - ${safeUnit}</td></tr>`
      : safeProperty 
        ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Property</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeProperty}</td></tr>`
        : "";

    const descriptionRow = safeDescription 
      ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Description</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeDescription}</td></tr>`
      : "";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${safeCompanyName} <onboarding@resend.dev>`,
        to: [tenantEmail],
        subject: `New Invoice ${safeInvoiceNumber} - ${formattedAmount} Due ${formattedDueDate}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; }
              .header { background: linear-gradient(135deg, #1a365d 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { padding: 30px; background-color: #ffffff; }
              .invoice-box { background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; }
              .amount { font-size: 32px; font-weight: bold; color: #1a365d; text-align: center; margin: 10px 0; }
              .due-date { text-align: center; color: #dc2626; font-weight: 600; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background-color: #f1f5f9; }
              .btn { display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${safeCompanyName}</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">New Invoice Notification</p>
              </div>
              <div class="content">
                <p>Dear ${safeTenantName},</p>
                <p>A new invoice has been generated for your account. Please find the details below:</p>
                
                <div class="invoice-box">
                  <p class="amount">${formattedAmount}</p>
                  <p class="due-date">Due by ${formattedDueDate}</p>
                  
                  <table>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Invoice Number</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeInvoiceNumber}</td>
                    </tr>
                    ${propertyInfo}
                    ${descriptionRow}
                  </table>
                </div>
                
                <p>Please ensure payment is made by the due date to avoid any late fees. If you have already made the payment, please disregard this notice.</p>
                
                <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
                
                <p>Best regards,<br><strong>${safeCompanyName}</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated message from ${safeCompanyName}.</p>
                <p>Please do not reply directly to this email.</p>
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

    // Send SMS notification if requested and phone provided
    if (sendSms && tenantPhone) {
      try {
        const supabaseUrl = getEnv("SUPABASE_URL");
        const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
        
        const propertyInfo = property && unit ? `${property} - Unit ${unit}` : property || "your property";
        const smsMessage = `${companyName}: New invoice ${invoiceNumber} for ${propertyInfo}. Amount: ${formattedAmount}. Due: ${formattedDueDate}. Please pay on time to avoid late fees.`;
        
        const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            phoneNumber: tenantPhone,
            message: smsMessage,
          }),
        });
        
        const smsResult = await smsResponse.json();
        if (!smsResponse.ok) {
          console.error("SMS sending failed:", smsResult);
        } else {
          console.log("SMS sent successfully:", smsResult);
        }
      } catch (smsError) {
        console.error("SMS error:", smsError instanceof Error ? smsError.message : String(smsError));
      }
    }

    // Send WhatsApp notification if requested and WhatsApp number provided
    if (sendWhatsapp && tenantWhatsapp) {
      try {
        const supabaseUrl = getEnv("SUPABASE_URL");
        const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
        
        const propertyInfo = property && unit ? `${property} - Unit ${unit}` : property || "your property";
        const whatsappMessage = `📄 *New Invoice*\n\n${companyName}\n\n💰 *Amount:* ${formattedAmount}\n📋 *Invoice:* ${invoiceNumber}\n🏠 *Property:* ${propertyInfo}\n📅 *Due Date:* ${formattedDueDate}\n\nPlease ensure payment is made by the due date to avoid late fees.`;
        
        const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            phoneNumber: tenantWhatsapp,
            message: whatsappMessage,
            type: 'invoice',
          }),
        });
        
        const whatsappResult = await whatsappResponse.json();
        if (!whatsappResponse.ok) {
          console.error("WhatsApp sending failed:", whatsappResult);
        } else {
          console.log("WhatsApp sent successfully:", whatsappResult);
        }
      } catch (whatsappError) {
        console.error("WhatsApp error:", whatsappError instanceof Error ? whatsappError.message : String(whatsappError));
      }
    }

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(req),
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending invoice notification:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
