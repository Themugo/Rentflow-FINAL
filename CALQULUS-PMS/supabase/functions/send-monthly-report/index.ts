import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { rejectUnlessServiceOrCron } from "../_shared/assertCaller.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface MonthlyReportData {
  totalRevenue: number;
  totalTransactions: number;
  mpesaPayments: number;
  cardPayments: number;
  topTenants: { name: string; amount: number }[];
  topProperties: { name: string; amount: number }[];
  monthlyTrend: { month: string; amount: number }[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") return preflightResponse(req);

  // No frontend code calls this directly — only the scheduled monthly cron
  // job. Previously any authenticated user could trigger a platform-wide
  // revenue/top-tenant report email (aggregating ALL managers' paid
  // invoices) to be sent out; lock to service-role/cron since no legitimate
  // user-JWT caller exists.
  const denied = rejectUnlessServiceOrCron(req);
  if (denied) return denied;


  try {

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get last month's date range
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const monthName = lastMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    // Fetch all paid invoices from last month
    const { data: invoices, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id,
        amount,
        paid_date,
        invoice_number,
        tenants (
          id,
          name,
          email,
          phone
        ),
        leases (
          property,
          unit
        )
      `)
      .eq("status", "paid")
      .gte("paid_date", lastMonth.toISOString().split("T")[0])
      .lte("paid_date", lastMonthEnd.toISOString().split("T")[0]);

    if (invoiceError) {
      console.error("Error fetching invoices:", invoiceError);
      throw invoiceError;
    }

    // Calculate report data
    const totalRevenue = invoices?.reduce(
      (sum: number, inv: any) => sum + Number(inv.amount),
      0
    ) || 0;
    const totalTransactions = invoices?.length || 0;
    const mpesaPayments =
      invoices?.filter((inv: any) => inv.tenants?.phone).length || 0;
    const cardPayments = totalTransactions - mpesaPayments;

    // Top tenants by payment amount
    const tenantPayments = new Map<string, number>();
    invoices?.forEach((inv: any) => {
      const tenantName = inv.tenants?.name || "Unknown";
      tenantPayments.set(
        tenantName,
        (tenantPayments.get(tenantName) || 0) + Number(inv.amount)
      );
    });
    const topTenants = Array.from(tenantPayments.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Top properties by revenue
    const propertyPayments = new Map<string, number>();
    invoices?.forEach((inv: any) => {
      const property = inv.leases?.property || "Unknown";
      propertyPayments.set(
        property,
        (propertyPayments.get(property) || 0) + Number(inv.amount)
      );
    });
    const topProperties = Array.from(propertyPayments.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Get managers to send report to
    const { data: managers, error: managersError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "manager");

    if (managersError) {
      console.error("Error fetching managers:", managersError);
      throw managersError;
    }

    // Get manager emails from profiles
    const managerEmails: string[] = [];
    for (const manager of managers || []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", manager.user_id)
        .single();

      if (profile?.email) {
        managerEmails.push(profile.email);
      }
    }

    // Generate HTML email
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Monthly Payment Report</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 16px;">${monthName}</p>
        </div>

        <!-- Summary Cards -->
        <div style="padding: 24px;">
          <h2 style="color: #18181b; font-size: 18px; margin: 0 0 16px 0;">Summary</h2>
          <div style="display: grid; gap: 12px;">
            <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Total Revenue</p>
              <p style="color: #18181b; font-size: 24px; font-weight: 700; margin: 4px 0 0 0;">KES ${totalRevenue.toLocaleString()}</p>
            </div>
            <div style="display: flex; gap: 12px;">
              <div style="flex: 1; background-color: #eff6ff; padding: 16px; border-radius: 8px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Transactions</p>
                <p style="color: #18181b; font-size: 20px; font-weight: 600; margin: 4px 0 0 0;">${totalTransactions}</p>
              </div>
              <div style="flex: 1; background-color: #f0fdf4; padding: 16px; border-radius: 8px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">M-Pesa</p>
                <p style="color: #10b981; font-size: 20px; font-weight: 600; margin: 4px 0 0 0;">${mpesaPayments}</p>
              </div>
              <div style="flex: 1; background-color: #faf5ff; padding: 16px; border-radius: 8px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Card/Other</p>
                <p style="color: #8b5cf6; font-size: 20px; font-weight: 600; margin: 4px 0 0 0;">${cardPayments}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Tenants -->
        ${topTenants.length > 0 ? `
        <div style="padding: 0 24px 24px;">
          <h2 style="color: #18181b; font-size: 18px; margin: 0 0 16px 0;">Top Paying Tenants</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f4f4f5;">
                <th style="text-align: left; padding: 12px; font-size: 12px; color: #6b7280; text-transform: uppercase;">Tenant</th>
                <th style="text-align: right; padding: 12px; font-size: 12px; color: #6b7280; text-transform: uppercase;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${topTenants
                .map(
                  (t, i) => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px; font-size: 14px; color: #18181b;">${i + 1}. ${t.name}</td>
                  <td style="padding: 12px; font-size: 14px; color: #10b981; font-weight: 600; text-align: right;">KES ${t.amount.toLocaleString()}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        ` : ""}

        <!-- Top Properties -->
        ${topProperties.length > 0 ? `
        <div style="padding: 0 24px 24px;">
          <h2 style="color: #18181b; font-size: 18px; margin: 0 0 16px 0;">Top Properties by Revenue</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f4f4f5;">
                <th style="text-align: left; padding: 12px; font-size: 12px; color: #6b7280; text-transform: uppercase;">Property</th>
                <th style="text-align: right; padding: 12px; font-size: 12px; color: #6b7280; text-transform: uppercase;">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${topProperties
                .map(
                  (p, i) => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 12px; font-size: 14px; color: #18181b;">${i + 1}. ${p.name}</td>
                  <td style="padding: 12px; font-size: 14px; color: #3b82f6; font-weight: 600; text-align: right;">KES ${p.amount.toLocaleString()}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        ` : ""}

        <!-- Footer -->
        <div style="background-color: #f4f4f5; padding: 24px; text-align: center;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This is an automated monthly report from CALQULUS RMS Property Management.
          </p>
          <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">
            Generated on ${new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Send email to all managers
    for (const email of managerEmails) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "CALQULUS RMS <onboarding@resend.dev>",
            to: [email],
            subject: `Monthly Payment Report - ${monthName}`,
            html: emailHtml,
          }),
        });
      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Monthly report sent to ${managerEmails.length} managers`,
        data: {
          month: monthName,
          totalRevenue,
          totalTransactions,
          recipientCount: managerEmails.length,
        },
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error generating monthly report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
