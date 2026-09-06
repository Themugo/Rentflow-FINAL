/**
 * stripe-webhook/index.ts
 *
 * Stripe sends the same event multiple times. Without idempotency, a single
 * payment can mark the same invoice paid more than once, double-credit the
 * manager account and break reconciliation reports.
 *
 * This handler:
 *   1. Verifies the Stripe signature (returns 400 on failure).
 *   2. Claims `stripe_processed_events` before side effects without marking it
 *      completed. Concurrent fresh claims are ignored; stale/failed claims retry.
 *   3. Handles checkout.session.completed, invoice.payment_failed,
 *      charge.refunded.
 *   4. Marks the event completed only after its side effects succeed.
 *   5. On an unexpected error, records a dead-letter and returns HTTP 500 so
 *      Stripe retries the failed claim.
 */

import { serve } from "std/http/server.ts";
import Stripe from "stripe/stripe@18.5.0";
import { createClient } from "supabase/supabase-js@2";
import { recordWebhookFailure } from "../_shared/webhookHelpers.ts";
import { requireEnv } from "../_shared/env.ts";
import { roundMoney } from "../_shared/money.ts";

const STRIPE_SECRET_KEY     = requireEnv("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = requireEnv("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL          = requireEnv("SUPABASE_URL");
const SERVICE_KEY           = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const stripe = new Stripe(STRIPE_SECRET_KEY);

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[stripe-webhook] ${step}`, details ?? "");

serve(async (req) => {
  // Stripe does not preflight (server-to-server) so no CORS preamble.

  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) {
    log("Missing signature header");
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // constructEventAsync uses Web Crypto under the hood — required on Deno
    // because the sync version depends on Node's native crypto.
    event = await stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    log("Signature verification failed", { error: String(err) });
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Idempotency claim ────────────────────────────────────────────────
  // Claim before side effects, but only mark completed AFTER every side effect
  // succeeds. Failed/stale claims are retryable instead of permanently stuck.
  try {
    const { data: claim, error: claimErr } = await supabase.rpc("claim_stripe_event_atomic", {
      p_event_id: event.id,
      p_event_type: event.type,
    });
    if (claimErr) throw new Error(`Stripe event claim failed: ${claimErr.message}`);
    if (!claim?.success) {
      throw new Error("Stripe event claim returned an unsuccessful result");
    }
    if (claim.should_process !== true) {
      log("Stripe event already handled or in progress", { eventId: event.id, status: claim.status });
      // Completed events are safe no-ops. A fresh processing claim means
      // another worker owns the event; return 500 so Stripe retries instead
      // of acknowledging a potentially unfinished financial side effect.
      return new Response(claim.status === "completed" ? "ok" : "Webhook still processing", {
        status: claim.status === "completed" ? 200 : 500,
      });
    }
  } catch (err) {
    log("Stripe event claim unavailable — refusing side effects", { error: String(err), eventId: event.id });
    return new Response("Webhook temporarily unavailable", { status: 500 });
  }

  // ── Event handling ───────────────────────────────────────────────────
  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;
        const reference = session.metadata?.reference;

        if (!invoiceId) {
          throw new Error("Missing metadata: invoice_id");
        }

        const isManagerPlatformInvoice = Boolean(session.metadata?.manager_user_id);

        if (isManagerPlatformInvoice) {
          if (!reference) {
            throw new Error(`Missing platform payment reference for invoice_id=${invoiceId}`);
          }

          const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
          const { data: lifecycle, error: lifecycleErr } = await supabase.rpc(
            "update_platform_payment_atomic",
            {
              p_reference: reference,
              p_status: "success",
              p_invoice_id: invoiceId,
              p_manager_user_id: session.metadata?.manager_user_id,
              p_provider_session_id: session.id,
              p_provider_payment_intent_id: paymentIntentId,
              p_amount: session.amount_total ? session.amount_total / 100 : null,
            },
          );
          if (lifecycleErr) throw new Error(`platform payment lifecycle: ${lifecycleErr.message}`);
          if (!lifecycle?.success) throw new Error("Platform payment lifecycle did not complete");

          const completed = await supabase.rpc("complete_stripe_event_atomic", {
            p_event_id: event.id, p_invoice_id: invoiceId, p_reference: reference,
          });
          if (completed.error) throw new Error(`Stripe event completion: ${completed.error.message}`);

          log("manager checkout.session.completed handled", { invoiceId, reference });
          break;
        }

        const tenantId = session.metadata?.tenant_id;
        const managerId = session.metadata?.manager_id;
        const amountTotal = session.amount_total;
        const currency = (session.currency ?? "kes").toLowerCase();

        if (!tenantId || !managerId || !amountTotal) {
          throw new Error(
            `Missing tenant invoice metadata: tenant_id=${tenantId} manager_id=${managerId} amount_total=${amountTotal}`
          );
        }

        const zeroDecimalCurrencies = new Set(["jpy", "krw", "vnd", "clp", "pyg", "gnf", "kmf", "djf", "xaf", "xof", "xpf", "bif", "isk"]);
        const amount = roundMoney(zeroDecimalCurrencies.has(currency) ? amountTotal : amountTotal / 100);
        const paymentReference = reference ?? String(session.payment_intent ?? session.id);

        const processResp = await fetch(`${SUPABASE_URL}/functions/v1/process-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            tenantId,
            managerId,
            amount,
            paymentMethod: "stripe_checkout",
            paymentDate: new Date().toISOString().slice(0, 10),
            reference: paymentReference,
            invoiceId,
            notes: `Stripe checkout session ${session.id}`,
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
          throw new Error(`process-payment returned ${processResp.status}: ${processText.slice(0, 300)}`);
        }

        const completed = await supabase.rpc("complete_stripe_event_atomic", {
          p_event_id: event.id, p_invoice_id: invoiceId, p_reference: paymentReference,
        });
        if (completed.error) throw new Error(`Stripe event completion: ${completed.error.message}`);

        log("tenant checkout.session.completed handled", { invoiceId, reference: paymentReference });
        break;
      }

      case "invoice.payment_failed":
      case "charge.failed": {
        const obj = event.data.object as any;
        let reference = obj.metadata?.reference ?? null;
        const paymentIntentId = typeof obj.payment_intent === "string" ? obj.payment_intent : null;
        if (!reference && paymentIntentId) {
          const { data: tx } = await supabase
            .from("platform_payment_transactions")
            .select("reference")
            .eq("provider_payment_intent_id", paymentIntentId)
            .maybeSingle();
          reference = tx?.reference ?? null;
        }
        if (reference) {
          const { error } = await supabase.rpc("update_platform_payment_atomic", {
            p_reference: reference,
            p_status: "failed",
            p_provider_payment_intent_id: paymentIntentId,
            p_failure_reason: event.type,
          });
          if (error) throw new Error(`platform payment failure lifecycle: ${error.message}`);
        }
        log("Platform payment failure recorded", { type: event.type, reference });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        let reference = charge.metadata?.reference ?? null;
        const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (!reference && paymentIntentId) {
          const { data: tx } = await supabase
            .from("platform_payment_transactions")
            .select("reference")
            .eq("provider_payment_intent_id", paymentIntentId)
            .maybeSingle();
          reference = tx?.reference ?? null;
        }
        if (reference) {
          const { error } = await supabase.rpc("update_platform_payment_atomic", {
            p_reference: reference,
            p_status: "refunded",
            p_provider_payment_intent_id: paymentIntentId,
          });
          if (error) throw new Error(`platform refund lifecycle: ${error.message}`);
        }
        log("Platform refund recorded", { reference });
        break;
      }

      default:
        log("Unhandled event type", { type: event.type });
    }

    const completed = await supabase.rpc("complete_stripe_event_atomic", { p_event_id: event.id });
    if (completed.error) throw new Error(`Stripe event completion: ${completed.error.message}`);
    return new Response("ok", { status: 200 });

  } catch (err) {
    // Side effect failed AFTER signature verification — money has likely moved.
    // Persist to dead-letter, then 200 OK so Stripe stops retrying. The webhost
    // dashboard surfaces unresolved entries for manual reconciliation.
    log("Handler error — sending to dead-letter", {
      eventId: event.id, error: err instanceof Error ? err.message : String(err),
    });
    await recordWebhookFailure(supabase, "stripe", event.id, event, err);
    try {
      await supabase.rpc("fail_stripe_event_atomic", {
        p_event_id: event.id,
        p_error: err instanceof Error ? err.message : String(err),
      });
    } catch (stateErr) {
      log("Unable to persist Stripe event failure state", { error: String(stateErr), eventId: event.id });
    }
    // 500 tells Stripe to retry. The DB claim is marked failed, so a retry can reclaim it.
    return new Response("Webhook processing failed", { status: 500 });
  }
});
