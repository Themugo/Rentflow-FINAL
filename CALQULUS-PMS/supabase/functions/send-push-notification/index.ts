import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
import { callerManagesTenantUser } from "../_shared/notifyAuthz.ts";
const logStep = (step: string, details?: Record<string, unknown>) => {
};

interface PushNotificationRequest {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return preflightResponse(req);


  try {
    logStep("Starting push notification");

    // Auth check: require service role key or authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    // Check if called with service role key (internal server-to-server call)
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === supabaseServiceKey;
    let callerUserId: string | null = null;

    if (!isServiceRole) {
      // Validate as user JWT
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
      callerUserId = user.id;
    }

    const requestData: PushNotificationRequest = await req.json();

    const { userId, title, body, icon, url, tag } = requestData;

    if (!userId || !title || !body) {
      logStep("Missing required fields", { userId, title, body });
      return new Response(JSON.stringify({ error: "Missing required fields: userId, title, body" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Previously any authenticated user could push-notify an arbitrary
    // userId with fully attacker-controlled title/body (phishing/spam
    // vector). Require the caller to be notifying themselves, or to be the
    // manager/submanager who actually manages the target tenant (mirrors
    // BroadcastCenter.tsx, the real caller, which only ever targets tenants
    // already scoped to the calling manager's own audience).
    if (callerUserId && callerUserId !== userId) {
      const authorized = await callerManagesTenantUser(supabaseAdmin, callerUserId, userId);
      if (!authorized) {
        logStep("Forbidden: caller does not manage target user", { callerUserId, userId });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    logStep("Fetching push subscriptions", { userId });

    // Get user's push subscriptions
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
      logStep("No push subscriptions found for user", { userId });
      return new Response(JSON.stringify({ success: true, message: "No push subscriptions found" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    logStep("Found subscriptions", { count: subscriptions.length });

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || "/pwa-192x192.png",
      url: url || "/",
      tag: tag || `notification-${Date.now()}`,
    });

    const results: { success: number; failed: number } = { success: 0, failed: 0 };

    for (const subscription of subscriptions) {
      try {
        logStep("Would send push to endpoint", { 
          endpoint: subscription.endpoint.substring(0, 50) + '...',
          payload 
        });
        
        results.success++;
      } catch (pushError: unknown) {
        const errorMessage = pushError instanceof Error ? pushError.message : String(pushError);
        logStep("Push failed", { error: errorMessage });
        results.failed++;
      }
    }

    logStep("Push notification process complete", results);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Processed ${subscriptions.length} subscriptions`,
      results 
    }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Error in send-push-notification", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
