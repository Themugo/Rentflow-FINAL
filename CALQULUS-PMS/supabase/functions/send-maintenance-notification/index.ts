import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { identifyUserServiceOrCron } from "../_shared/assertCaller.ts";
import { callerRelatesToManager } from "../_shared/notifyAuthz.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

interface MaintenanceNotificationRequest {
  requestId: string;
  type: "created" | "updated" | "status_changed" | "assigned";
  oldStatus?: string;
  newStatus?: string;
  assignedTo?: string;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
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

  const gate = await identifyUserServiceOrCron(req);
  if (!gate.ok) return gate.response;


  try {
    const { requestId, type, oldStatus, newStatus, assignedTo }: MaintenanceNotificationRequest = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "Request ID is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Fetch the maintenance request
    const { data: request, error: requestError } = await supabaseAdmin
      .from("maintenance_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      console.error("Failed to fetch maintenance request:", requestError);
      return new Response(
        JSON.stringify({ error: "Maintenance request not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Previously any authenticated user could supply an arbitrary requestId
    // (belonging to someone else entirely) with a chosen `type`/`assignedTo`
    // to phish that request's real tenant/manager. Require the caller be
    // the tenant this request belongs to (by email — the table has no
    // tenant_id column) or relate to its manager.
    if (gate.userId) {
      let authorized = false;
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", gate.userId)
        .maybeSingle();
      if (callerProfile?.email && request.tenant_email &&
          callerProfile.email.toLowerCase() === String(request.tenant_email).toLowerCase()) {
        authorized = true;
      }
      if (!authorized && request.manager_id) {
        authorized = await callerRelatesToManager(supabaseAdmin, gate.userId, request.manager_id);
      }
      if (!authorized) {
        console.error("Forbidden: caller has no relationship to maintenance request", { callerUserId: gate.userId, requestId });
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      const rateOk = await checkRateLimit(supabaseAdmin, gate.userId, "send-maintenance-notification", 60, { failClosed: true });
      if (!rateOk) return rateLimitResponse(req);
    }

    // Get manager info if manager_id exists
    let managerEmail: string | null = null;
    let managerName = "Property Manager";
    
    if (request.manager_id) {
      const { data: managerProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", request.manager_id)
        .single();
      
      if (managerProfile) {
        managerEmail = managerProfile.email;
        managerName = managerProfile.full_name || "Property Manager";
      }
    }

    const safeTitle = escapeHtml(request.title);
    const safeDescription = escapeHtml(request.description || "");
    const safeProperty = escapeHtml(request.property_name || "");
    const safeUnit = request.unit_number ? escapeHtml(request.unit_number) : null;
    const safeTenantName = escapeHtml(request.tenant_name || "");
    const priorityLabel = getPriorityLabel(request.priority);
    const statusLabel = getStatusLabel(request.status);

    const emailsSent: string[] = [];

    // Base email template
    const buildEmailHtml = (recipientType: "tenant" | "manager", message: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a365d 0%, #2d4a7c 100%); color: white; padding: 25px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 22px; }
          .content { padding: 25px 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
          .info-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #64748b; font-size: 13px; width: 120px; }
          .info-value { color: #1e293b; font-weight: 500; flex: 1; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
          .status-open { background: #fef3c7; color: #92400e; }
          .status-in_progress { background: #dbeafe; color: #1e40af; }
          .status-completed { background: #d1fae5; color: #065f46; }
          .status-cancelled { background: #fee2e2; color: #991b1b; }
          .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px; }
          .priority-low { background: #f1f5f9; color: #475569; }
          .priority-medium { background: #fef3c7; color: #92400e; }
          .priority-high { background: #fed7aa; color: #c2410c; }
          .priority-urgent { background: #fee2e2; color: #991b1b; }
          .message-box { background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔧 Maintenance Request Update</h1>
          </div>
          <div class="content">
            <div class="message-box">
              <p style="margin: 0; color: #1e40af;">${message}</p>
            </div>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Title</span>
                <span class="info-value">${safeTitle}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status</span>
                <span class="info-value">
                  <span class="status-badge status-${request.status}">${statusLabel}</span>
                  <span class="priority-badge priority-${request.priority}">${priorityLabel}</span>
                </span>
              </div>
              <div class="info-row">
                <span class="info-label">Property</span>
                <span class="info-value">${safeProperty}${safeUnit ? ` - Unit ${safeUnit}` : ""}</span>
              </div>
              ${recipientType === "manager" ? `
              <div class="info-row">
                <span class="info-label">Tenant</span>
                <span class="info-value">${safeTenantName} (${escapeHtml(request.tenant_email || "")})</span>
              </div>
              ` : ""}
              ${request.assigned_to ? `
              <div class="info-row">
                <span class="info-label">Assigned To</span>
                <span class="info-value">${escapeHtml(request.assigned_to)}</span>
              </div>
              ` : ""}
              <div class="info-row">
                <span class="info-label">Description</span>
                <span class="info-value">${safeDescription}</span>
              </div>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">
              ${recipientType === "tenant" 
                ? "You can track the status of your request in your tenant portal." 
                : "Log in to the manager dashboard to view and manage this request."}
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from CALQULUS RMS.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Determine notification messages based on type
    let tenantMessage = "";
    let managerMessage = "";
    let tenantSubject = "";
    let managerSubject = "";

    switch (type) {
      case "created":
        tenantMessage = "Your maintenance request has been submitted successfully. We'll update you on its progress.";
        managerMessage = `A new maintenance request has been submitted by ${safeTenantName}.`;
        tenantSubject = `Maintenance Request Submitted: ${safeTitle}`;
        managerSubject = `New Maintenance Request: ${safeTitle}`;
        break;
      
      case "status_changed":
        if (newStatus === "completed") {
          tenantMessage = "Great news! Your maintenance request has been marked as completed.";
          managerMessage = `Maintenance request "${safeTitle}" has been completed.`;
        } else if (newStatus === "in_progress") {
          tenantMessage = "Your maintenance request is now being worked on.";
          managerMessage = `Maintenance request "${safeTitle}" is now in progress.`;
        } else if (newStatus === "cancelled") {
          tenantMessage = "Your maintenance request has been cancelled. Please contact your property manager if you have questions.";
          managerMessage = `Maintenance request "${safeTitle}" has been cancelled.`;
        } else {
          tenantMessage = `Your maintenance request status has been updated to: ${getStatusLabel(newStatus || request.status)}`;
          managerMessage = `Maintenance request "${safeTitle}" status changed from ${getStatusLabel(oldStatus || "")} to ${getStatusLabel(newStatus || request.status)}.`;
        }
        tenantSubject = `Maintenance Update: ${safeTitle} - ${getStatusLabel(newStatus || request.status)}`;
        managerSubject = `Maintenance Status Changed: ${safeTitle}`;
        break;
      
      case "assigned":
        tenantMessage = `Your maintenance request has been assigned to ${escapeHtml(assignedTo || request.assigned_to || "a technician")}. They will contact you soon.`;
        managerMessage = `Maintenance request "${safeTitle}" has been assigned to ${escapeHtml(assignedTo || request.assigned_to || "")}.`;
        tenantSubject = `Maintenance Request Assigned: ${safeTitle}`;
        managerSubject = `Maintenance Assigned: ${safeTitle}`;
        break;
      
      default:
        tenantMessage = "There's been an update to your maintenance request.";
        managerMessage = `Maintenance request "${safeTitle}" has been updated.`;
        tenantSubject = `Maintenance Update: ${safeTitle}`;
        managerSubject = `Maintenance Update: ${safeTitle}`;
    }

    // Send email to tenant
    if (request.tenant_email) {
      const tenantHtml = buildEmailHtml("tenant", tenantMessage);
      const sent = await sendEmail(request.tenant_email, tenantSubject, tenantHtml);
      if (sent) emailsSent.push(request.tenant_email);
    }

    // Send email to manager
    if (managerEmail && type === "created") {
      // Only notify manager on creation - they handle their own updates
      const managerHtml = buildEmailHtml("manager", managerMessage);
      const sent = await sendEmail(managerEmail, managerSubject, managerHtml);
      if (sent) emailsSent.push(managerEmail);
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        type,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-maintenance-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
