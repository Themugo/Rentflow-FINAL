/**
 * initiate-manager-paystack-payment
 *
 * Platform-fee charge: Kenya M-Pesa through Paystack mobile_money, not Daraja.
 *
 * SECURITY / RELIABILITY (hardening pass):
 * 1. Previously this charged whatever `amount` the client sent against
 *    whatever `invoiceId` the client sent, with NO server-side lookup of
 *    manager_invoices at all — a caller could pass any invoiceId (even one
 *    belonging to another manager) and any amount. The invoice is now
 *    fetched and verified server-side (must belong to the caller, must not
 *    already be paid, amount must match).
 * 2. A pending `platform_payment_transactions` row is now created via
 *    create_platform_payment_atomic BEFORE contacting Paystack — mirroring
 *    exactly how create-manager-invoice-checkout does it for Stripe — so the
 *    async charge.success/charge.failed webhook (paystack-webhook) and the
 *    reconcile-paystack sweep have a durable record. Previously nothing was
 *    ever persisted, so a successful Paystack charge had no way to mark the
 *    platform invoice paid.
 */
import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { getEnv } from "../_shared/env.ts";
import { chargePaystackMpesa } from "../_shared/paystackMobileMoney.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[initiate-manager-paystack-payment] ${step}`, details ?? "");
};

interface PaymentRequest {
  invoiceId: string;
  amount: number;
  phoneNumber: string;
  description?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  let paymentReference: string | null = null;

  try {
    const supabaseClient = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"));
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    const user = userData.user;

    // This function is explicitly listed as SENSITIVE_FUNCTIONS in
    // _shared/rateLimit.ts (real Paystack STK-push cost per call), but had
    // no checkRateLimit call at all — the declared intent and the code had
    // drifted apart.
    if (!await checkRateLimit(supabaseClient, user.id, "initiate-manager-paystack-payment", RATE_LIMITS["initiate-manager-paystack-payment"])) {
      return rateLimitResponse(req);
    }

    const { invoiceId, amount, phoneNumber, description }: PaymentRequest = await req.json();
    if (!invoiceId || typeof amount !== "number" || !isFinite(amount) || amount <= 0 || !phoneNumber) {
      throw new Error("Invoice ID, amount, and phone number are required");
    }

    const supabaseAdmin = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("manager_invoices")
      .select("id, invoice_number, amount, manager_user_id, status, description")
      .eq("id", invoiceId)
      .eq("manager_user_id", user.id)
      .maybeSingle();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }
    if (invoice.status === "paid") {
      throw new Error("Invoice already paid");
    }
    if (Math.abs(Math.round(amount) - Math.round(Number(invoice.amount))) > 1) {
      throw new Error(`Amount mismatch: expected KES ${Math.round(Number(invoice.amount))}, received KES ${Math.round(amount)}`);
    }

    const reference = crypto.randomUUID();
    paymentReference = reference;

    const { data: paymentIntent, error: paymentIntentError } = await supabaseAdmin.rpc(
      "create_platform_payment_atomic",
      {
        p_manager_invoice_id: invoice.id,
        p_manager_user_id: user.id,
        p_amount: invoice.amount,
        p_reference: reference,
        p_currency: "KES",
        p_metadata: { invoice_id: invoice.id, description: description || invoice.description || "Manager Platform Fee" },
        p_provider: "paystack",
        p_payment_method: "paystack_mobile_money",
      },
    );
    if (paymentIntentError) throw paymentIntentError;
    if (!paymentIntent?.success) throw new Error("Unable to initialize platform payment");

    const { ok, payload } = await chargePaystackMpesa({
      email: user.email,
      amountKes: invoice.amount,
      phoneNumber,
      reference,
      metadata: {
        invoice_id: invoice.id,
        manager_user_id: user.id,
        reference,
        description: description || invoice.description || "Manager Platform Fee",
      },
    });

    logStep("Paystack response", { status: payload.status as boolean, message: payload.message as string });
    if (!ok) {
      await supabaseAdmin.rpc("update_platform_payment_atomic", {
        p_reference: reference,
        p_status: "failed",
        p_invoice_id: invoice.id,
        p_manager_user_id: user.id,
        p_failure_reason: (payload.message as string) || "Paystack charge initiation failed",
      }).catch(() => undefined);
      throw new Error((payload.message as string) || "Failed to initiate Paystack M-Pesa charge");
    }

    const data = payload.data as { reference?: string; display_text?: string } | undefined;
    return new Response(JSON.stringify({
      success: true,
      message: "Paystack sent an M-Pesa STK prompt. Check your phone.",
      reference: data?.reference ?? reference,
      display_text: data?.display_text,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    if (paymentReference) {
      const cleanupClient = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
      await cleanupClient.rpc("update_platform_payment_atomic", {
        p_reference: paymentReference,
        p_status: "failed",
        p_failure_reason: "checkout_initialization_failed",
      }).catch(() => undefined);
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
