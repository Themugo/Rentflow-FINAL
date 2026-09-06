/**
 * paystack-webhook/index.ts
 *
 * Paystack mobile-money charges (initiate-paystack-payment,
 * initiate-manager-paystack-payment) are asynchronous: the initial HTTP
 * response only means "STK prompt sent to the phone", not "money received".
 * Until this function existed, nothing ever recorded the outcome — a tenant
 * or manager could complete a real Paystack payment and the invoice would
 * simply never be marked paid.
 *
 * This handler:
 *   1. Verifies the `x-paystack-signature` header: HMAC-SHA512 of the raw
 *      request body, keyed with PAYSTACK_SECRET_KEY (Paystack's documented
 *      signing scheme), compared in constant time.
 *   2. Claims the event via claim_paystack_event_atomic before any side
 *      effect, so a retried/duplicate delivery cannot double-credit an
 *      invoice or double-mark a platform fee paid — mirrors stripe-webhook.
 *   3. Handles charge.success and charge.failed for both flows:
 *        - manager platform-fee payments (metadata.manager_user_id present)
 *          -> update_platform_payment_atomic against platform_payment_transactions
 *        - tenant invoice payments (metadata.tenant_id present)
 *          -> delegates to process-payment, exactly like mpesa-callback,
 *             using the pending payment_transactions row created up front by
 *             initiate-paystack-payment.
 *   4. On an unexpected error after signature verification, dead-letters the
 *      event and returns HTTP 500 so Paystack retries the delivery.
 */
import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv, getEnv } from "../_shared/env.ts";
import { timingSafeEqual, recordWebhookFailure } from "../_shared/webhookHelpers.ts";
import { hmacSha512Hex } from "../_shared/paystackMobileMoney.ts";
import { roundMoney } from "../_shared/money.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const PAYSTACK_SECRET_KEY = requireEnv("PAYSTACK_SECRET_KEY");

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[paystack-webhook] ${step}`, details ?? "");

interface PaystackChargeData {
  id: number | string;
  reference: string;
  status: string;
  amount: number; // minor units (kobo/cents)
  currency?: string;
  gateway_response?: string;
  metadata?: Record<string, unknown> | string | null;
}

function parseMetadata(raw: PaystackChargeData["metadata"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

serve(async (req) => {
  // Paystack does not preflight (server-to-server) so no CORS preamble.
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!signature) {
    log("Missing signature header");
    return new Response("Missing signature", { status: 400 });
  }

  const expectedSignature = await hmacSha512Hex(PAYSTACK_SECRET_KEY, rawBody);
  if (!timingSafeEqual(signature, expectedSignature)) {
    log("Signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { event: string; data: PaystackChargeData };
  try {
    event = JSON.parse(rawBody);
  } catch {
    log("Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  const eventType = event?.event;
  const data = event?.data;
  if (!eventType || !data?.id) {
    log("Malformed event payload", { eventType });
    return new Response("Malformed payload", { status: 400 });
  }

  const eventId = String(data.id);
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Idempotency claim ──────────────────────────────────────────────────
  try {
    const { data: claim, error: claimErr } = await supabase.rpc("claim_paystack_event_atomic", {
      p_event_id: eventId,
      p_event_type: eventType,
    });
    if (claimErr) throw new Error(`Paystack event claim failed: ${claimErr.message}`);
    if (!claim?.success) throw new Error("Paystack event claim returned an unsuccessful result");
    if (claim.should_process !== true) {
      log("Paystack event already handled or in progress", { eventId, status: claim.status });
      return new Response(claim.status === "completed" ? "ok" : "Webhook still processing", {
        status: claim.status === "completed" ? 200 : 500,
      });
    }
  } catch (err) {
    log("Paystack event claim unavailable — refusing side effects", { error: String(err), eventId });
    return new Response("Webhook temporarily unavailable", { status: 500 });
  }

  // ── Event handling ───────────────────────────────────────────────────
  try {
    const reference = data.reference;
    const metadata = parseMetadata(data.metadata);
    const isManagerPlatformPayment = Boolean(metadata.manager_user_id);

    switch (eventType) {
      case "charge.success": {
        if (!reference) throw new Error("charge.success missing reference");

        if (isManagerPlatformPayment) {
          const invoiceId = metadata.invoice_id as string | undefined;
          const managerUserId = metadata.manager_user_id as string | undefined;
          if (!invoiceId || !managerUserId) {
            throw new Error(`Missing platform payment metadata for reference=${reference}`);
          }

          const { data: lifecycle, error: lifecycleErr } = await supabase.rpc(
            "update_platform_payment_atomic",
            {
              p_reference: reference,
              p_status: "success",
              p_invoice_id: invoiceId,
              p_manager_user_id: managerUserId,
              p_provider_payment_intent_id: eventId,
              p_amount: roundMoney(data.amount / 100),
            },
          );
          if (lifecycleErr) throw new Error(`platform payment lifecycle: ${lifecycleErr.message}`);
          if (!lifecycle?.success) throw new Error("Platform payment lifecycle did not complete");

          const completed = await supabase.rpc("complete_paystack_event_atomic", {
            p_event_id: eventId, p_invoice_id: invoiceId, p_reference: reference,
          });
          if (completed.error) throw new Error(`Paystack event completion: ${completed.error.message}`);

          log("manager charge.success handled", { invoiceId, reference });
          break;
        }

        // Tenant invoice flow — a pending payment_transactions row was
        // created by initiate-paystack-payment with checkout_request_id set
        // to this same reference.
        const { data: transaction, error: txErr } = await supabase
          .from("payment_transactions")
          .select("*")
          .eq("checkout_request_id", reference)
          .maybeSingle();

        if (txErr || !transaction) {
          throw new Error(`Pending payment_transactions row not found for reference=${reference}`);
        }

        if (transaction.status !== "pending") {
          log("Tenant Paystack transaction already processed", { reference, status: transaction.status });
          const completed = await supabase.rpc("complete_paystack_event_atomic", {
            p_event_id: eventId, p_invoice_id: transaction.invoice_id, p_reference: reference,
          });
          if (completed.error) throw new Error(`Paystack event completion: ${completed.error.message}`);
          break;
        }

        const paidAmount = roundMoney(data.amount / 100);
        if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
          throw new Error(`Invalid Paystack charge amount for reference=${reference}`);
        }

        const processResp = await fetch(`${SUPABASE_URL}/functions/v1/process-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            tenantId: transaction.tenant_id,
            managerId: transaction.manager_id,
            amount: paidAmount,
            paymentMethod: "paystack_mpesa",
            paymentDate: new Date().toISOString().slice(0, 10),
            reference,
            invoiceId: transaction.invoice_id,
            unitId: transaction.unit_id,
            propertyId: transaction.property_id,
            phone: transaction.phone_number,
            notes: `Paystack M-Pesa reference ${reference}`,
            transactionId: transaction.id,
          }),
        });

        const processText = await processResp.text();
        let processJson: Record<string, unknown> | null = null;
        try {
          processJson = processText ? JSON.parse(processText) : null;
        } catch {
          processJson = null;
        }

        if (!processResp.ok || processJson?.success === false) {
          // Money has moved; our reconciliation failed. Dead-letter for a
          // webhost to replay/reconcile by hand — do not silently drop it.
          throw new Error(`process-payment returned ${processResp.status}: ${processText.slice(0, 300)}`);
        }

        const completed = await supabase.rpc("complete_paystack_event_atomic", {
          p_event_id: eventId, p_invoice_id: transaction.invoice_id, p_reference: reference,
        });
        if (completed.error) throw new Error(`Paystack event completion: ${completed.error.message}`);

        log("tenant charge.success handled", { invoiceId: transaction.invoice_id, reference });
        break;
      }

      case "charge.failed": {
        if (isManagerPlatformPayment && reference) {
          const { error } = await supabase.rpc("update_platform_payment_atomic", {
            p_reference: reference,
            p_status: "failed",
            p_provider_payment_intent_id: eventId,
            p_failure_reason: data.gateway_response || "Paystack charge failed",
          });
          if (error) throw new Error(`platform payment failure lifecycle: ${error.message}`);
        } else if (reference) {
          const { data: transaction } = await supabase
            .from("payment_transactions")
            .select("id, status")
            .eq("checkout_request_id", reference)
            .maybeSingle();
          if (transaction && transaction.status === "pending") {
            const { error } = await supabase.rpc("mark_payment_transaction_failed_atomic", {
              p_transaction_id: transaction.id,
              p_failure_reason: data.gateway_response || "Paystack charge failed",
            });
            if (error) throw new Error(`payment transaction failure lifecycle: ${error.message}`);
          }
        }

        const completed = await supabase.rpc("complete_paystack_event_atomic", { p_event_id: eventId, p_reference: reference ?? undefined });
        if (completed.error) throw new Error(`Paystack event completion: ${completed.error.message}`);

        log("charge.failed recorded", { reference });
        break;
      }

      default:
        log("Unhandled event type", { type: eventType });
        {
          const completed = await supabase.rpc("complete_paystack_event_atomic", { p_event_id: eventId });
          if (completed.error) throw new Error(`Paystack event completion: ${completed.error.message}`);
        }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    log("Handler error — sending to dead-letter", {
      eventId, error: err instanceof Error ? err.message : String(err),
    });
    await recordWebhookFailure(supabase, "paystack", eventId, event, err);
    try {
      await supabase.rpc("fail_paystack_event_atomic", {
        p_event_id: eventId,
        p_error: err instanceof Error ? err.message : String(err),
      });
    } catch (stateErr) {
      log("Unable to persist Paystack event failure state", { error: String(stateErr), eventId });
    }
    // 500 tells Paystack to retry. The DB claim is marked failed, so a retry can reclaim it.
    return new Response("Webhook processing failed", { status: 500 });
  }
});
