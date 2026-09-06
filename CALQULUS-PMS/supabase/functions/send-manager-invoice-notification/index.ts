import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { callerRelatesToManager, callerIsWebhost } from "../_shared/notifyAuthz.ts";
// Resend email client
const sendEmail = async (apiKey: string, to: string[], subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CALQULUS RMS <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }
  
  return await response.json();
};

interface InvoiceNotificationRequest {
  invoiceId?: string;
  managerUserId?: string;
  invoiceType?: 'registration' | 'subscription';
  amount?: number;
  dueDate?: string;
  notificationType: 'new_invoice' | 'payment_reminder' | 'payment_confirmed';
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
};

const getSiteUrl = () => (getEnv("SITE_URL", "https://www.calqulus.site")).replace(/\/+$/, "");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;


  try {
    logStep("Function started");

    const resendApiKey = getEnv("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseClient = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const body: InvoiceNotificationRequest = await req.json();
    const { invoiceId, managerUserId, invoiceType, amount, dueDate, notificationType } = body;

    logStep("Request body parsed", { invoiceId, managerUserId, notificationType });

    let managerEmail: string | null = null;
    let managerName: string | null = null;
    let resolvedManagerUserId: string | null = null;
    let invoiceNumber: string | null = null;
    let invoiceAmount: number = amount || 0;
    let invoiceDueDate: string = dueDate || '';
    let invoiceTypeLabel: string = invoiceType || 'subscription';
    let commissionRate: number = 0.01; // default 1%

    // If invoiceId is provided, fetch invoice details
    if (invoiceId) {
      const { data: invoice, error: invoiceError } = await supabaseClient
        .from("manager_invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invoiceError || !invoice) {
        throw new Error(`Invoice not found: ${invoiceError?.message}`);
      }

      invoiceNumber = invoice.invoice_number;
      invoiceAmount = invoice.amount;
      invoiceDueDate = invoice.due_date;
      invoiceTypeLabel = invoice.invoice_type || 'subscription';
      commissionRate = invoice.commission_rate || 0.01;

      // Get manager profile
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("email, full_name")
        .eq("id", invoice.manager_user_id)
        .single();

      if (profile) {
        managerEmail = profile.email;
        managerName = profile.full_name;
      }
      resolvedManagerUserId = invoice.manager_user_id;

      logStep("Invoice details fetched", { invoiceNumber, managerEmail });
    } else if (managerUserId) {
      // Get manager profile directly
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("email, full_name")
        .eq("id", managerUserId)
        .single();

      if (profile) {
        managerEmail = profile.email;
        managerName = profile.full_name;
      }
      resolvedManagerUserId = managerUserId;
    }

    if (!managerEmail) {
      throw new Error("Manager email not found");
    }

    // Previously any authenticated user could trigger a fabricated
    // "new_invoice"/"payment_reminder"/"payment_confirmed" email to any
    // manager. Only the manager themselves or a webhost (the two real
    // callers: ManagerPlatformBilling.tsx and ManagerInvoices.tsx) may
    // trigger this.
    if (gate.userId && resolvedManagerUserId) {
      const isSelf = gate.userId === resolvedManagerUserId;
      const isWebhost = !isSelf && (await callerIsWebhost(supabaseClient, gate.userId));
      if (!isSelf && !isWebhost) {
        logStep("Forbidden: caller is neither the manager nor a webhost", { callerUserId: gate.userId, resolvedManagerUserId });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    } else if (gate.userId && !resolvedManagerUserId) {
      // Neither invoiceId nor managerUserId resolved to a real manager —
      // reject rather than silently proceeding with untrusted body fields.
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Build email content based on notification type
    let subject = '';
    let htmlContent = '';

    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const greeting = managerName ? `Dear ${managerName}` : 'Dear Manager';
    const portalUrl = `${getSiteUrl()}/auth`;

    switch (notificationType) {
      case 'new_invoice':
        subject = invoiceTypeLabel === 'registration' 
          ? 'CALQULUS RMS: Registration Invoice Generated'
          : 'CALQULUS RMS: Monthly Subscription Invoice Generated';
        
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
              .invoice-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #8b5cf6; }
              .amount { font-size: 24px; font-weight: bold; color: #8b5cf6; }
              .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
              .footer { margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">New Invoice Generated</h1>
              </div>
              <div class="content">
                <p>${greeting},</p>
                <p>A new ${invoiceTypeLabel === 'registration' ? 'registration' : 'monthly subscription'} invoice has been generated for your account.</p>
                
                <div class="invoice-details">
                  ${invoiceNumber ? `<p><strong>Invoice Number:</strong> ${invoiceNumber}</p>` : ''}
                  <p><strong>Invoice Type:</strong> ${invoiceTypeLabel === 'registration' ? 'Registration Fee' : `Monthly Subscription (${(commissionRate * 100).toFixed(1)}% of collection)`}</p>
                  <p><strong>Amount Due:</strong> <span class="amount">KES ${invoiceAmount.toLocaleString()}</span></p>
                  <p><strong>Due Date:</strong> ${formatDate(invoiceDueDate)}</p>
                </div>
                
                <p>Please log in to your account to view the invoice details and make payment.</p>
                
                <a href="${portalUrl}" class="button">View Invoice</a>
                
                <div class="footer">
                  <p>If you have any questions, please contact support.</p>
                  <p>Thank you for using CALQULUS RMS!</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case 'payment_reminder':
        subject = `CALQULUS RMS: Payment Reminder - Invoice Due ${formatDate(invoiceDueDate)}`;
        
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
              .invoice-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b; }
              .amount { font-size: 24px; font-weight: bold; color: #f59e0b; }
              .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
              .footer { margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">⚠️ Payment Reminder</h1>
              </div>
              <div class="content">
                <p>${greeting},</p>
                <p>This is a friendly reminder that your invoice payment is due soon.</p>
                
                <div class="invoice-details">
                  ${invoiceNumber ? `<p><strong>Invoice Number:</strong> ${invoiceNumber}</p>` : ''}
                  <p><strong>Amount Due:</strong> <span class="amount">KES ${invoiceAmount.toLocaleString()}</span></p>
                  <p><strong>Due Date:</strong> ${formatDate(invoiceDueDate)}</p>
                </div>
                
                <p>Please make your payment before the due date to avoid service interruption.</p>
                
                <a href="${portalUrl}" class="button">Pay Now</a>
                
                <div class="footer">
                  <p>If you've already made this payment, please disregard this email.</p>
                  <p>Thank you for using CALQULUS RMS!</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case 'payment_confirmed':
        subject = 'CALQULUS RMS: Payment Confirmed - Thank You!';
        
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
              .invoice-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #10b981; }
              .amount { font-size: 24px; font-weight: bold; color: #10b981; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
              .footer { margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">✅ Payment Confirmed</h1>
              </div>
              <div class="content">
                <p>${greeting},</p>
                <p>We have received your payment. Thank you!</p>
                
                <div class="invoice-details">
                  ${invoiceNumber ? `<p><strong>Invoice Number:</strong> ${invoiceNumber}</p>` : ''}
                  <p><strong>Amount Paid:</strong> <span class="amount">KES ${invoiceAmount.toLocaleString()}</span></p>
                  <p><strong>Payment Date:</strong> ${formatDate(new Date().toISOString())}</p>
                </div>
                
                <p>Your account is now up to date. You can download your receipt from the billing dashboard.</p>
                
                <a href="${portalUrl}" class="button">View Receipt</a>
                
                <div class="footer">
                  <p>Thank you for your continued trust in CALQULUS RMS!</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      default:
        throw new Error(`Unknown notification type: ${notificationType}`);
    }

    logStep("Sending email", { to: managerEmail, subject });

    const emailResponse = await sendEmail(resendApiKey, [managerEmail], subject, htmlContent);

    logStep("Email sent successfully", { emailResponse });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email notification sent",
        emailId: emailResponse.id 
      }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
