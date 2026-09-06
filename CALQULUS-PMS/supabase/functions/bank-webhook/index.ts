/**
 * bank-webhook/index.ts
 *
 * Receives real-time payment notifications from bank APIs.
 * Supports: Equity Bank, KCB, NCBA, Co-op, ABSA, Stanbic.
 *
 * Banks push a JSON payload when rent lands in the account.
 * This function:
 *   1. Verifies the webhook signature / secret
 *   2. Validates payload structure with schema validation
 *   3. Validates and atomically ingests/deduplicates the transaction
 *   4. Optionally matches and processes payment inside one DB transaction
 *   5. If unmatched → stores as unmatched for manual review
 */

import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { serve } from "std/http/server.ts";
import { createClient } from "supabase/supabase-js@2";
import { timingSafeEqual, getWebhookSecret, recordWebhookFailure } from "../_shared/webhookHelpers.ts";
import { validateBankWebhook, normalizeBankPayload } from "../_shared/webhookSchemas.ts";
import { requireEnv } from "../_shared/env.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const log = (s: string, d?: unknown) => console.log(`[BANK-WEBHOOK] ${s}`, d ? JSON.stringify(d) : "");

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Identify which manager/integration this webhook is for.
    // The manager_id and bank name are not secret and are passed as query
    // params so the URL can be configured once on the bank's portal.
    //
    // The webhook secret SHOULD be sent as an `x-webhook-secret` header so
    // it does not end up in URL access logs, proxies, CDN history, or the
    // Supabase function request log. For legacy bank portals that cannot
    // send headers, fall back to `?secret=` — but flag this in the log so
    // operators know to migrate.
    const url = new URL(req.url);
    const managerId = url.searchParams.get("manager_id");
    const bankName  = url.searchParams.get("bank") ?? "generic";
    const secret    = getWebhookSecret(req, "x-webhook-secret", "secret");
    const secretInUrl = !req.headers.get("x-webhook-secret") && !!url.searchParams.get("secret");

    if (!managerId) {
      return new Response(JSON.stringify({ error: "manager_id required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    if (secretInUrl) {
      log("WARNING: webhook secret received via URL query param — migrate to x-webhook-secret header", { bank: bankName, managerId });
    }

    // Verify webhook secret against stored bank integration settings
    const { data: bankSettings } = await supabase.from("bank_integration_settings")
      .select("id, webhook_secret, auto_reconcile, match_by")
      .eq("manager_id", managerId).eq("bank_name", bankName).eq("is_active", true)
      .maybeSingle();

    if (!bankSettings) {
      return new Response(JSON.stringify({ error: "Bank integration not configured" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // Constant-time compare protects against timing side-channel attacks
    // where an attacker probes the secret byte-by-byte by measuring response
    // latency. If no secret is configured on the integration we treat that
    // as a misconfiguration and reject — never silently allow.
    const expected = (bankSettings as any).webhook_secret as string | null;
    if (!expected) {
      log("Integration has no webhook_secret configured — rejecting", { bank: bankName, managerId });
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    if (!timingSafeEqual(secret, expected)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const rawPayload = await req.json();
    
    // Validate payload structure
    const validation = validateBankWebhook(rawPayload);
    if (!validation.valid) {
      log("Invalid payload", { error: validation.error, bank: bankName, managerId });
      return new Response(JSON.stringify({ error: `Invalid payload: ${validation.error}` }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // Normalize bank-specific payload to common format
    const tx = normalizeBankPayload(rawPayload as any);

    log("Webhook received", { bank: bankName, managerId, amount: tx.amount, ref: tx.reference });

    if (!tx.amount || tx.amount <= 0) {
      return new Response(JSON.stringify({ received: true, skipped: "zero_amount" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const { data: result, error: rpcError } = await supabase.rpc("ingest_bank_webhook_atomic", {
      p_manager_id: managerId,
      p_bank_integration_id: (bankSettings as any).id,
      p_external_id: tx.externalId || null,
      p_reference: tx.reference,
      p_description: tx.description,
      p_amount: tx.amount,
      p_transaction_date: tx.date,
      p_bank_name: bankName,
      p_account_number: tx.accountNumber || null,
      p_payer_name: tx.payerName || null,
      p_payer_phone: tx.payerPhone || null,
      p_raw_payload: rawPayload,
      p_auto_reconcile: (bankSettings as any).auto_reconcile === true,
      p_match_by: (bankSettings as any).match_by ?? "amount_and_unit",
    });

    if (rpcError) throw new Error(`Bank webhook atomic processing: ${rpcError.message}`);

    return new Response(JSON.stringify(result), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (error: any) {
    log("Error", { message: error.message });
    // Try to capture the raw payload + manager context for manual replay.
    // We may have already consumed req.json() above, but we still have
    // enough context (manager_id from URL) to identify the integration.
    try {
      const url = new URL(req.url);
      const managerId = url.searchParams.get("manager_id");
      await recordWebhookFailure(
        supabase,
        "bank",
        managerId,
        { url: req.url, error: error.message },
        error,
      );
    } catch { /* never throw out of the catch */ }
    // Return 500 so the bank retries — bank webhooks (unlike Stripe) are
    // typically delivered at-least-once and a retry is the right behaviour
    // for transient DB failures. The dead-letter row guarantees we still
    // see the failure if retries also fail.
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
