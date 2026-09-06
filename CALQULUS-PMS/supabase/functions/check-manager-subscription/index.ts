import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import Stripe from "stripe/stripe@18.5.0";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
// Subscription tier configuration
const SUBSCRIPTION_TIERS = {
  perProperty: {
    productId: "prod_TdEENYlZNvYbdY",
    name: "Per-Property Subscription",
    amountPerProperty: 2500,
  },
  agency: {
    productId: "prod_TdEFzMimefS5FH",
    name: "Agency Flat Rate",
    amount: 20000,
  },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
};

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);


  const supabaseClient = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = getEnv("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed");
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: null,
        subscription_end: null,
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: null,
        subscription_end: null,
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Find the subscription tier
    let tier: string | null = null;
    let subscriptionEnd: string | null = null;
    let subscriptionId: string | null = null;

    for (const subscription of subscriptions.data) {
      const productId = subscription.items.data[0]?.price?.product as string;
      const subscriptionQuantity = subscription.items.data[0]?.quantity || 1;
      
      if (productId === SUBSCRIPTION_TIERS.perProperty.productId) {
        tier = "perProperty";
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        subscriptionId = subscription.id;
        break;
      } else if (productId === SUBSCRIPTION_TIERS.agency.productId) {
        tier = "agency";
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
        subscriptionId = subscription.id;
        break;
      }
    }

    logStep("Subscription check complete", { tier, subscriptionEnd, subscriptionId });

    return new Response(JSON.stringify({
      subscribed: tier !== null,
      tier,
      tier_name: tier ? SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS].name : null,
      subscription_end: subscriptionEnd,
      subscription_id: subscriptionId,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
