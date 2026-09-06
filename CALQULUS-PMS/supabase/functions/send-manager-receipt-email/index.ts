import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { serve } from "std/http/server.ts";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { createClient } from "supabase/supabase-js@2";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { callerIsWebhost } from "../_shared/notifyAuthz.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
};

interface ReceiptEmailRequest {
  email: string;
  managerName: string;
  receiptNumber: string;
  invoiceNumber: string;
  amount: string;
  description: string;
  paidDate: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;


  try {
    logStep("Function started");

    const { email, managerName, receiptNumber, invoiceNumber, amount, description, paidDate }: ReceiptEmailRequest = await req.json();

    // The real caller (ManagerPlatformBilling.tsx) always sends this to the
    // manager's OWN profile email. Previously any authenticated user could
    // pass an arbitrary `email` here to send a fabricated platform-billing
    // receipt to any address — require self-send or webhost.
    if (gate.userId) {
      const supabaseAdmin = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", gate.userId)
        .maybeSingle();
      const isSelf = !!callerProfile?.email && callerProfile.email.toLowerCase() === String(email).toLowerCase();
      if (!isSelf && !(await callerIsWebhost(supabaseAdmin, gate.userId))) {
        logStep("Forbidden: caller is not sending to own email and is not webhost", { callerUserId: gate.userId, email });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const rateOk = await checkRateLimit(supabaseAdmin, gate.userId, "send-manager-receipt-email", 60, { failClosed: true });
      if (!rateOk) return rateLimitResponse(req);
    }

    logStep("Sending receipt email", { email, receiptNumber });

    const RESEND_API_KEY = getEnv("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CALQULUS RMS <notifications@resend.dev>",
        to: [email],
        subject: `Payment Receipt ${receiptNumber} - CALQULUS RMS`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .receipt-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
              .amount { font-size: 28px; font-weight: bold; color: #10b981; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
              .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
              .label { color: #6b7280; }
              .value { font-weight: 500; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">✓ Payment Received</h1>
                <p style="margin: 10px 0 0;">Thank you for your payment!</p>
              </div>
              <div class="content">
                <p>Dear ${managerName || 'Valued Customer'},</p>
                <p>We have successfully received your payment. Here are your receipt details:</p>
                
                <div class="receipt-box">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <div class="amount">${amount}</div>
                    <div style="color: #10b981;">Payment Successful</div>
                  </div>
                  
                  <div class="row">
                    <span class="label">Receipt Number</span>
                    <span class="value">${receiptNumber}</span>
                  </div>
                  <div class="row">
                    <span class="label">Original Invoice</span>
                    <span class="value">${invoiceNumber}</span>
                  </div>
                  <div class="row">
                    <span class="label">Description</span>
                    <span class="value">${description}</span>
                  </div>
                  <div class="row">
                    <span class="label">Payment Date</span>
                    <span class="value">${paidDate}</span>
                  </div>
                </div>
                
                <p>This receipt is automatically generated and serves as confirmation of your payment.</p>
              </div>
              <div class="footer">
                <p>CALQULUS RMS - Property Management Platform</p>
                <p>This is an automated message. Please do not reply directly to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const result = await emailResponse.json();
    logStep("Email sent successfully", { result });

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
