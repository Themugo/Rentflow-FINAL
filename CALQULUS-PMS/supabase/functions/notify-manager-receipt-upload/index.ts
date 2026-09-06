import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");
const AFRICASTALKING_API_KEY = getEnv("AFRICASTALKING_API_KEY");
const AFRICASTALKING_USERNAME = getEnv("AFRICASTALKING_USERNAME");

const logStep = (step: string, details?: Record<string, unknown>) => {
};

interface ReceiptNotificationRequest {
  managerId: string;
  tenantName: string;
  tenantEmail: string;
  propertyName: string;
  unit?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
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

const paymentMethodLabels: Record<string, string> = {
  mpesa_paybill: 'M-Pesa Paybill',
  mpesa_till: 'M-Pesa Till',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

async function sendEmailNotification(
  managerEmail: string,
  managerName: string,
  tenantName: string,
  propertyName: string,
  unit: string | undefined,
  amount: number,
  paymentDate: string,
  paymentMethod: string,
  referenceNumber: string | undefined
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    logStep("Email skipped - RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  const safeTenantName = escapeHtml(tenantName);
  const safePropertyName = escapeHtml(propertyName);
  const safeUnit = unit ? escapeHtml(unit) : "";
  const safeManagerName = escapeHtml(managerName);
  const safePaymentMethod = paymentMethodLabels[paymentMethod] || escapeHtml(paymentMethod);

  const formattedAmount = formatCurrency(amount);
  const formattedDate = new Date(paymentDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
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
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">📧 New Receipt Uploaded</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #333; margin-top: 0;">Hi ${safeManagerName}!</h2>
        
        <p style="color: #555; font-size: 16px;">
          A tenant has uploaded a payment receipt that needs your verification.
        </p>
        
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
          <p style="color: #92400e; font-size: 14px; margin: 0 0 5px 0;">Amount</p>
          <p style="color: #78350f; font-size: 36px; font-weight: bold; margin: 0;">${formattedAmount}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Receipt Details</h3>
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
              <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #e5e7eb;">Payment Method:</td>
              <td style="padding: 10px 0; color: #333; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${safePaymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #666; border-bottom: 1px solid #e5e7eb;">Payment Date:</td>
              <td style="padding: 10px 0; color: #333; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
            </tr>
            ${referenceNumber ? `
            <tr>
              <td style="padding: 10px 0; color: #666;">Reference:</td>
              <td style="padding: 10px 0; color: #333; font-weight: 600; font-family: monospace;">${escapeHtml(referenceNumber)}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="background: #fff7ed; border: 1px solid #fed7aa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #c2410c; margin: 0; font-size: 14px;">
            ⏳ <strong>Action Required:</strong> Please log in to your dashboard to verify this receipt.
          </p>
        </div>
        
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
        subject: `📧 New Receipt: ${safeTenantName} uploaded ${formattedAmount} payment proof`,
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
  propertyName: string
): Promise<{ success: boolean; error?: string }> {
  if (!AFRICASTALKING_API_KEY || !AFRICASTALKING_USERNAME) {
    logStep("SMS skipped - Africa's Talking credentials not configured");
    return { success: false, error: "SMS service not configured" };
  }

  const formattedAmount = formatCurrency(amount);
  const message = `CALQULUS RMS: ${tenantName} uploaded a receipt for ${formattedAmount} (${propertyName}). Please verify in your dashboard.`;

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

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);


  try {
    logStep("Starting manager receipt notification");

    // Auth check: require authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseClient = createClient(
      supabaseUrl,
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

    const requestData: ReceiptNotificationRequest = await req.json();

    const {
      managerId,
      tenantName,
      tenantEmail,
      propertyName,
      unit,
      amount,
      paymentDate,
      paymentMethod,
      referenceNumber,
    } = requestData;

    if (!managerId || !tenantName || !propertyName || !amount) {
      logStep("Missing required fields", { managerId, tenantName, propertyName, amount });
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Only the manager themselves, one of their submanagers, or one of
    // their own tenants (the real ReceiptUpload.tsx flow this function is
    // built for) may trigger a notification to this managerId — otherwise
    // any authenticated user of any role could spam/phish an arbitrary
    // manager with fully attacker-controlled content and trigger a fake
    // push notification against their account.
    if (user.id !== managerId) {
      const [{ data: subRel }, { data: tenantRel }] = await Promise.all([
        supabaseAdmin
          .from("manager_submanagers")
          .select("manager_id")
          .eq("submanager_user_id", user.id)
          .eq("manager_id", managerId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_roles")
          .select("tenant_id, tenants!inner(manager_id)")
          .eq("user_id", user.id)
          .eq("tenants.manager_id", managerId)
          .limit(1),
      ]);
      if (!subRel && !tenantRel?.length) {
        logStep("Forbidden: caller has no relationship to managerId", { callerUserId: user.id, managerId });
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

    const results: { email?: any; sms?: any } = {};

    // Send Email Notification
    results.email = await sendEmailNotification(
      managerProfile.email,
      managerProfile.full_name || "Property Manager",
      tenantName,
      propertyName,
      unit,
      amount,
      paymentDate,
      paymentMethod,
      referenceNumber
    );

    // Send SMS Notification if phone available
    if (managerProfile.phone) {
      results.sms = await sendSmsNotification(
        managerProfile.phone,
        tenantName,
        amount,
        propertyName
      );
    }

    // Send push notification to manager
    try {
      const pushPayload = {
        userId: managerId,
        title: "📧 New Receipt Uploaded",
        body: `${tenantName} uploaded a ${formatCurrency(amount)} payment receipt`,
        url: "/billing?tab=verify",
        tag: `receipt-${Date.now()}`,
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
    logStep("Error in notify-manager-receipt-upload", { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
