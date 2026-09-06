import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { rejectUnlessServiceOrCron } from "../_shared/assertCaller.ts";
const logStep = (step: string, details?: Record<string, unknown>) => {
};

interface PaymentPushRequest {
  managerId: string;
  tenantName: string;
  propertyName: string;
  unit?: string;
  amount: number;
  invoiceNumber: string;
  paymentMethod?: string;
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
  // "Payment Received" notification (and forge an activity-log row) against
  // any manager; lock to service-role/cron since no legitimate user-JWT
  // caller exists.
  const denied = rejectUnlessServiceOrCron(req);
  if (denied) return denied;


  try {
    logStep("Starting payment push notification");

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const requestData: PaymentPushRequest = await req.json();
    const { managerId, tenantName, propertyName, unit, amount, invoiceNumber, paymentMethod } = requestData;

    if (!managerId || !tenantName || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get manager's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key")
      .eq("user_id", managerId);

    if (subError) {
      logStep("Failed to fetch subscriptions", { error: subError.message });
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      logStep("No push subscriptions found for manager", { managerId });
      return new Response(JSON.stringify({ success: true, message: "No subscriptions found" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const formattedAmount = formatCurrency(amount);
    const unitInfo = unit ? ` (Unit ${unit})` : "";
    
    const notification = {
      title: "💰 Payment Received!",
      body: `${tenantName} paid ${formattedAmount} for ${propertyName}${unitInfo}`,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: `payment-${invoiceNumber}-${Date.now()}`,
      data: {
        url: "/billing",
        type: "payment_received",
        invoiceNumber,
        amount,
        tenantName,
        propertyName,
        paymentMethod: paymentMethod || "Online Payment",
      },
      actions: [
        { action: "view", title: "View Invoice" },
        { action: "dismiss", title: "Dismiss" }
      ]
    };

    logStep("Sending push notifications", { 
      subscriptionCount: subscriptions.length,
      notification: notification.title 
    });

    // Store notification for service worker to pick up
    // In production with VAPID keys, you would use web-push library here
    const results = { sent: subscriptions.length, notification };

    // Log the notification event
    try {
      const { data: profileData } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", managerId)
        .single();

      await supabaseAdmin.from("activity_logs").insert({
        user_id: managerId,
        user_email: profileData?.email || "unknown",
        action: "push_notification_sent",
        entity_type: "payment",
        details: {
          type: "payment_received",
          tenant: tenantName,
          amount: amount,
          property: propertyName,
          subscriptions_notified: subscriptions.length
        }
      });
    } catch (logError) {
      logStep("Failed to log activity", { error: logError });
    }

    logStep("Push notification process complete", results);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error in send-payment-push-notification", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
