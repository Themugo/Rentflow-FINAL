/**
 * Integration tests for API versioning middleware.
 *
 * Run: deno test --allow-env --allow-net supabase/functions/_shared/apiVersion.test.ts
 */
import { assertEquals, assert, assertNotEquals } from "std/assert/mod.ts";
import { parseApiVersion, checkApiVersion, withApiVersion, CURRENT_API_VERSION, MIN_SUPPORTED_VERSION } from "./apiVersion.ts";

// ── parseApiVersion tests ───────────────────────────────────────────
Deno.test("parseApiVersion: valid date format returns normalized string", () => {
  assertEquals(parseApiVersion("2026-05-19"), "2026-05-19");
  assertEquals(parseApiVersion("2024-01-01"), "2024-01-01");
});

Deno.test("parseApiVersion: invalid formats return null", () => {
  assertEquals(parseApiVersion("2026/05/19"), null);
  assertEquals(parseApiVersion("2026-5-19"), null);
  assertEquals(parseApiVersion("05-19-2026"), null);
  assertEquals(parseApiVersion("not-a-date"), null);
  assertEquals(parseApiVersion(""), null);
});

Deno.test("parseApiVersion: out-of-range values return null", () => {
  assertEquals(parseApiVersion("2019-01-01"), null); // before 2020
  assertEquals(parseApiVersion("2031-01-01"), null); // after 2030
  assertEquals(parseApiVersion("2026-00-01"), null); // month 0
  assertEquals(parseApiVersion("2026-13-01"), null); // month 13
  assertEquals(parseApiVersion("2026-01-00"), null); // day 0
  assertEquals(parseApiVersion("2026-01-32"), null); // day 32
});

// ── checkApiVersion tests ───────────────────────────────────────────
Deno.test("checkApiVersion: no header returns null (allowed)", () => {
  const req = new Request("https://example.com");
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assertEquals(result, null);
});

Deno.test("checkApiVersion: valid recent version returns null (allowed)", () => {
  const req = new Request("https://example.com", {
    headers: { "X-API-Version": "2026-05-19" },
  });
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assertEquals(result, null);
});

Deno.test("checkApiVersion: version older than minimum returns 426", () => {
  const req = new Request("https://example.com", {
    headers: { "X-API-Version": "2025-01-01" },
  });
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assert(result !== null, "Should return a response");
  assertEquals(result.status, 426);
});

Deno.test("checkApiVersion: invalid format returns 400", () => {
  const req = new Request("https://example.com", {
    headers: { "X-API-Version": "invalid" },
  });
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assert(result !== null, "Should return a response");
  assertEquals(result.status, 400);
});

Deno.test("checkApiVersion: 426 response has correct headers", () => {
  const req = new Request("https://example.com", {
    headers: { "X-API-Version": "2020-01-01" },
  });
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assert(result !== null);
  assertEquals(result.headers.get("Content-Type"), "application/json");
  assertEquals(result.headers.get("X-API-Version"), CURRENT_API_VERSION);
  assertEquals(result.headers.get("Retry-After"), "0");
});

Deno.test("checkApiVersion: 426 response body has upgrade info", async () => {
  const req = new Request("https://example.com", {
    headers: { "X-API-Version": "2020-01-01" },
  });
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assert(result !== null);
  const body = await result.json();
  assertEquals(body.code, "API_VERSION_DEPRECATED");
  assertEquals(body.minSupportedVersion, MIN_SUPPORTED_VERSION);
  assert(body.upgradeUrl !== undefined, "Should include upgrade URL");
});

Deno.test("checkApiVersion: 400 response body has error details", async () => {
  const req = new Request("https://example.com", {
    headers: { "X-API-Version": "bad-format" },
  });
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assert(result !== null);
  const body = await result.json();
  assertEquals(body.code, "INVALID_API_VERSION");
  assertEquals(body.currentVersion, CURRENT_API_VERSION);
});

Deno.test("checkApiVersion: version exactly at minimum is allowed", () => {
  const req = new Request("https://example.com", {
    headers: { "X-API-Version": MIN_SUPPORTED_VERSION },
  });
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assertEquals(result, null);
});

Deno.test("checkApiVersion: version one day before minimum is rejected", () => {
  const oneDayBefore = new Date(new Date(MIN_SUPPORTED_VERSION).getTime() - 86400000)
    .toISOString().split("T")[0];
  const req = new Request("https://example.com", {
    headers: { "X-API-Version": oneDayBefore },
  });
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assert(result !== null);
  assertEquals(result.status, 426);
});

// ── withApiVersion tests ────────────────────────────────────────────
Deno.test("withApiVersion: adds version headers to response", () => {
  const original = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  const result = withApiVersion(original, "2026-05-19");
  assertEquals(result.headers.get("X-API-Version"), "2026-05-19");
  assertEquals(result.headers.get("X-API-Min-Supported"), MIN_SUPPORTED_VERSION);
  assertEquals(result.status, 200);
});

Deno.test("withApiVersion: preserves original response body", async () => {
  const original = new Response(JSON.stringify({ data: "test" }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
  const result = withApiVersion(original);
  assertEquals(result.status, 201);
  const body = await result.json();
  assertEquals(body, { data: "test" });
});

Deno.test("withApiVersion: uses CURRENT_API_VERSION by default", () => {
  const original = new Response("ok");
  const result = withApiVersion(original);
  assertEquals(result.headers.get("X-API-Version"), CURRENT_API_VERSION);
});

// ── Integration: version headers on error responses ─────────────────
Deno.test("API versioning: CORS headers present on version error responses", () => {
  const req = new Request("https://example.com", {
    headers: { "X-API-Version": "2020-01-01", Origin: "https://www.calqulus.site" },
  });
  const result = checkApiVersion(req, CURRENT_API_VERSION);
  assert(result !== null);
  const origin = result.headers.get("Access-Control-Allow-Origin");
  assert(origin !== null, "CORS header should be present");
});
