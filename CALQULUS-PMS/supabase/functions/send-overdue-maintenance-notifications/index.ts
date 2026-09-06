import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { rejectUnlessServiceOrCron } from "../_shared/assertCaller.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };
  return labels[priority] || priority;
}

async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  fromName: string = "CALQULUS RMS"
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured, skipping email");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <onboarding@resend.dev>`,
        to: [to],
        subject,
        html: htmlContent,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to send email:", data);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  // No frontend code calls this directly — only the scheduled cron job
  // (supabase/migrations/20260506000015_scheduled_jobs.sql). Previously any
  // authenticated user could trigger platform-wide maintenance-overdue
  // emails to every property's contacts; lock to service-role/cron since no
  // legitimate user-JWT caller exists.
  const denied = rejectUnlessServiceOrCron(req);
  if (denied) return denied;


  try {
    const supabaseAdmin = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    // Fetch overdue maintenance requests (open or in_progress with past due date)
    const { data: overdueRequests, error: fetchError } = await supabaseAdmin
      .from("maintenance_requests")
      .select("*")
      .in("status", ["open", "in_progress"])
      .lt("expected_completion_date", todayStr)
      .not("expected_completion_date", "is", null);

    if (fetchError) {
      console.error("Failed to fetch overdue requests:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch overdue requests" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!overdueRequests || overdueRequests.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No overdue requests found", emailsSent: 0 }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Group requests by manager
    const requestsByManager: Record<string, typeof overdueRequests> = {};
    
    for (const request of overdueRequests) {
      const managerId = request.manager_id || "unknown";
      if (!requestsByManager[managerId]) {
        requestsByManager[managerId] = [];
      }
      requestsByManager[managerId].push(request);
    }

    let totalEmailsSent = 0;
    const emailResults: { managerId: string; email: string; requestCount: number }[] = [];

    // Send consolidated email to each manager
    for (const [managerId, requests] of Object.entries(requestsByManager)) {
      if (managerId === "unknown") continue;

      // Get manager email
      const { data: managerProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", managerId)
        .single();

      if (!managerProfile?.email) continue;

      const managerName = managerProfile.full_name || "Property Manager";
      const requestCount = requests.length;

      // Build request table rows
      const tableRows = requests.map((req) => {
        const dueDate = new Date(req.expected_completion_date);
        const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(req.title)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(req.property_name)}${req.unit_number ? ` - Unit ${escapeHtml(req.unit_number)}` : ""}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
              <span style="background: ${req.priority === 'urgent' ? '#fee2e2' : req.priority === 'high' ? '#fed7aa' : '#fef3c7'}; color: ${req.priority === 'urgent' ? '#991b1b' : req.priority === 'high' ? '#c2410c' : '#92400e'}; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${getPriorityLabel(req.priority)}</span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: 600;">${daysOverdue} day(s)</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${req.assigned_to ? escapeHtml(req.assigned_to) : '<span style="color: #6b7280;">Unassigned</span>'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${req.budget ? `KES ${req.budget.toLocaleString()}` : '-'}</td>
          </tr>
        `;
      }).join("");

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 25px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { padding: 25px 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
            .alert-box { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; }
            .stats-grid { display: flex; gap: 16px; margin: 20px 0; }
            .stat-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
            .stat-value { font-size: 28px; font-weight: bold; color: #dc2626; }
            .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #1e293b; color: white; padding: 12px 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Overdue Maintenance Alert</h1>
            </div>
            <div class="content">
              <p>Hi ${escapeHtml(managerName)},</p>
              
              <div class="alert-box">
                <p style="margin: 0; color: #991b1b; font-weight: 600;">
                  You have ${requestCount} maintenance request${requestCount > 1 ? 's' : ''} that ${requestCount > 1 ? 'are' : 'is'} past the expected completion date.
                </p>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Property</th>
                    <th>Priority</th>
                    <th>Overdue By</th>
                    <th>Assigned To</th>
                    <th>Budget</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>

              <p style="margin-top: 24px; color: #64748b;">
                Please review these requests and take appropriate action to ensure tenant satisfaction.
              </p>
              
              <p style="margin-top: 16px;">
                <a href="#" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View in Dashboard</a>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated notification from CALQULUS RMS. You received this because you have overdue maintenance requests.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const sent = await sendEmail(
        managerProfile.email,
        `⚠️ ${requestCount} Overdue Maintenance Request${requestCount > 1 ? 's' : ''} Require Attention`,
        htmlContent
      );

      if (sent) {
        totalEmailsSent++;
        emailResults.push({
          managerId,
          email: managerProfile.email,
          requestCount,
        });
      }

      // Also notify assigned technicians if they have email
      for (const request of requests) {
        if (request.assigned_to && request.tenant_email) {
          // For simplicity, we're not sending to technicians as we don't have their email
          // But we could add a technicians table in the future
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        overdueCount: overdueRequests.length,
        emailsSent: totalEmailsSent,
        details: emailResults,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-overdue-maintenance-notifications:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
