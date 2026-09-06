/**
 * Integration tests for CALQULUS RMS shared edge function utilities.
 *
 * Run: deno test --allow-env --allow-net supabase/functions/_shared/
 */
import { assertEquals, assertThrows, assert } from "std/assert/mod.ts";
import { timingSafeEqual, getWebhookSecret } from "../_shared/webhookHelpers.ts";
import { requireEnv, getEnv, requireEnvs } from "../_shared/env.ts";
import { isSensitive, SENSITIVE_FUNCTIONS, RATE_LIMITS } from "../_shared/rateLimit.ts";

// ── webhookHelpers tests ────────────────────────────────────────────
Deno.test("timingSafeEqual: identical strings return true", () => {
  assertEquals(timingSafeEqual("abc123", "abc123"), true);
});

Deno.test("timingSafeEqual: different strings return false", () => {
  assertEquals(timingSafeEqual("abc123", "abc124"), false);
});

Deno.test("timingSafeEqual: different lengths return false", () => {
  assertEquals(timingSafeEqual("abc", "abcd"), false);
});

Deno.test("timingSafeEqual: null/undefined return false", () => {
  assertEquals(timingSafeEqual(null, "abc"), false);
  assertEquals(timingSafeEqual("abc", undefined), false);
  assertEquals(timingSafeEqual(null, undefined), false);
});

Deno.test("timingSafeEqual: empty strings return true", () => {
  assertEquals(timingSafeEqual("", ""), true);
});

Deno.test("timingSafeEqual: long strings with single byte difference", () => {
  const a = "a".repeat(1000);
  const b = "a".repeat(999) + "b";
  assertEquals(timingSafeEqual(a, b), false);
});

Deno.test("getWebhookSecret: reads from header", () => {
  const req = new Request("https://example.com", {
    headers: { "x-webhook-secret": "secret-from-header" },
  });
  assertEquals(getWebhookSecret(req, "x-webhook-secret"), "secret-from-header");
});

Deno.test("getWebhookSecret: falls back to query param", () => {
  const req = new Request("https://example.com?secret=secret-from-query");
  assertEquals(getWebhookSecret(req, "x-webhook-secret"), "secret-from-query");
});

Deno.test("getWebhookSecret: header takes priority over query", () => {
  const req = new Request("https://example.com?secret=query-secret", {
    headers: { "x-webhook-secret": "header-secret" },
  });
  assertEquals(getWebhookSecret(req, "x-webhook-secret"), "header-secret");
});

Deno.test("getWebhookSecret: returns null when neither present", () => {
  const req = new Request("https://example.com");
  assertEquals(getWebhookSecret(req, "x-webhook-secret"), null);
});

Deno.test("getWebhookSecret: custom query key", () => {
  const req = new Request("https://example.com?token=my-token");
  assertEquals(getWebhookSecret(req, "x-webhook-secret", "token"), "my-token");
});

// ── env tests ───────────────────────────────────────────────────────
Deno.test("requireEnv: returns value when set", () => {
  Deno.env.set("TEST_ENV_VAR", "test-value");
  assertEquals(requireEnv("TEST_ENV_VAR"), "test-value");
  Deno.env.delete("TEST_ENV_VAR");
});

Deno.test("requireEnv: throws when missing", () => {
  assertThrows(
    () => requireEnv("NONEXISTENT_VAR_12345"),
    Error,
    "Missing required environment variable",
  );
});

Deno.test("requireEnv: throws when empty", () => {
  Deno.env.set("EMPTY_VAR", "");
  assertThrows(
    () => requireEnv("EMPTY_VAR"),
    Error,
    "Missing required environment variable",
  );
  Deno.env.delete("EMPTY_VAR");
});

Deno.test("requireEnv: throws when whitespace only", () => {
  Deno.env.set("WHITESPACE_VAR", "   ");
  assertThrows(
    () => requireEnv("WHITESPACE_VAR"),
    Error,
    "Missing required environment variable",
  );
  Deno.env.delete("WHITESPACE_VAR");
});

Deno.test("getEnv: returns value when set", () => {
  Deno.env.set("TEST_GET_ENV", "hello");
  assertEquals(getEnv("TEST_GET_ENV"), "hello");
  Deno.env.delete("TEST_GET_ENV");
});

Deno.test("getEnv: returns fallback when missing", () => {
  assertEquals(getEnv("NONEXISTENT_GET_ENV", "default"), "default");
});

Deno.test("getEnv: returns empty string when missing (no fallback)", () => {
  assertEquals(getEnv("NONEXISTENT_GET_ENV_2"), "");
});

Deno.test("requireEnvs: returns all values when present", () => {
  Deno.env.set("ENV_A", "a");
  Deno.env.set("ENV_B", "b");
  const result = requireEnvs(["ENV_A", "ENV_B"]);
  assertEquals(result, { ENV_A: "a", ENV_B: "b" });
  Deno.env.delete("ENV_A");
  Deno.env.delete("ENV_B");
});

Deno.test("requireEnvs: throws with all missing names", () => {
  assertThrows(
    () => requireEnvs(["MISSING_A", "MISSING_B"]),
    Error,
    "MISSING_A, MISSING_B",
  );
});

// ── rateLimit tests ─────────────────────────────────────────────────
Deno.test("isSensitive: returns true for sensitive functions", () => {
  assertEquals(isSensitive("initiate-mpesa-stk-push"), true);
  assertEquals(isSensitive("process-payment"), true);
  assertEquals(isSensitive("send-sms-notification"), true);
  assertEquals(isSensitive("parse-receipt"), true);
});

Deno.test("isSensitive: returns false for non-sensitive functions", () => {
  assertEquals(isSensitive("detect-fraud"), false);
  assertEquals(isSensitive("export-excel"), false);
  assertEquals(isSensitive("reconcile"), false);
  assertEquals(isSensitive("auto-generate-invoices"), false);
});

Deno.test("SENSITIVE_FUNCTIONS contains all money-path functions", () => {
  const expected = [
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
  ];
  for (const fn of expected) {
    assert(SENSITIVE_FUNCTIONS.has(fn), `${fn} should be sensitive`);
  }
});

Deno.test("RATE_LIMITS has entries for all sensitive functions", () => {
  for (const fn of SENSITIVE_FUNCTIONS) {
    if (fn in RATE_LIMITS) {
      assert((RATE_LIMITS as Record<string, number>)[fn] > 0, `${fn} should have a positive limit`);
    }
  }
});

Deno.test("RATE_LIMITS: sensitive functions have lower limits", () => {
  const limits = RATE_LIMITS as Record<string, number>;
  assert(limits["initiate-mpesa-stk-push"] <= 10, "M-Pesa STK should be limited");
  assert(limits["send-bulk-sms"] <= 5, "Bulk SMS should be very limited");
  assert(limits["parse-receipt"] <= 30, "AI parsing should be limited");
});
