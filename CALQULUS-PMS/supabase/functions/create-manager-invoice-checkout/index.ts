import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import Stripe from "stripe/stripe@18.5.0";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { authenticateUser } from "../_shared/auth.ts";

const STRIPE_SECRET_KEY = requireEnv("STRIPE_SECRET_KEY");
const SUPABASE_URL      = requireEnv("SUPABASE_URL");
const SERVICE_KEY       = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);


  let paymentReference: string | null = null;
  let paymentTransactionId: string | null = null;
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    });

    // ============================
    // AUTH
    // ============================
    const auth = await authenticateUser(req);
    if (!auth.success) return auth.response;

    const user = auth.user;

    // ============================
    // INPUT
    // ============================
    const { invoiceId } = await req.json();

    if (!invoiceId) throw new Error("Invoice ID required");

    // ============================
    // FETCH INVOICE (🔥 CRITICAL)
    // ============================
    const { data: invoice, error: invoiceError } = await supabase
      .from("manager_invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("manager_user_id", user.id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "paid") {
      throw new Error("Invoice already paid");
    }

    // ============================
    // CREATE PLATFORM PAYMENT INTENT
    // ============================
    const reference = `STRIPE-${crypto.randomUUID()}`;
    paymentReference = reference;
    const { data: paymentIntent, error: paymentIntentError } = await supabase.rpc(
      "create_platform_payment_atomic",
      {
        p_manager_invoice_id: invoice.id,
        p_manager_user_id: user.id,
        p_amount: invoice.amount,
        p_reference: reference,
        p_currency: "KES",
        p_metadata: { invoice_id: invoice.id },
      },
    );
    if (paymentIntentError) throw paymentIntentError;
    if (!paymentIntent?.success) throw new Error("Unable to initialize platform payment");
    paymentTransactionId = paymentIntent.transaction_id;

    // ============================
    // STRIPE CUSTOMER
    // ============================
    const customers = await stripe.customers.list({
      email: user.email!,
      limit: 1,
    });

    const customerId = customers.data[0]?.id;

    // ============================
    // CHECKOUT SESSION
    // ============================
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: [
        {
          price_data: {
            currency: "kes",
            product_data: {
              name: invoice.description || "Platform Fee",
            },
            unit_amount: Math.round(invoice.amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        metadata: {
          reference,
          invoice_id: invoice.id,
          manager_user_id: user.id,
        },
      },

      success_url: `${req.headers.get("origin")}/manager-billing?payment=success`,
      cancel_url: `${req.headers.get("origin")}/manager-billing?payment=cancelled`,

      metadata: {
        invoice_id: invoice.id,
        reference,
        manager_user_id: user.id,
      },
    });
    } catch (stripeError) {
      await supabase.rpc("update_platform_payment_atomic", {
        p_reference: reference,
        p_status: "failed",
        p_invoice_id: invoice.id,
        p_manager_user_id: user.id,
        p_failure_reason: "stripe_checkout_session_creation_failed",
      }).catch(() => undefined);
      throw stripeError;
    }

    // Bind the Stripe Checkout Session ID to the already-created local intent.
    // The provider session is correlation data, not a second payment record.
    const { error: bindError } = await supabase.rpc("bind_platform_payment_provider_atomic", {
      p_transaction_id: paymentIntent.transaction_id,
      p_manager_user_id: user.id,
      p_provider_session_id: session.id,
      p_provider_payment_intent_id: null,
    });
    if (bindError) {
      await supabase.rpc("update_platform_payment_atomic", {
        p_reference: reference,
        p_status: "failed",
        p_invoice_id: invoice.id,
        p_manager_user_id: user.id,
        p_provider_session_id: session.id,
        p_failure_reason: "platform_payment_provider_binding_failed",
      }).catch(() => undefined);
      throw bindError;
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    if (paymentReference && paymentTransactionId) {
      const cleanupClient = createClient(SUPABASE_URL, SERVICE_KEY);
      await cleanupClient.rpc("update_platform_payment_atomic", {
        p_reference: paymentReference,
        p_status: "failed",
        p_failure_reason: "checkout_initialization_failed",
      }).catch(() => undefined);
    }
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});