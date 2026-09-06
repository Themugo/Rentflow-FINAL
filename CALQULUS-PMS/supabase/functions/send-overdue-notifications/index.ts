import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv, getEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { checkRoleAccess } from "../_shared/authorization.ts";
import { callerIsWebhost } from "../_shared/notifyAuthz.ts";

const RESEND_API_KEY = getEnv("RESEND_API_KEY");
const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string | null;
  property: string | null;
  unit: string | null;
  days_overdue: number;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;


  try {

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      throw new Error("Email service is not configured");
    }

    // Create Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Previously ANY authenticated user could trigger this platform-wide job,
    // which queried ALL overdue invoices with no manager scoping — meaning a
    // single manager clicking "Send Overdue Notifications" would email/SMS
    // every overdue tenant across every OTHER manager's portfolio too. Require
    // an approved manager/submanager/webhost role, and — unless the caller is
    // a webhost (platform-wide is expected there) or cron — scope the run to
    // just the calling manager's own tenants.
    let scopeManagerId: string | null = null;
    if (gate.userId) {
      const access = await checkRoleAccess(gate.userId, ["manager", "submanager", "webhost"]);
      if (!access.allowed) {
        return new Response(JSON.stringify({ error: access.error ?? "Forbidden" }), {
          status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const isWebhost = await callerIsWebhost(supabase, gate.userId);
      if (!isWebhost) {
        const { data: subRel } = await supabase
          .from("manager_submanagers")
          .select("manager_id")
          .eq("submanager_user_id", gate.userId)
          .maybeSingle();
        scopeManagerId = subRel?.manager_id ?? gate.userId;
      }
    }

    // Get company settings for email branding
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name, email, phone")
      .maybeSingle();

    const companyName = companySettings?.company_name || "CALQULUS RMS Properties";
    const companyEmail = companySettings?.email || "";
    const companyPhone = companySettings?.phone || "";

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate the date that's 1 day ago (for 1+ day overdue logic)
    const oneDayAgo = new Date(today);
    oneDayAgo.setDate(today.getDate() - 1);
    const oneDayAgoStr = oneDayAgo.toISOString().split("T")[0];

    // Fetch overdue invoices: due date is more than 1 day ago
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        amount,
        due_date,
        tenant_id
      `)
      .in("status", ["pending", "overdue"])
      .lt("due_date", oneDayAgoStr); // Only invoices with due date more than 1 day ago

    if (invoicesError) {
      console.error("Error fetching overdue invoices:", invoicesError);
      throw invoicesError;
    }

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No overdue invoices", sent: 0 }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get tenant details
    const tenantIds = [...new Set(invoices.map((inv) => inv.tenant_id).filter(Boolean))];
    
    let tenantsQuery = supabase
      .from("tenants")
      .select("id, name, email, phone, property, unit")
      .in("id", tenantIds);
    if (scopeManagerId) {
      tenantsQuery = tenantsQuery.eq("manager_id", scopeManagerId);
    }
    const { data: tenants } = await tenantsQuery;

    const tenantMap = new Map(tenants?.map((t) => [t.id, t]) || []);

    // Prepare overdue invoice data with tenant info
    const overdueInvoices: OverdueInvoice[] = invoices
      .filter((inv) => inv.tenant_id && tenantMap.has(inv.tenant_id))
      .map((inv) => {
        const tenant = tenantMap.get(inv.tenant_id)!;
        const dueDate = new Date(inv.due_date);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          amount: inv.amount,
          due_date: inv.due_date,
          tenant_id: inv.tenant_id,
          tenant_name: tenant.name,
          tenant_email: tenant.email,
          tenant_phone: tenant.phone,
          property: tenant.property,
          unit: tenant.unit,
          days_overdue: daysOverdue,
        };
      });

    let emailSentCount = 0;
    let smsSentCount = 0;
    const errors: string[] = [];

    // Send notifications for each overdue invoice
    for (const invoice of overdueInvoices) {
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
      };

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      };

      // Send email notification
      try {

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${companyName} <onboarding@resend.dev>`,
            to: [invoice.tenant_email],
            subject: `Payment Overdue - Invoice ${invoice.invoice_number}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                  .container { max-width: 600px; margin: 0 auto; }
                  .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
                  .content { padding: 30px; background-color: #f9fafb; }
                  .invoice-box { background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
                  .amount { font-size: 28px; font-weight: bold; color: #dc2626; }
                  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background-color: #f3f4f6; }
                  .btn { display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
                  .warning { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>⚠️ Payment Overdue</h1>
                  </div>
                  <div class="content">
                    <p>Dear ${invoice.tenant_name},</p>
                    
                    <div class="warning">
                      <strong>Your payment is ${invoice.days_overdue} day${invoice.days_overdue > 1 ? "s" : ""} overdue.</strong>
                      <p style="margin: 5px 0 0 0;">Please make payment as soon as possible to avoid late fees.</p>
                    </div>

                    <div class="invoice-box">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
                          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${invoice.invoice_number}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666;">Property:</td>
                          <td style="padding: 8px 0; text-align: right;">${invoice.property || "N/A"}${invoice.unit ? ` - ${invoice.unit}` : ""}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #666;">Due Date:</td>
                          <td style="padding: 8px 0; text-align: right; color: #dc2626;">${formatDate(invoice.due_date)}</td>
                        </tr>
                        <tr style="border-top: 2px solid #e5e7eb;">
                          <td style="padding: 15px 0; font-weight: bold;">Amount Due:</td>
                          <td style="padding: 15px 0; text-align: right;" class="amount">${formatCurrency(invoice.amount)}</td>
                        </tr>
                      </table>
                    </div>

                    <p>If you have already made this payment, please disregard this notice. If you have any questions or need to discuss payment arrangements, please contact us immediately.</p>

                    <p>Best regards,<br><strong>${companyName}</strong></p>
                    ${companyPhone ? `<p style="color: #666; font-size: 14px;">Phone: ${companyPhone}</p>` : ""}
                    ${companyEmail ? `<p style="color: #666; font-size: 14px;">Email: ${companyEmail}</p>` : ""}
                  </div>
                  <div class="footer">
                    <p>This is an automated reminder from ${companyName}.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          }),
        });

        const responseData = await emailResponse.json();

        if (!emailResponse.ok) {
          console.error(`Failed to send email for invoice ${invoice.invoice_number}:`, responseData);
          errors.push(`Email ${invoice.invoice_number}: ${responseData.message || "Unknown error"}`);
        } else {
          emailSentCount++;
        }
      } catch (emailError: any) {
        console.error(`Error sending email for invoice ${invoice.invoice_number}:`, emailError);
        errors.push(`Email ${invoice.invoice_number}: ${emailError.message}`);
      }

      // Send SMS notification if phone number exists
      if (invoice.tenant_phone) {
        try {

          const smsMessage = `${companyName}: OVERDUE - Invoice ${invoice.invoice_number} for ${formatCurrency(invoice.amount)} was due ${formatDate(invoice.due_date)} (${invoice.days_overdue} days ago). Please pay immediately.`;

          const smsResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/send-sms-notification`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                phoneNumber: invoice.tenant_phone,
                message: smsMessage,
              }),
            }
          );

          const smsResult = await smsResponse.json();

          if (smsResult.success) {
            smsSentCount++;
          } else {
            console.error(`Failed to send SMS for invoice ${invoice.invoice_number}:`, smsResult.error);
            errors.push(`SMS ${invoice.invoice_number}: ${smsResult.error}`);
          }
        } catch (smsError: any) {
          console.error(`Error sending SMS for invoice ${invoice.invoice_number}:`, smsError);
          errors.push(`SMS ${invoice.invoice_number}: ${smsError.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${emailSentCount} emails and ${smsSentCount} SMS notifications`,
        emailsSent: emailSentCount,
        smsSent: smsSentCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in overdue notification job:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
