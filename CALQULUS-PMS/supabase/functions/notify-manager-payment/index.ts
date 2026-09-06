import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv, getEnv } from "../_shared/env.ts";
import { isServiceRoleRequest } from "../_shared/assertCaller.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = getEnv("SUPABASE_ANON_KEY", "");

// Optional vendor keys — `getEnv` returns "" if unset and the handler
// already checks for empty string before invoking the vendor APIs.
const RESEND_API_KEY = getEnv("RESEND_API_KEY");
const AFRICASTALKING_API_KEY = getEnv("AFRICASTALKING_API_KEY");
const AFRICASTALKING_USERNAME = getEnv("AFRICASTALKING_USERNAME");

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[notify-manager-payment] ${step}`, details ?? "");
};

interface PaymentNotificationRequest {
  managerId: string;
  tenantName: string;
  tenantEmail: string;
  propertyName: string;
  unit?: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  notifyEmail?: boolean;
  notifySms?: boolean;
  notifyWhatsapp?: boolean;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

async function sendEmailNotification(
  managerEmail: string,
  managerName: string,
  tenantName: string,
  propertyName: string,
  unit: string | undefined,
  invoiceNumber: string,
  amount: number,
  paymentDate: string,
  paymentMethod: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    logStep("Email skipped - RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  const safeTenantName = escapeHtml(tenantName);
  const safePropertyName = escapeHtml(propertyName);
  const safeUnit = unit ? escapeHtml(unit) : "";
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeManagerName = escapeHtml(managerName);
  const safePaymentMethod = escapeHtml(paymentMethod);

  const formattedAmount = formatCurrency(amount);
  const formattedDate = new Date(paymentDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const unitInfo = safeUnit ? ` (Unit ${safeUnit})` : "";

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">💰 Payment Received!</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #333; margin-top: 0;">Hi ${safeManagerName}!</h2>
        
        <p style="color: #555; font-size: 16px;">
          Great news! You've received a payment from one of your tenants.
        </p>
        
        <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <p style="color: #065f46; font-size: 14px; margin: 0 0 5px 0;">Amount Received</p>
          <p style="color: #047857; font-size: 36px; font-weight: bold; margin: 0;">${formattedAmount}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Payment Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #e5e7eb;">Tenant:</td>
              <td style="padding: 10px 0; color: #333; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${safeTenantName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #e5e7eb;">Property:</td>
              <td style="padding: 10px 0; color: #333; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${safePropertyName}${unitInfo}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #e5e7eb;">Invoice:</td>
              <td style="padding: 10px 0; color: #333; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${safeInvoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #e5e7eb;">Payment Method:</td>
              <td style="padding: 10px 0; color: #333; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${safePaymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666;">Date & Time:</td>
              <td style="padding: 10px 0; color: #333; font-weight: 600;">${formattedDate}</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #555; font-size: 14px;">
          The invoice has been automatically marked as paid in your CALQULUS RMS dashboard.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        
        <p style="color: #888; font-size: 12px; text-align: center;">
          This is an automated notification from CALQULUS RMS.
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    logStep("Sending email notification", { to: managerEmail });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "CALQULUS RMS <onboarding@resend.dev>",
        to: [managerEmail],
        subject: `💰 Payment Received: ${formattedAmount} from ${safeTenantName}`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      logStep("Email sending failed", { status: emailResponse.status, result: emailResult });
      return { success: false, error: emailResult.message || "Failed to send email" };
    }

    logStep("Email sent successfully", { emailId: emailResult.id });
    return { success: true };
  } catch (error: any) {
    logStep("Email error", { error: error.message });
    return { success: false, error: error.message };
  }
}

async function sendSmsNotification(
  phoneNumber: string,
  tenantName: string,
  amount: number,
  propertyName: string,
  invoiceNumber: string
): Promise<{ success: boolean; error?: string }> {
  if (!AFRICASTALKING_API_KEY || !AFRICASTALKING_USERNAME) {
    logStep("SMS skipped - Africa's Talking credentials not configured");
    return { success: false, error: "SMS service not configured" };
  }

  const formattedAmount = formatCurrency(amount);
  const message = `CALQULUS RMS: Payment received! ${tenantName} paid ${formattedAmount} for ${propertyName}. Invoice: ${invoiceNumber}`;

  try {
    let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/^0/, '+254');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    if (!formattedPhone.startsWith('+254')) {
      formattedPhone = '+254' + formattedPhone.replace(/^\+/, '');
    }

    logStep("Sending SMS notification", { to: formattedPhone });

    const isSandbox = AFRICASTALKING_USERNAME.toLowerCase() === "sandbox";
    const apiUrl = isSandbox 
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const formData = new URLSearchParams();
    formData.append("username", AFRICASTALKING_USERNAME);
    formData.append("to", formattedPhone);
    formData.append("message", message);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "apiKey": AFRICASTALKING_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: formData.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      logStep("SMS sending failed", { status: response.status, result });
      return { success: false, error: result.message || "Failed to send SMS" };
    }

    logStep("SMS sent successfully", { result });
    return { success: true };
  } catch (error: any) {
    logStep("SMS error", { error: error.message });
    return { success: false, error: error.message };
  }
}

async function sendWhatsappNotification(
  phoneNumber: string,
  tenantName: string,
  amount: number,
  propertyName: string,
  invoiceNumber: string,
  unit: string | undefined
): Promise<{ success: boolean; error?: string }> {
  const WHATSAPP_ACCESS_TOKEN = getEnv("WHATSAPP_ACCESS_TOKEN");
  const PHONE_NUMBER_ID = getEnv("PHONE_NUMBER_ID");
  
  if (!WHATSAPP_ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    logStep("WhatsApp skipped - Meta Business API not configured");
    return { success: false, error: "WhatsApp service not configured" };
  }

  const formattedAmount = formatCurrency(amount);
  const unitInfo = unit ? ` (Unit ${unit})` : "";
  const message = `💰 *Payment Received*\n\n${tenantName} paid ${formattedAmount} for ${propertyName}${unitInfo}.\n\nInvoice: ${invoiceNumber}`;

  try {
    let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/^0/, '+254');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    if (!formattedPhone.startsWith('+254')) {
      formattedPhone = '+254' + formattedPhone.replace(/^\+/, '');
    }
    formattedPhone = formattedPhone.replace('+', '');

    logStep("Sending WhatsApp notification", { to: formattedPhone });

    const response = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: {
          body: message
        }
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      logStep("WhatsApp sending failed", { status: response.status, result });
      return { success: false, error: result.message || "Failed to send WhatsApp" };
    }

    logStep("WhatsApp sent successfully", { result });
    return { success: true };
  } catch (error: any) {
    logStep("WhatsApp error", { error: error.message });
    return { success: false, error: error.message };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);


  try {
    logStep("Starting manager payment notification");

    // Auth check: require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = SUPABASE_URL;
    const supabaseServiceKey = SERVICE_KEY;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // process-payment (the internal payment pipeline) calls this with the
    // service-role key — trust that unconditionally. Any other caller must
    // be a real user JWT, verified below and then checked against the
    // target managerId's actual portfolio (see the ownership check further
    // down) — previously ANY authenticated user of ANY role could notify
    // ANY manager with fully attacker-controlled name/amount/invoice
    // fields (phishing/spam vector) and write a fabricated activity-log
    // entry against that manager's account.
    const isServiceCall = isServiceRoleRequest(req);
    let callerUserId: string | null = null;
    if (!isServiceCall) {
      const supabaseClient = createClient(
        supabaseUrl,
        SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      callerUserId = user.id;
    }

    const requestData: PaymentNotificationRequest = await req.json();

    const {
      managerId,
      tenantName,
      tenantEmail,
      propertyName,
      unit,
      invoiceNumber,
      amount,
      paymentDate,
      paymentMethod = "Online Payment",
      notifyEmail = true,
      notifySms = true,
      notifyWhatsapp = true,
    } = requestData;

    if (!managerId || !tenantName || !propertyName || !invoiceNumber || !amount) {
      logStep("Missing required fields", { managerId, tenantName, propertyName, invoiceNumber, amount });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!isServiceCall && callerUserId !== managerId) {
      // Caller isn't notifying about themselves and isn't the trusted
      // service pipeline — only allow a submanager acting for this
      // specific manager, or the tenant this notification is actually
      // about (their own manager). Anyone else gets 403.
      const [{ data: subRel }, { data: tenantRel }] = await Promise.all([
        supabaseAdmin
          .from("manager_submanagers")
          .select("manager_id")
          .eq("submanager_user_id", callerUserId)
          .eq("manager_id", managerId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_roles")
          .select("tenant_id, tenants!inner(manager_id)")
          .eq("user_id", callerUserId)
          .eq("tenants.manager_id", managerId)
          .limit(1),
      ]);
      if (!subRel && !tenantRel?.length) {
        logStep("Forbidden: caller has no relationship to managerId", { callerUserId, managerId });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    logStep("Fetching manager details", { managerId });

    // Get manager's contact details
    const { data: managerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, phone")
      .eq("id", managerId)
      .maybeSingle();

    if (profileError || !managerProfile?.email) {
      logStep("Failed to get manager profile", { error: profileError?.message });
      return new Response(JSON.stringify({ error: "Manager not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    logStep("Manager found", { 
      email: managerProfile.email, 
      name: managerProfile.full_name,
      hasPhone: !!managerProfile.phone 
    });

    const results: { email?: any; sms?: any; whatsapp?: any } = {};

    // Send Email Notification
    if (notifyEmail) {
      results.email = await sendEmailNotification(
        managerProfile.email,
        managerProfile.full_name || "Property Manager",
        tenantName,
        propertyName,
        unit,
        invoiceNumber,
        amount,
        paymentDate,
        paymentMethod
      );
    }

    // Send SMS Notification
    if (notifySms && managerProfile.phone) {
      results.sms = await sendSmsNotification(
        managerProfile.phone,
        tenantName,
        amount,
        propertyName,
        invoiceNumber
      );
    } else if (notifySms && !managerProfile.phone) {
      results.sms = { success: false, error: "Manager phone number not configured" };
    }

    // Send WhatsApp Notification
    if (notifyWhatsapp && managerProfile.phone) {
      results.whatsapp = await sendWhatsappNotification(
        managerProfile.phone,
        tenantName,
        amount,
        propertyName,
        invoiceNumber,
        unit
      );
    } else if (notifyWhatsapp && !managerProfile.phone) {
      results.whatsapp = { success: false, error: "Manager phone number not configured" };
    }

    // Log activity
    try {
      const { data: userData } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", managerId)
        .single();
      
      await supabaseAdmin.from("activity_logs").insert({
        user_id: managerId,
        user_email: userData?.email || "unknown",
        action: "payment_received",
        entity_type: "invoice",
        details: {
          amount: amount,
          tenant: tenantName,
          property: propertyName,
          description: `Payment of ${formatCurrency(amount)} received from ${tenantName} for ${propertyName}`
        },
      });
    } catch (logError) {
      logStep("Failed to log activity", { error: logError });
    }

    // Send push notification to manager
    try {
      const pushPayload = {
        userId: managerId,
        title: "💰 Payment Received!",
        body: `${tenantName} paid ${formatCurrency(amount)} for ${propertyName}`,
        url: "/billing",
        tag: `payment-${Date.now()}`,
      };
      
      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(pushPayload),
      });
      
      if (pushResponse.ok) {
        logStep("Push notification sent successfully");
      } else {
        const pushError = await pushResponse.text();
        logStep("Push notification failed", { error: pushError });
      }
    } catch (pushError) {
      logStep("Failed to send push notification", { error: pushError });
    }

    logStep("Notification process complete", results);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Error in notify-manager-payment", { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
