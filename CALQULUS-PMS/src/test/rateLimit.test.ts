/**
 * rateLimit.test.ts
 *
 * Tests the fail-open vs fail-closed semantics of the shared rate limiter.
 * Mirrors the algorithm in `supabase/functions/_shared/rateLimit.ts`.
 *
 * Why this matters:
 *   - Sensitive endpoints (M-Pesa init, SMS, payment processing) MUST
 *     deny on infra failure. Allowing through would let an attacker
 *     drain SMS credits or trigger thousands of M-Pesa pushes the
 *     moment the rate-limit table is unreachable.
 *   - Non-sensitive endpoints should allow on infra failure so a
 *     transient blip doesn't break the whole app for normal users.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers under test (mirror rateLimit.ts) ──────────────────────────

const SENSITIVE_FUNCTIONS = new Set<string>([
  "initiate-mpesa-stk-push",
  "initiate-paystack-payment",
  "initiate-manager-paystack-payment",
  "initiate-mpesa-payment",
  "initiate-manager-mpesa-payment",
  "initiate-subscription-mpesa",
  "send-sms-notification",
  "send-whatsapp-notification",
  "send-bulk-sms",
  "parse-receipt",
  "parse-contract-document",
  "process-payment",
  "record-payment",
]);

function isSensitive(functionName: string): boolean {
  return SENSITIVE_FUNCTIONS.has(functionName);
}

interface CheckRateLimitOptions { failClosed?: boolean }

async function checkRateLimit(
  supabase: { rpc: (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }> },
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
    if (error) return !failClosed;
    return data === true;
  } catch {
    return !failClosed;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("isSensitive", () => {
  it("marks M-Pesa init as sensitive", () => {
    expect(isSensitive("initiate-mpesa-stk-push")).toBe(true);
    expect(isSensitive("initiate-paystack-payment")).toBe(true);
    expect(isSensitive("initiate-mpesa-payment")).toBe(true);
  });

  it("marks SMS/WhatsApp/bulk endpoints as sensitive", () => {
    expect(isSensitive("send-sms-notification")).toBe(true);
    expect(isSensitive("send-whatsapp-notification")).toBe(true);
    expect(isSensitive("send-bulk-sms")).toBe(true);
  });

  it("marks AI parsing as sensitive (cost-bearing)", () => {
    expect(isSensitive("parse-receipt")).toBe(true);
    expect(isSensitive("parse-contract-document")).toBe(true);
  });

  it("marks payment paths as sensitive", () => {
    expect(isSensitive("process-payment")).toBe(true);
    expect(isSensitive("record-payment")).toBe(true);
  });

  it("does not mark unrelated endpoints as sensitive", () => {
    expect(isSensitive("get-payment-history")).toBe(false);
    expect(isSensitive("generate-monthly-invoices")).toBe(false);
    expect(isSensitive("log-audit")).toBe(false);
  });
});

describe("checkRateLimit — happy paths", () => {
  it("returns true when the RPC says the user is under the limit", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
    const ok = await checkRateLimit(supabase, "user-1", "send-sms-notification", 10);
    expect(ok).toBe(true);
  });

  it("returns false when the RPC says the user is over the limit", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) };
    const ok = await checkRateLimit(supabase, "user-1", "send-sms-notification", 10);
    expect(ok).toBe(false);
  });

  it("passes the right parameters to the RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await checkRateLimit({ rpc }, "user-1", "send-sms-notification", 10);
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_user_id:      "user-1",
      p_function:     "send-sms-notification",
      p_max_per_hour: 10,
    });
  });
});

describe("checkRateLimit — fail-closed for sensitive functions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DENIES when RPC errors on M-Pesa init", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "Network timeout" } }) };
    const ok = await checkRateLimit(supabase, "user-1", "initiate-mpesa-stk-push", 5);
    expect(ok).toBe(false);
  });

  it("DENIES when RPC throws on send-sms-notification", async () => {
    const supabase = { rpc: vi.fn().mockRejectedValue(new Error("Connection refused")) };
    const ok = await checkRateLimit(supabase, "user-1", "send-sms-notification", 10);
    expect(ok).toBe(false);
  });

  it("DENIES when RPC errors on process-payment", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "table missing" } }) };
    const ok = await checkRateLimit(supabase, "user-1", "process-payment", 60);
    expect(ok).toBe(false);
  });

  it("DENIES when RPC errors on record-payment", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) };
    const ok = await checkRateLimit(supabase, "user-1", "record-payment", 100);
    expect(ok).toBe(false);
  });

  it("DENIES when explicit failClosed=true is passed for a non-sensitive function", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) };
    const ok = await checkRateLimit(supabase, "u", "log-audit", 100, { failClosed: true });
    expect(ok).toBe(false);
  });
});

describe("checkRateLimit — fail-open for non-sensitive functions", () => {
  it("ALLOWS when RPC errors on send-tenant-invitation", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) };
    const ok = await checkRateLimit(supabase, "user-1", "send-tenant-invitation", 10);
    expect(ok).toBe(true);
  });

  it("ALLOWS when RPC throws on a generic endpoint", async () => {
    const supabase = { rpc: vi.fn().mockRejectedValue(new Error("x")) };
    const ok = await checkRateLimit(supabase, "user-1", "log-audit", 100);
    expect(ok).toBe(true);
  });

  it("can be forced to fail-closed even for non-sensitive functions", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "x" } }) };
    const ok = await checkRateLimit(supabase, "user-1", "send-tenant-invitation", 10, { failClosed: true });
    expect(ok).toBe(false);
  });
});
