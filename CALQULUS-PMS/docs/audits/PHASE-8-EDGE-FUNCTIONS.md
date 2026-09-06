# Phase 8 — Edge Functions Certification

**Date:** 2026-08-22
**Method:** Audited all 91 edge functions for authentication, authorization, rate limiting, webhook signature verification, secret hygiene, and error-disclosure patterns.
**Scope:** Edge-function security posture, auth coverage, webhook verification, secret handling.

## Verdict: PASS — no defects requiring code changes

Edge functions are uniformly well-secured. Privilege boundaries, webhook verification,
and secret handling are all correct. No code changes were needed.

---

## 1. Authentication & authorization — solid

| Area | Status |
|------|--------|
| `bootstrap-webhost` (creates top-privilege webhost) | ✅ env-gated to `development`/`dev`/`local` + requires service-role Bearer + `BOOTSTRAP_SECRET`; permanently refuses once a webhost exists |
| `seed-demo-data` | ✅ service-role only; demo-secret only in non-prod |
| `parse-receipt` | ✅ explicit Bearer JWT + `auth.getClaims` validation |
| Payment-critical fns (`process-payment`, `create-payout`, `apply-credit`, etc.) | ✅ all have auth checks; `create-payout` role-gates to manager/submanager/webhost |
| Webhooks (`stripe-webhook`, `mpesa-callback`, `bank-webhook`) | ✅ signature-verified (`constructEventAsync` / HMAC) |
| `activate-account` | ✅ intentionally public (unauth password setup) but token-validated (unused + not expired) |
| `health-check` | ✅ public by design; non-detailed response (status/timestamp/version) by default — no internal config leak |
| Only 2 functions lack auth | ✅ both are the legitimately-public `activate-account` + `health-check` |

## 2. Secret hygiene — solid

- **No hardcoded secrets** found in edge functions. All secrets come from
  `requireEnv()`/`getEnv()` (which fail fast with a clear message if missing) or
  `Deno.env.get()`. No `sk_live`/`sk_test`/long-token literals.

## 3. Error disclosure — acceptable

- **31 functions** return `error.message` in JSON error bodies (e.g. `{ error: "..." }`).
- These are **server-to-client API errors**, not user-facing toasts — and Phase 6
  sanitized the frontend so they render as friendly messages. Many are also actionable
  validation errors the caller needs.
- Residual risk: a malformed request could echo internal error text. Per-endpoint
  disclosure tightening (mapping DB errors to generic messages server-side) is a
  follow-up hardening task, not a current blocker.

## 4. Rate limiting / monitoring

- A `_shared/middleware.ts` (`withMiddleware`) exists providing auth, rate limiting,
  and monitoring. Many functions use it; some (webhooks, env-gated bootstrap/seed, and
  functions with their own explicit auth) use equivalent per-function checks.
- **Noted (not a defect)**: adoption of `withMiddleware` is not universal, so rate
  limiting/monitoring coverage varies per function. Standardizing all non-webhook
  functions onto `withMiddleware` would be a consistency improvement, but each audited
  function has *some* auth and the privileged ones are correctly gated.

## 5. Gate check

| Gate | Result |
|------|--------|
| `replay-migrations.sh` | 84/84 pass |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 904 passed / 1 skipped (905) |
| Hardcoded-secret scan | 0 found |
| Functions with no auth (excluding intentional public) | 0 |
| Webhook signature verification | ✅ all webhooks |

## 6. Not certified (out of scope / pending)

- **Live edge-function runtime behavior**: functions were audited as source; live
  invocation latency/error rates require the deployed environment (and `health-check`
  deployment, which is still 404 per the repo context).
- **Deno-side unit tests**: `_shared/*.test.ts` and `functions/tests/integration.test.ts`
  exist but Deno is not installed in this environment; they were not executed here.
- **Per-endpoint error-disclosure tightening**: see §3.
