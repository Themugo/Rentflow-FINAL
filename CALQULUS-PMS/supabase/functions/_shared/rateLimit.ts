/**
 * CALQULUS RMS shared rate limiter
 *
 * Uses the api_rate_limits table + check_rate_limit() RPC (migration 020).
 *
 * IMPORTANT — fail-open vs fail-closed:
 *
 *   Generic endpoints fail OPEN (allow on infra error): a transient DB
 *   blip should not block legitimate users from using the app.
 *
 *   Money-moving and bulk-messaging endpoints fail CLOSED (deny on infra
 *   error): if the rate-limit table is unreachable an attacker could
 *   drain M-Pesa STK push credits, SMS credits, or bulk-mail credits in
 *   seconds. The cost of one false denial is small; the cost of an open
 *   abuse window is large.
 *
 *   Pass `failClosed: true` on the call site for sensitive functions.
 *   The SENSITIVE_FUNCTIONS set documents which functions opt in.
 *
 * Usage:
 *   import { checkRateLimit, rateLimitResponse, isSensitive } from "../_shared/rateLimit.ts";
 *
 *   const fn = "initiate-mpesa-stk-push";
 *   const allowed = await checkRateLimit(supabase, userId, fn, 5, { failClosed: isSensitive(fn) });
 *   if (!allowed) return rateLimitResponse(req);
 */

import { getCorsHeaders } from "./cors.ts";

/**
 * Functions where we MUST fail closed on rate-limit infra failure.
 * These are endpoints where abuse costs real money or credibility.
 */
export const SENSITIVE_FUNCTIONS = new Set<string>([
  "initiate-mpesa-stk-push",
  "initiate-paystack-payment",
  "initiate-manager-paystack-payment",
  "initiate-mpesa-payment",
  "initiate-manager-mpesa-payment",
  "initiate-subscription-mpesa",
  "send-sms-notification",
  "send-whatsapp-notification",
  "send-bulk-sms",
  "parse-receipt",            // AI calls cost money
  "parse-contract-document",  // AI calls cost money
  "process-payment",          // money path
  "record-payment",           // money path
]);

export function isSensitive(functionName: string): boolean {
  return SENSITIVE_FUNCTIONS.has(functionName);
}

export interface CheckRateLimitOptions {
  /** If true, return false (deny) when the rate-limit check itself errors. */
  failClosed?: boolean;
}

/**
 * Check rate limit for a user+function combination.
 * Returns true if the request is allowed, false if rate limited.
 */
export async function checkRateLimit(
  supabase: any,
  userId: string,
  functionName: string,
  maxPerHour: number,
  options: CheckRateLimitOptions = {},
): Promise<boolean> {
  const failClosed = options.failClosed ?? isSensitive(functionName);

  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_user_id:      userId,
      p_function:     functionName,
      p_max_per_hour: maxPerHour,
    });
    if (error) {
      console.error(
        `Rate limit check failed for ${functionName}:`,
        error.message,
        `→ ${failClosed ? "DENYING (fail-closed)" : "allowing (fail-open)"}`,
      );
      return !failClosed;
    }
    return data === true;
  } catch (err) {
    console.error(
      `Rate limit exception for ${functionName}:`,
      err,
      `→ ${failClosed ? "DENYING (fail-closed)" : "allowing (fail-open)"}`,
    );
    return !failClosed;
  }
}

/**
 * Standard 429 Too Many Requests response.
 */
export function rateLimitResponse(
  req: Request,
  message = "Too many requests. Please wait before trying again.",
): Response {
  return new Response(
    JSON.stringify({ error: message, code: "RATE_LIMITED" }),
    {
      status: 429,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json",
        "Retry-After": "3600",
      },
    },
  );
}

/**
 * Rate limits per function (requests per hour per user)
 */
export const RATE_LIMITS = {
  "send-sms-notification":       10,
  "send-whatsapp-notification":  10,
  "send-invoice-notification":   20,
  "send-tenant-invitation":      10,
  "initiate-mpesa-stk-push":     5,
  "initiate-paystack-payment":   5,
  "initiate-manager-paystack-payment": 5,
  "send-overdue-notifications":  5,
  "create-dispute":              5,
  "generate-monthly-invoices":   3,
  "auto-generate-invoices":      3,
  "send-bulk-sms":               2,
  "parse-receipt":               20,
  "parse-contract-document":     10,
  "process-payment":             60,   // server-side payment processing (per JWT user)
  "record-payment":              100,  // manual recording — generous for month-end
} as const;
