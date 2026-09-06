/**
 * Paystack mobile-money charge (Kenya M-Pesa via Paystack, not Daraja).
 * Daraja STK lives in initiate-mpesa-stk-push.
 */
import { getEnv } from "./env.ts";

export function formatKenyaMsisdn(phoneNumber: string): string {
  let formatted = phoneNumber.replace(/\s+/g, "").replace(/^0/, "254").replace(/^\+/, "");
  if (!formatted.startsWith("254")) formatted = "254" + formatted;
  return formatted;
}

export async function chargePaystackMpesa(params: {
  email: string;
  amountKes: number;
  phoneNumber: string;
  metadata: Record<string, unknown>;
  /**
   * Our own correlation id, generated BEFORE calling Paystack and persisted
   * locally first (see initiate-paystack-payment / initiate-manager-paystack-payment).
   * Passed through as Paystack's `reference` so the async charge.success /
   * charge.failed webhook event echoes back a value we already know how to
   * look up — without this, Paystack assigns its own reference and the
   * webhook has no reliable way to find the pending local record.
   */
  reference?: string;
}): Promise<{ ok: boolean; payload: Record<string, unknown>; httpStatus: number }> {
  const paystackKey = getEnv("PAYSTACK_SECRET_KEY");
  if (!paystackKey) {
    return { ok: false, httpStatus: 500, payload: { message: "PAYSTACK_SECRET_KEY is not set" } };
  }

  const formattedPhone = formatKenyaMsisdn(params.phoneNumber);
  const amountInCents = Math.round(params.amountKes * 100);

  const paystackResponse = await fetch("https://api.paystack.co/charge", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: amountInCents,
      currency: "KES",
      mobile_money: {
        phone: formattedPhone,
        provider: "mpesa",
      },
      ...(params.reference ? { reference: params.reference } : {}),
      metadata: params.metadata,
    }),
  });

  const payload = await paystackResponse.json();
  return {
    ok: paystackResponse.ok && Boolean(payload?.status),
    payload,
    httpStatus: paystackResponse.status,
  };
}

/**
 * Verify a transaction's current status directly against Paystack.
 * Used by:
 *   - the paystack-webhook handler as a defence-in-depth double-check is not
 *     required (the webhook trusts the signed event), but primarily by
 *   - reconcile-paystack, which sweeps pending transactions whose webhook
 *     may have been lost (network blip, function cold-start timeout, etc.)
 *     and asks Paystack directly "what actually happened to this reference".
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<{ ok: boolean; payload: Record<string, unknown>; httpStatus: number }> {
  const paystackKey = getEnv("PAYSTACK_SECRET_KEY");
  if (!paystackKey) {
    return { ok: false, httpStatus: 500, payload: { message: "PAYSTACK_SECRET_KEY is not set" } };
  }
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${paystackKey}` } }
  );
  const payload = await response.json();
  return { ok: response.ok && Boolean(payload?.status), payload, httpStatus: response.status };
}

/**
 * HMAC-SHA512 hex digest of `body` using `secret`, matching Paystack's
 * `x-paystack-signature` header algorithm exactly (Web Crypto — no Node
 * `crypto` module available on Deno edge runtime).
 */
export async function hmacSha512Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
