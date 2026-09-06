# Phase 6 — Error Handling & Observability Certification

**Date:** 2026-08-22
**Method:** Swept error-handling patterns across `src/features` — empty/swallowing catches, raw-error toasts, unhandled rejections, error-boundary/global-handler coverage, and error-logging adoption. Sanitized all raw-error user-facing surfaces.
**Scope:** Frontend error UX, PII-hygiene of error surfaces, observability wiring.

## Verdict: PASS — 74 raw-error toasts sanitized

Error-handling infrastructure is strong and consistently used. One real UX/PII-hygiene
defect — 74 user-facing toasts passed raw `err.message`, which can leak
PostgREST/SQL/RLS error text — was found and fixed systematically.

---

## 1. Error-handling infrastructure — solid

| Mechanism | Status |
|-----------|--------|
| Global error catchers (`window.onerror` + `unhandledrejection`) | ✅ wired in `main.tsx` via `initGlobalErrorCatcher()` |
| React `ErrorBoundary` | ✅ root (`App.tsx`) + per-route |
| Structured error logger (`errorLogger`) | ✅ dual sink — `activity_logs` (webhost-visible) + Sentry (optional, DSN-gated) |
| User-facing sanitizer (`toUserFacingError`) | ✅ strips PostgREST/SQL/RLS/constraint text from toasts |
| Empty catches | ✅ only 1 (`TenantProfile.tsx`, benign) |
| Raw `console.error` in features | ✅ only 2 (both dev-only diagnostics) |
| Fire-and-forget `.then()` without `.catch()` | ✅ ~32, all state-setters; rejections caught by global `unhandledrejection` handler — acceptable |

## 2. DEFECT FIXED — 74 raw-error toasts leaked internals to users

Despite `toUserFacingError` existing (with a regex blocklist for constraint/RLS/
PostgREST/SQL patterns), it was applied in only ~28 places, while **74 destructive
toasts passed `err.message` straight through**. A failed query/mutation could surface
raw database internals (constraint names, SQLSTATE codes, RLS messages, schema hints)
to end users — poor UX and an information-hygiene risk.

**Fix:**
1. Added a centralized `errorToast(title, error, fallback)` helper
   (`src/shared/lib/errorToast.ts`) that logs the raw error via `logError` and shows a
   sanitized message via `toUserFacingError`.
2. Applied a codemod replacing the clean
   `toast({ title, description: err.message, variant: "destructive" })` pattern with
   `errorToast(title, err)` across **41 files / 73 call sites**.
3. Hand-fixed the one remaining site (`Tenants.tsx` fetch error) to route through
   `toUserFacingError`.

Result: **0** raw `err.message` destructive toasts remain in `src/features`.

## 3. What was NOT changed (deliberately)

- **35 edge-function error responses** still return `error.message` in JSON bodies
  (e.g. `{ error: "..." }`). These are server-to-client API errors, not user toasts, and
  many are actionable validation messages. Auditing each for over-disclosure is a
  per-endpoint task folded into the edge-function phase (Phase 8).
- **Fire-and-forget `.then()` state setters** — left as-is; their rejections are caught
  by the global `unhandledrejection` handler and logged. Adding individual `.catch()`
  would be noise without changing behavior.

## 4. Gate check

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 904 passed / 1 skipped (905) |
| ESLint (changed files) | clean |
| `replay-migrations.sh` | 83/83 pass |
| Raw destructive `err.message` toasts | 74 → 0 |

## 5. Not certified (out of scope / pending)

- **Sentry DSN** — the logger is fully wired but only emits to `activity_logs` unless
  `VITE_SENTRY_DSN` is set at build time (and source maps uploaded via `sentry-cli`).
  Confirm the DSN is configured in the Vercel project env for stack-trace production
  monitoring; otherwise error visibility is limited to the `activity_logs` table.
- **Edge-function error disclosure** — per-endpoint audit deferred to Phase 8.
