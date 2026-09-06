/**
 * webhookHelpers.test.ts
 *
 * Tests for the cross-function helpers used by every webhook handler.
 *
 * The Deno edge-function code can't be imported into Vitest directly
 * because it uses Deno APIs (and `https://...` imports), so we re-implement
 * the pure-function bits here under test. The behaviour is identical to
 * `supabase/functions/_shared/webhookHelpers.ts`; if you change one, change
 * the other. (The duplication is small and intentional — the alternative
 * is plumbing a full Deno test harness into CI which is heavier.)
 */

import { describe, it, expect } from "vitest";

// ── Helpers under test (mirror webhookHelpers.ts) ─────────────────────

function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function getWebhookSecret(req: Request, headerName: string, queryKey = "secret"): string | null {
  const fromHeader = req.headers.get(headerName);
  if (fromHeader) return fromHeader;
  const url = new URL(req.url);
  return url.searchParams.get(queryKey);
}

// ── timingSafeEqual ───────────────────────────────────────────────────

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("hello", "hello")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeEqual("hello", "world")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeEqual("short", "much longer string")).toBe(false);
  });

  it("returns false when either argument is null", () => {
    expect(timingSafeEqual(null, "abc")).toBe(false);
    expect(timingSafeEqual("abc", null)).toBe(false);
    expect(timingSafeEqual(null, null)).toBe(false);
  });

  it("returns false when either argument is undefined", () => {
    expect(timingSafeEqual(undefined, "abc")).toBe(false);
    expect(timingSafeEqual("abc", undefined)).toBe(false);
  });

  it("returns false for empty string vs non-empty", () => {
    // We treat empty string as "no secret" — falsy, so cannot match.
    expect(timingSafeEqual("", "abc")).toBe(false);
    expect(timingSafeEqual("abc", "")).toBe(false);
  });

  it("returns false for two empty strings (no secret cannot match no secret)", () => {
    // This is a deliberate property: an unset secret must NEVER pass auth.
    expect(timingSafeEqual("", "")).toBe(false);
  });

  it("handles UUIDs correctly", () => {
    const a = "550e8400-e29b-41d4-a716-446655440000";
    const b = "550e8400-e29b-41d4-a716-446655440000";
    const c = "550e8400-e29b-41d4-a716-446655440001";
    expect(timingSafeEqual(a, b)).toBe(true);
    expect(timingSafeEqual(a, c)).toBe(false);
  });

  it("differentiates strings that share a prefix (would defeat naive ==)", () => {
    // The mistake we are guarding against: an attacker probing byte-by-byte.
    // For functional correctness, just confirm prefix-match is still inequal.
    expect(timingSafeEqual("aaaaaaaa", "aaaaaaab")).toBe(false);
    expect(timingSafeEqual("aaaaaaaa", "baaaaaaa")).toBe(false);
  });

  it("differentiates strings that share a suffix", () => {
    expect(timingSafeEqual("abcdefg", "Xbcdefg")).toBe(false);
    expect(timingSafeEqual("abcdefg", "abcdefX")).toBe(false);
  });
});

// ── getWebhookSecret ──────────────────────────────────────────────────

describe("getWebhookSecret", () => {
  it("reads from the header when present", () => {
    const req = new Request("https://api.example.com/webhook?secret=from-url", {
      headers: { "x-webhook-secret": "from-header" },
    });
    expect(getWebhookSecret(req, "x-webhook-secret")).toBe("from-header");
  });

  it("falls back to the query param when no header is present", () => {
    const req = new Request("https://api.example.com/webhook?secret=from-url");
    expect(getWebhookSecret(req, "x-webhook-secret")).toBe("from-url");
  });

  it("returns null when neither header nor query is present", () => {
    const req = new Request("https://api.example.com/webhook");
    expect(getWebhookSecret(req, "x-webhook-secret")).toBe(null);
  });

  it("prefers header over query even if both are present", () => {
    // The header path is the safe one — query params end up in logs.
    // We document that header WINS so a bank migrating from query to
    // header can do it without coordinating a flag day.
    const req = new Request("https://api.example.com/webhook?secret=old-from-url", {
      headers: { "x-webhook-secret": "new-from-header" },
    });
    expect(getWebhookSecret(req, "x-webhook-secret")).toBe("new-from-header");
  });

  it("uses the custom query key when provided", () => {
    const req = new Request("https://api.example.com/webhook?api_key=xyz");
    expect(getWebhookSecret(req, "missing-header", "api_key")).toBe("xyz");
  });
});

// ── Combined: auth check that emulates the bank-webhook flow ──────────

describe("bank-webhook auth flow (integration of both helpers)", () => {
  /** Mirrors the check we do in bank-webhook/index.ts. */
  function isAuthorized(req: Request, configuredSecret: string | null): boolean {
    if (!configuredSecret) return false;
    const provided = getWebhookSecret(req, "x-webhook-secret", "secret");
    return timingSafeEqual(provided, configuredSecret);
  }

  it("authorizes when header matches stored secret", () => {
    const req = new Request("https://api.example.com/bank-webhook", {
      headers: { "x-webhook-secret": "correct-secret" },
    });
    expect(isAuthorized(req, "correct-secret")).toBe(true);
  });

  it("rejects when header is wrong", () => {
    const req = new Request("https://api.example.com/bank-webhook", {
      headers: { "x-webhook-secret": "wrong-secret" },
    });
    expect(isAuthorized(req, "correct-secret")).toBe(false);
  });

  it("rejects when no secret is configured (defence in depth)", () => {
    // Even if the request has a 'correct' value, if the server has no
    // secret stored we MUST reject — silently allowing would be a misconfig
    // bypass.
    const req = new Request("https://api.example.com/bank-webhook", {
      headers: { "x-webhook-secret": "any-secret" },
    });
    expect(isAuthorized(req, null)).toBe(false);
    expect(isAuthorized(req, "")).toBe(false);
  });

  it("accepts legacy query-param secret when no header is sent", () => {
    const req = new Request("https://api.example.com/bank-webhook?secret=correct-secret");
    expect(isAuthorized(req, "correct-secret")).toBe(true);
  });

  it("rejects legacy query-param when wrong", () => {
    const req = new Request("https://api.example.com/bank-webhook?secret=guessed");
    expect(isAuthorized(req, "correct-secret")).toBe(false);
  });
});
