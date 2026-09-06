/**
 * reconcile-paystack/index.ts
 *
 * Catches Paystack payments whose webhook delivery was lost, delayed, or
 * failed to process (paystack-webhook dead-lettered it, a cold-start
 * timeout, a transient network blip between Paystack and Supabase). Without
 * this sweep, a tenant or manager who genuinely paid via Paystack could be
 * left with an invoice that silently never gets marked paid, discoverable
 * only by a manual support ticket.
 *
 * For every PENDING Paystack transaction (both the manager platform-fee
 * table and the tenant invoice table) older than a short grace window, this
 * asks Paystack directly "what actually happened to this reference" via
 * GET /transaction/verify/:reference, and applies the same lifecycle RPCs
 * the webhook itself would have used. A transaction still genuinely pending
 * past a longer window is marked failed/expired rather than left stuck
 * forever.
 *
 * No frontend code calls this — it is intended to run on a schedule (see
 * supabase/migrations/20260506000015_scheduled_jobs.sql for the pg_cron
 * pattern used by the other periodic jobs) or be triggered by a webhost from
 * the admin console. Locked to service-role/cron.
 */
import { serve } from "std/http/server.ts";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { createClient } from "supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { rejectUnlessServiceOrCron } from "../_shared/assertCaller.ts";
import { verifyPaystackTransaction } from "../_shared/paystackMobileMoney.ts";
import { roundMoney } from "../_shared/money.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const GRACE_MINUTES = 5;   // don't touch anything younger than this — still legitimately in flight
const EXPIRE_MINUTES = 60; // beyond this with no Paystack confirmation, give up and mark failed

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[reconcile-paystack] ${step}`, details ?? "");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const denied = rejectUnlessServiceOrCron(req);
  if (denied) return denied;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const graceCutoff = new Date(Date.now() - GRACE_MINUTES * 60 * 1000).toISOString();
  const expireCutoff = new Date(Date.now() - EXPIRE_MINUTES * 60 * 1000).toISOString();

  const results = {
    platform: { checked: 0, confirmed: 0, failed: 0, expired: 0, stillPending: 0, errors: 0 },
    tenant: { checked: 0, confirmed: 0, failed: 0, expired: 0, stillPending: 0, errors: 0 },
  };

  try {
    // ── Manager platform-fee payments ────────────────────────────────────
    const { data: platformPending } = await supabase
      .from("platform_payment_transactions")
      .select("id, reference, manager_invoice_id, manager_user_id, amount, created_at")
      .eq("provider", "paystack")
      .eq("status", "pending")
      .lt("created_at", graceCutoff)
      .limit(100);

    for (const tx of platformPending ?? []) {
      results.platform.checked++;
      try {
        const { ok, payload } = await verifyPaystackTransaction(tx.reference);
        const status = (payload?.data as { status?: string; amount?: number } | undefined)?.status;

        if (ok && status === "success") {
          const paidAmount = roundMoney(Number((payload.data as { amount?: number }).amount ?? 0) / 100);
          const { error } = await supabase.rpc("update_platform_payment_atomic", {
            p_reference: tx.reference,
            p_status: "success",
            p_invoice_id: tx.manager_invoice_id,
            p_manager_user_id: tx.manager_user_id,
            p_amount: paidAmount > 0 ? paidAmount : undefined,
          });
          if (error) throw new Error(error.message);
          results.platform.confirmed++;
          log("Platform payment confirmed via reconciliation", { reference: tx.reference });
        } else if (ok && (status === "failed" || status === "abandoned" || status === "reversed")) {
          const { error } = await supabase.rpc("update_platform_payment_atomic", {
            p_reference: tx.reference,
            p_status: "failed",
            p_failure_reason: `Paystack status: ${status}`,
          });
          if (error) throw new Error(error.message);
          results.platform.failed++;
        } else if (tx.created_at < expireCutoff) {
          const { error } = await supabase.rpc("update_platform_payment_atomic", {
            p_reference: tx.reference,
            p_status: "failed",
            p_failure_reason: "Expired — no Paystack confirmation received",
          });
          if (error) throw new Error(error.message);
          results.platform.expired++;
        } else {
          results.platform.stillPending++;
        }
      } catch (err) {
        results.platform.errors++;
        log("Platform reconciliation error", { reference: tx.reference, error: String(err) });
      }
    }

    // ── Tenant invoice payments ──────────────────────────────────────────
    const { data: tenantPending } = await supabase
      .from("payment_transactions")
      .select("id, checkout_request_id, invoice_id, tenant_id, manager_id, unit_id, property_id, phone_number, initiated_at")
      .eq("payment_type", "paystack_mpesa")
      .eq("status", "pending")
      .lt("initiated_at", graceCutoff)
      .limit(100);

    for (const tx of tenantPending ?? []) {
      results.tenant.checked++;
      const reference = tx.checkout_request_id;
      if (!reference) { results.tenant.errors++; continue; }
      try {
        const { ok, payload } = await verifyPaystackTransaction(reference);
        const status = (payload?.data as { status?: string; amount?: number } | undefined)?.status;

        if (ok && status === "success") {
          const paidAmount = roundMoney(Number((payload.data as { amount?: number }).amount ?? 0) / 100);
          if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
            throw new Error("Invalid confirmed amount from Paystack");
          }
          const processResp = await fetch(`${SUPABASE_URL}/functions/v1/process-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({
              tenantId: tx.tenant_id,
              managerId: tx.manager_id,
              amount: paidAmount,
              paymentMethod: "paystack_mpesa",
              paymentDate: new Date().toISOString().slice(0, 10),
              reference,
              invoiceId: tx.invoice_id,
              unitId: tx.unit_id,
              propertyId: tx.property_id,
              phone: tx.phone_number,
              notes: `Paystack M-Pesa reference ${reference} (reconciled)`,
              transactionId: tx.id,
            }),
          });
          if (!processResp.ok) {
            const errText = await processResp.text();
            throw new Error(`process-payment returned ${processResp.status}: ${errText.slice(0, 300)}`);
          }
          results.tenant.confirmed++;
          log("Tenant payment confirmed via reconciliation", { reference });
        } else if (ok && (status === "failed" || status === "abandoned" || status === "reversed")) {
          const { error } = await supabase.rpc("mark_payment_transaction_failed_atomic", {
            p_transaction_id: tx.id,
            p_failure_reason: `Paystack status: ${status}`,
          });
          if (error) throw new Error(error.message);
          results.tenant.failed++;
        } else if (tx.initiated_at < expireCutoff) {
          const { error } = await supabase.rpc("mark_payment_transaction_failed_atomic", {
            p_transaction_id: tx.id,
            p_failure_reason: "Expired — no Paystack confirmation received",
          });
          if (error) throw new Error(error.message);
          results.tenant.expired++;
        } else {
          results.tenant.stillPending++;
        }
      } catch (err) {
        results.tenant.errors++;
        log("Tenant reconciliation error", { reference, error: String(err) });
      }
    }

    log("Reconciliation sweep complete", results);
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("Sweep failed", { error: message });
    return new Response(JSON.stringify({ success: false, error: message, results }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
