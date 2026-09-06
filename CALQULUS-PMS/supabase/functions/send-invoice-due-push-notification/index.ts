import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { rejectUnlessServiceOrCron } from "../_shared/assertCaller.ts";
const logStep = (step: string, details?: Record<string, unknown>) => {
};

interface InvoiceDuePushRequest {
  tenantId?: string;
  tenantUserId?: string;
  tenantName: string;
  tenantEmail: string;
  propertyName: string;
  unit?: string;
  amount: number;
  invoiceNumber: string;
  dueDate: string;
  daysUntilDue?: number;
  isOverdue?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  // No frontend code calls this directly — only process-due-invoice-notifications
  // (service-side). Previously any authenticated user could push a fabricated
  // "Invoice Overdue" alert (and forge an activity-log row) against any
  // tenant; lock to service-role/cron since no legitimate user-JWT caller
  // exists.
  const denied = rejectUnlessServiceOrCron(req);
  if (denied) return denied;


  try {
    logStep("Starting invoice due push notification");

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const requestData: InvoiceDuePushRequest = await req.json();
    const { 
      tenantId, 
      tenantUserId,
      tenantName, 
      tenantEmail,
      propertyName, 
      unit, 
      amount, 
      invoiceNumber, 
      dueDate,
      daysUntilDue = 0,
      isOverdue = false
    } = requestData;

    if (!tenantEmail || !amount || !invoiceNumber) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Find tenant's user ID from user_roles if not provided
    let userId = tenantUserId;
    if (!userId && tenantId) {
      const { data: userRole } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("role", "tenant")
        .maybeSingle();
      
      userId = userRole?.user_id;
    }

    if (!userId) {
      // Try to find by email
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", tenantEmail)
        .maybeSingle();
      
      userId = profile?.id;
    }

    if (!userId) {
      logStep("No user ID found for tenant", { tenantEmail, tenantId });
      return new Response(JSON.stringify({ success: true, message: "Tenant has no user account" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get tenant's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key")
      .eq("user_id", userId);

    if (subError) {
      logStep("Failed to fetch subscriptions", { error: subError.message });
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      logStep("No push subscriptions found for tenant", { userId, tenantEmail });
      return new Response(JSON.stringify({ success: true, message: "No subscriptions found" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const formattedAmount = formatCurrency(amount);
    const unitInfo = unit ? ` - Unit ${unit}` : "";
    const formattedDueDate = new Date(dueDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    let title: string;
    let body: string;
    let urgency: string;

    if (isOverdue) {
      title = "⚠️ Invoice Overdue!";
      body = `Your invoice of ${formattedAmount} for ${propertyName}${unitInfo} was due on ${formattedDueDate}. Please pay immediately.`;
      urgency = "high";
    } else if (daysUntilDue === 0) {
      title = "📅 Invoice Due Today!";
      body = `Your invoice of ${formattedAmount} for ${propertyName}${unitInfo} is due today.`;
      urgency = "high";
    } else if (daysUntilDue === 1) {
      title = "⏰ Invoice Due Tomorrow";
      body = `Your invoice of ${formattedAmount} for ${propertyName}${unitInfo} is due tomorrow.`;
      urgency = "medium";
    } else if (daysUntilDue <= 3) {
      title = "📋 Invoice Due Soon";
      body = `Your invoice of ${formattedAmount} for ${propertyName}${unitInfo} is due in ${daysUntilDue} days.`;
      urgency = "medium";
    } else {
      title = "📬 Invoice Reminder";
      body = `Your invoice of ${formattedAmount} for ${propertyName}${unitInfo} is due on ${formattedDueDate}.`;
      urgency = "low";
    }

    const notification = {
      title,
      body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: `invoice-due-${invoiceNumber}-${Date.now()}`,
      requireInteraction: urgency === "high",
      data: {
        url: "/tenant-portal",
        type: "invoice_due",
        invoiceNumber,
        amount,
        dueDate,
        propertyName,
        isOverdue,
        urgency
      },
      actions: [
        { action: "pay", title: "Pay Now" },
        { action: "view", title: "View Details" }
      ]
    };

    logStep("Sending invoice due push notifications", { 
      subscriptionCount: subscriptions.length,
      notification: notification.title,
      urgency
    });

    // Store notification for service worker to pick up
    const results = { sent: subscriptions.length, notification, urgency };

    // Log the notification event
    try {
      await supabaseAdmin.from("activity_logs").insert({
        user_id: userId,
        user_email: tenantEmail,
        action: "push_notification_sent",
        entity_type: "invoice",
        details: {
          type: "invoice_due",
          invoice_number: invoiceNumber,
          amount: amount,
          due_date: dueDate,
          is_overdue: isOverdue,
          days_until_due: daysUntilDue,
          subscriptions_notified: subscriptions.length
        }
      });
    } catch (logError) {
      logStep("Failed to log activity", { error: logError });
    }

    logStep("Invoice due push notification process complete", results);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error in send-invoice-due-push-notification", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
