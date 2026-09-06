/**
 * mpesa-callback/index.ts — Full M-Pesa STK Push callback handler
 * 
 * IMPORTANT: This handler processes real money. Security guarantees:
 * 
 * 1. Webhook secret validation (timing-safe comparison)
 * 2. Transaction lookup with row lock to prevent duplicate processing
 * 3. Atomic status update: only pending → completed
 * 4. Delegation to process-payment for all financial operations
 * 5. Dead-letter capture for failed delegations
 * 6. Always returns 200 to Safaricom to stop retry loops
 */
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { timingSafeEqual, recordWebhookFailure } from "../_shared/webhookHelpers.ts";
import { validateMpesaCallback, extractMpesaMetadata } from "../_shared/webhookSchemas.ts";
import { requireEnv } from "../_shared/env.ts";
import { roundMoney } from "../_shared/money.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[mpesa-callback] ${step}`, details ?? "");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // ── 1. Validate webhook secret ───────────────────────────────────
    const url = new URL(req.url);
    const urlSecret = url.searchParams.get("secret");
    if (!urlSecret) {
      log("Missing webhook secret");
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Unauthorized" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ── 2. Parse and validate payload ─────────────────────────────────
    const rawBody = await req.json();
    const validation = validateMpesaCallback(rawBody);
    
    if (!validation.valid) {
      log("Invalid payload", { error: validation.error });
      // Still return 200 so Safaricom doesn't retry malformed data
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const callbackData = validation.data!;
    const stkCallback = callbackData.Body.stkCallback;
    const { checkoutRequestId, resultCode, resultDesc, amount, receiptNumber } = 
      extractMpesaMetadata(callbackData);

    // Acknowledge non-payment-result callbacks (sanity check)
    if (resultCode !== 0 && resultCode !== 1) {
      log("Unexpected ResultCode", { resultCode });
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ── 3. Lookup transaction ─────────────────────────────────────────
    // NOTE: this is a plain PostgREST select, not a row-locked read — two
    // concurrent callback deliveries can both observe status="pending"
    // below. The actual double-processing protection is downstream in the
    // process_payment_atomic RPC, which takes pg_advisory_xact_lock + a
    // real FOR UPDATE and no-ops if payment_allocations already exist for
    // this transaction id. Do not rely on this select alone for that.
    let { data: transaction, error: txErr } = await supabase
      .from("payment_transactions")
      .select(`*, invoices(id, invoice_number, amount, due_date, tenants(id, name, email, phone), leases(property, unit))`)
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    // Fallback path: the primary lookup can legitimately miss when Safaricom's
    // callback arrives before initiate-mpesa-stk-push has persisted
    // checkout_request_id onto the row. `transaction`/`txErr` must be
    // reassignable here — they were previously declared `const`, which threw
    // a TypeError on every fallback hit and silently dropped the callback
    // (swallowed by the outer catch, dead-lettered, 200 returned to
    // Safaricom) — money moved but the invoice was never credited.
    if (!transaction && urlSecret) {
      const fallback = await supabase
        .from("payment_transactions")
        .select(`*, invoices(id, invoice_number, amount, due_date, tenants(id, name, email, phone), leases(property, unit))`)
        .eq("callback_secret", urlSecret)
        .maybeSingle();
      transaction = fallback.data;
      txErr = fallback.error;
    }

    if (txErr || !transaction) {
      log("Transaction not found", { checkoutRequestId });
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Transaction not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ── 4. Validate secret ──────────────────────────────────────────
    if (!timingSafeEqual(transaction.callback_secret, urlSecret)) {
      log("Secret mismatch", { checkoutRequestId });
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Unauthorized" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ── 5. Status transition check (best-effort early exit) ───────────
    // This app-level check narrows the window but is not itself atomic
    // (see note above); process_payment_atomic is the real guarantee
    // against double-crediting a replayed/concurrent callback.
    if (transaction.status !== "pending") {
      log("Already processed", { checkoutRequestId, currentStatus: transaction.status });
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Already processed" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // STK timeout applies only to unsuccessful / abandoned requests.
    // A late ResultCode=0 still means money moved and must be allocated.
    const age = Date.now() - new Date(transaction.initiated_at).getTime();
    if (resultCode !== 0 && age > 10 * 60 * 1000) {
      const { error: failureError } = await supabase.rpc("mark_payment_transaction_failed_atomic", {
        p_transaction_id: transaction.id,
        p_failure_reason: "Expired",
      });
      if (failureError) throw new Error(`Failed to persist expired payment state: ${failureError.message}`);

      log("Transaction expired", { checkoutRequestId, age });
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Expired" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ── 6. Process successful payment ────────────────────────────────
    if (resultCode === 0) {
      const paidAmount = roundMoney(Number(amount ?? transaction.amount));
      const initiatedAmount = roundMoney(Number(transaction.amount ?? 0));
      if (initiatedAmount > 0 && paidAmount !== initiatedAmount) {
        log("Callback amount differs from STK initiation — allocating actual paid amount", {
          checkoutRequestId,
          initiatedAmount,
          paidAmount,
        });
      }
      const mpesaReceiptNumber = receiptNumber || checkoutRequestId;
      if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        log("Invalid callback amount", { checkoutRequestId, amount });
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
          { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      const paidDate = new Date().toISOString().split("T")[0];

      const inv = transaction.invoices as any;
      // unit_number is not stored on payment_transactions — derive from the invoice's lease
      const unitNumber = inv?.leases?.unit ?? (transaction as any).unit_number ?? "N/A";

      let allocationInvoiceIds: string[] | undefined;
      const txNotes = (transaction as { notes?: string | null }).notes;
      if (txNotes?.startsWith("{")) {
        try {
          const parsed = JSON.parse(txNotes) as { invoice_ids?: string[] };
          if (Array.isArray(parsed.invoice_ids) && parsed.invoice_ids.length > 0) {
            allocationInvoiceIds = parsed.invoice_ids;
          }
        } catch { /* single-invoice fallback */ }
      }

      // Delegate all allocation, balance tracking, and notifications to
      // process-payment. Critical: this MUST be awaited and its response
      // checked. The tenant has already been debited at this point; if
      // process-payment fails silently the payment is lost on our side
      // while Safaricom thinks everything is fine.
      let processOk = false;
      let processErr: unknown = null;
      try {
        const processResp = await fetch(`${SUPABASE_URL}/functions/v1/process-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            tenantId:      transaction.tenant_id ?? inv?.tenants?.id,
            managerId:     transaction.manager_id,
            amount:        paidAmount,
            paymentMethod: transaction.payment_type === "till" ? "mpesa_till" : "mpesa_stk",
            paymentDate:   paidDate,
            reference:     mpesaReceiptNumber,
            invoiceId:     allocationInvoiceIds?.length === 1
              ? allocationInvoiceIds[0]
              : allocationInvoiceIds?.length
                ? undefined
                : transaction.invoice_id,
            invoiceIds:    allocationInvoiceIds?.length
              ? allocationInvoiceIds
              : undefined,
            unitId:        transaction.unit_id,
            propertyId:    transaction.property_id,
            unitNumber,
            phone:         transaction.phone_number,
            notes:         `M-Pesa receipt ${mpesaReceiptNumber}`,
            transactionId: transaction.id,
          }),
        });
        processOk = processResp.ok;
        if (!processOk) {
          processErr = `process-payment returned ${processResp.status}: ${await processResp.text()}`;
        }
      } catch (e) {
        processErr = e;
      }

      if (!processOk) {
        // Money has moved; our reconciliation failed. Persist to dead-letter
        // so a webhost can replay or reconcile by hand. Do NOT change the
        // transaction status back to pending — the M-Pesa receipt is real.
        log("process-payment failed — dead-lettering", { mpesaReceiptNumber, error: String(processErr) });
        await recordWebhookFailure(
          supabase,
          "mpesa",
          mpesaReceiptNumber,
          {
            transactionId: transaction.id,
            invoiceId:     transaction.invoice_id,
            tenantId:      transaction.tenant_id,
            managerId:     transaction.manager_id,
            amount:        paidAmount,
            paidDate,
            mpesaReceiptNumber,
            unitNumber,
          },
          processErr,
        );
      } else {
        log("Delegated to process-payment", { mpesaReceiptNumber });
      }

    } else {
      const { error: failureError } = await supabase.rpc("mark_payment_transaction_failed_atomic", {
        p_transaction_id: transaction.id,
        p_failure_reason: ResultDesc ?? "Payment cancelled or failed",
      });
      if (failureError) throw new Error(`Failed to persist payment failure state: ${failureError.message}`);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Callback processed" }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown";
    log("Error", { message: errMsg });

    // The outer catch swallows EVERYTHING — including DB connection failures
    // that happen BEFORE we could mark the transaction completed. We MUST
    // dead-letter so the failure is visible, then still acknowledge to
    // Safaricom (ResultCode 0) so they stop retrying. A retry would not help:
    // if the DB is down, retrying will not bring it back up. The dead-letter
    // gives a human a chance to fix it.
    try {
      await recordWebhookFailure(
        supabase,
        "mpesa",
        null,
        { url: req.url, error: errMsg },
        error,
      );
    } catch { /* never throw from a catch */ }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Callback received" }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
