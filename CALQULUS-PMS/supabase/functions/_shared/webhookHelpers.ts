/**
 * _shared/webhookHelpers.ts
 *
 * Cross-function helpers for webhook handlers (M-Pesa, bank, Stripe).
 *
 *   - timingSafeEqual:  constant-time string comparison so secret checks
 *                       are not vulnerable to timing-side-channel attacks.
 *   - getWebhookSecret: read the secret from a header first, fall back to a
 *                       URL query param ONLY for legacy bank integrations
 *                       that cannot send custom headers. Query params end
 *                       up in logs, proxies, CDNs and browser history.
 *   - recordWebhookFailure: persist a failed webhook payload into the
 *                       `webhook_dead_letter` table so it can be replayed
 *                       or reconciled by hand. Critical for payment paths
 *                       where the upstream provider has already debited
 *                       the customer.
 */

/**
 * Constant-time string equality. Returns false immediately if lengths differ
 * (length itself is not secret). For strings of equal length, XOR every byte
 * and OR the result so total runtime is bound to the length and not to the
 * position of the first mismatching byte.
 */
export function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Get a webhook secret from request. Prefers a header (not logged in URL
 * access logs); falls back to a query param for legacy integrations.
 */
export function getWebhookSecret(req: Request, headerName: string, queryKey = "secret"): string | null {
  const fromHeader = req.headers.get(headerName);
  if (fromHeader) return fromHeader;
  const url = new URL(req.url);
  return url.searchParams.get(queryKey);
}

/**
 * Record a failed webhook into a dead-letter table for manual review or
 * automated replay. Never throws — the upstream provider must still get a
 * predictable response no matter what.
 *
 * Expects a `webhook_dead_letter` table with at least:
 *   id uuid primary key default gen_random_uuid(),
 *   source text not null,            -- 'mpesa' | 'bank' | 'stripe' | 'paystack'
 *   external_ref text,               -- provider transaction id
 *   payload jsonb,                   -- raw request body
 *   error text,                      -- error message
 *   status text default 'pending',   -- 'pending' | 'replayed' | 'resolved'
 *   created_at timestamptz default now(),
 *   resolved_at timestamptz
 */
export async function recordWebhookFailure(
  supabase: any,
  source: "mpesa" | "bank" | "stripe" | "paystack",
  externalRef: string | null,
  payload: unknown,
  error: unknown,
): Promise<void> {
  try {
    const errMsg = error instanceof Error ? error.message : String(error);
    await supabase.from("webhook_dead_letter").insert({
      source,
      external_ref: externalRef,
      payload: payload as any,
      error: errMsg.slice(0, 2000),
      status: "pending",
    });
  } catch (insertErr) {
    // Last-resort log only — the response to the upstream provider must
    // never fail because dead-letter logging failed.
    console.error(`[${source}-webhook] dead-letter insert failed:`, insertErr);
  }
}
