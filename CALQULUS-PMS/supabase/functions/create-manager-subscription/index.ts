import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import Stripe from "stripe/stripe@18.5.0";
import { createClient } from "supabase/supabase-js@2";

import { requireEnv, getEnv } from "../_shared/env.ts";
// Subscription tier configuration
const SUBSCRIPTION_TIERS = {
  perProperty: {
    priceId: "price_1SfxmMPeSgNJ7Mukhmg00lRp",
    productId: "prod_TdEENYlZNvYbdY",
    name: "Per-Property Subscription",
    amountPerProperty: 2500,
    maxProperties: 9,
  },
  agency: {
    priceId: "price_1SfxmnPeSgNJ7MukQS1AMg08",
    productId: "prod_TdEFzMimefS5FH",
    name: "Agency Flat Rate",
    amount: 20000,
    minProperties: 10,
  },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
};

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);


  const supabaseClient = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_ANON_KEY")
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

    // Get request body
    const { propertyCount } = await req.json();
    logStep("Request body parsed", { propertyCount });

    if (!propertyCount || propertyCount < 1) {
      throw new Error("Property count must be at least 1");
    }

    // Determine tier and pricing based on property count
    let selectedTier: typeof SUBSCRIPTION_TIERS.perProperty | typeof SUBSCRIPTION_TIERS.agency;
    let quantity = 1;
    let tierType: string;

    if (propertyCount >= SUBSCRIPTION_TIERS.agency.minProperties) {
      selectedTier = SUBSCRIPTION_TIERS.agency;
      tierType = "agency";
      logStep("Selected agency tier", { tierName: selectedTier.name, priceId: selectedTier.priceId });
    } else {
      selectedTier = SUBSCRIPTION_TIERS.perProperty;
      quantity = propertyCount;
      tierType = "perProperty";
      logStep("Selected per-property tier", { tierName: selectedTier.name, priceId: selectedTier.priceId, quantity });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer, will create new");
    }

    // Create subscription checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: selectedTier.priceId,
          quantity: quantity,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/webhost?subscription=success&tier=${tierType}&properties=${propertyCount}`,
      cancel_url: `${req.headers.get("origin")}/webhost?subscription=cancelled`,
      metadata: {
        user_id: user.id,
        tier: tierType,
        property_count: propertyCount.toString(),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
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
