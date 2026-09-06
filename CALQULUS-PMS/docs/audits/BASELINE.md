# PHASE 0 — Repository Baseline & Safety Check

> Audit date: 2026-08-22
> Auditor: automated agent (OpenHands), per the Master Production Hardening Blueprint
> Scope: measurement only — **no application behavior was modified during this phase**

This baseline supersedes the older `PHASE_0_BASELINE.md` in this directory, which used a
different phase-numbering scheme. This document follows the 25-phase
(Phase 0 → Phase 24) hardening blueprint.

---

## 1. Starting State (confirmed)

| Item | Value |
|---|---|
| Branch | `main` |
| Commit | `29ec5fd` — "Fix Dependabot auto-merge workflow and add Dependabot config" |
| Git status | clean working tree |
| Node | v22.23.2 (engines require `>=20.0.0`) ✔ |
| npm | 10.9.8 |
| `package-lock.json` | present, 475 KB, consistent (`npm ci` succeeded) |
| `bun.lock` | present but **0 bytes** — stale artifact, candidate for removal |
| Repo | `github.com/Themugo/CALQULUS-PMS`, Vercel auto-deploy from `main` |

## 2. Build & Tooling Results (confirmed — all executed in this environment)

| Command | Result |
|---|---|
| `npm ci` | **PASS** |
| `npm run typecheck` (`tsc --noEmit` app + node configs) | **PASS** — 0 errors |
| `npx eslint src` | **PASS** — 0 errors, 11 warnings (mostly `react-hooks/exhaustive-deps`) |
| `npm run build` | **PASS** — `dist/` = 22 MB, 547 assets, PWA `injectManifest` build OK |
| `npx vitest run` | **PASS** — **904 passed, 1 skipped** across 80 test files (35s) |
| `npx playwright test --list` | 624 tests across 14 spec files enumerated |
| `npx playwright test` | **BLOCKED by environment** — no Playwright browsers installed, no `E2E_*` credentials, requires live Supabase. Not executed; **no pass is claimed**. |

Notes:
- Build prints one deprecation warning: `inlineDynamicImports` in the PWA config ("use `codeSplitting: false` instead").
- Largest route chunk: `PropertyDetail` ≈ 196 KB. Bundle limit (2.5 MB warning) not breached per CI config.

## 3. Static Metrics (confirmed)

| Metric | Count | Notes |
|---|---|---|
| Supabase migrations | **78** `.sql` files + 1 rollback script | range `20230101000000` → `20260820000002` |
| Edge Functions | **89** (+ `_shared/` with 30 shared modules) | blueprint estimate "~90" confirmed |
| Functions with `verify_jwt = false` | **36** | mostly notification senders, webhooks, cron — **needs Phase 8 review** |
| `@ts-nocheck` files (src + supabase) | **73** | matches blueprint |
| Explicit `any` (src only) | **457** | blueprint said 554; difference is measurement scope/method — recount in Phase 10 |
| Empty `catch {}` blocks | **1** | low, but Phase 11 must also catch non-empty silent swallows |
| TODO / FIXME in src + supabase | **0** | |
| `SECURITY DEFINER` occurrences in migrations | **84** | Phase 3 must audit each |
| `USING (true)` / `WITH CHECK (true)` in migrations | **18** | Phase 3 must classify each as legit service-role vs over-broad |
| `CREATE POLICY IF NOT EXISTS` files | 2 | **invalid Postgres syntax** — Phase 2 must fix |
| Unique route paths (`src/app/routes.ts`) | **105** | 205 `path:` entries total (nested routes) |
| Feature modules (`src/features/*`) | 24 | agency, auth, billing, communications, contracts, dashboard, design-preview, landlord, leases, legal, maintenance, marketing, payments, properties, reports, services, settings, statements, tenant-portal, tenants, units, vacation-notices, water, webhost |
| Source files (`src/**/*.ts(x)`) | 720 | ~161k lines |
| Unit/integration test files | 80 | incl. `financial-integrity`, `isolation`, `api-contracts`, `regression`, `property-based`, `edge-cases` suites |
| Tables created across migrations | ~128 unique names | includes dropped/renamed — Phase 2 will certify final schema |
| `process_payment_atomic` RPC | exists | defined in `20260728000002`, hardened in `20260811000001`, extended in `20260819000003`; covered by financial + isolation tests |
| CI workflows | 7 | ci, dependabot-auto-merge, deploy-production, deploy-smoke, e2e, monitor, security-scan |

## 4. Oversized Files (confirmed — top 8 excluding generated)

| File | Lines |
|---|---|
| `src/integrations/supabase/types.ts` (generated) | 6 958 |
| `src/features/leases/pages/Leases.tsx` | 1 646 |
| `src/features/webhost/components/WebhostContracts.tsx` | 1 491 |
| `src/test/paymentFlow.test.ts` | 1 379 |
| `src/features/design-preview/pages/DesignPreview.tsx` | 1 276 |
| `src/features/payments/pages/ManagerPaymentHistory.tsx` | 1 252 |
| `src/features/payments/pages/ManagerPlatformBilling.tsx` | 1 243 |
| `src/features/webhost/components/ManagerInvoices.tsx` | 1 107 |

(Phase 14 targets these.)

## 5. Environment Variable Inventory (confirmed drift)

Referenced in `src` (12): `DEV`, `MODE`, `PROD`, `VITE_APP_VERSION`, `VITE_AUTH_TIMEOUT_MS`,
`VITE_DEV_ACCESS_EMAIL`, `VITE_DEV_ACCESS_PASSWORD`, `VITE_ENABLE_DEV_ACCESS`,
`VITE_SENTRY_DSN`, `VITE_SENTRY_ENV`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`.

Present in `.env.example` (6): `VITE_DEMO_SEED_SECRET`, `VITE_ENABLE_DEMO_SEED`,
`VITE_ENABLE_DEV_ACCESS`, `VITE_ENABLE_PUBLIC_DEMO`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`.

**Drift (HIGH):** `.env.example` is missing `VITE_SENTRY_DSN`, `VITE_SENTRY_ENV`, `VITE_APP_VERSION`,
`VITE_AUTH_TIMEOUT_MS`, `VITE_DEV_ACCESS_EMAIL`, `VITE_DEV_ACCESS_PASSWORD`; and lists
`VITE_DEMO_SEED_SECRET` / `VITE_ENABLE_DEMO_SEED` / `VITE_ENABLE_PUBLIC_DEMO` which are not
referenced anywhere in `src` (suspected dead). Edge-function secrets inventory deferred to Phase 19.

## 6. Suspected Issues (not yet verified)

1. **Duplicate tenant-contract implementations** — `tenant-portal/pages/TenantContracts.tsx` vs
   `tenants/components/TenantContractsSection.tsx`; plus three contract components in
   `features/contracts` (`ContractEditor`, `TemplateManager`, `TenantContractsView`). Phase 13.
2. **Unused dependency** — `capacitor-native-biometric` has 0 imports in `src`. Phase 1.
3. **Unused infrastructure** — `helm/` and `terraform/` exist alongside the documented
   Vercel-only production path. Phase 21.
4. **Dev-access bypass** — `VITE_ENABLE_DEV_ACCESS` + email/password env vars suggest a
   build-time credential bypass path; must be confirmed disabled in production builds. Phase 7/20.
5. **`.env*` handling is safe** — `.gitignore` covers `.env*` with `!.env.example`. ✔
6. **Documentation drift** — 19 existing audit docs in `docs/audits/` use a *different* phase
   scheme (e.g. `FINAL_CALQULUS_100_100_CERTIFICATION.md` claims 100/100 while
   `INDEPENDENT_QUALITY_GATE.md` says 55/100). Contradictory "certified" claims must be
   reconciled in Phase 22; **historical claims are not trusted** per blueprint rules.

## 7. Unknown / Blocked by Environment

| Item | Status |
|---|---|
| Clean-database migration replay (empty DB → 78 migrations) | **BLOCKED** — requires local Supabase/Postgres; not executed. Phase 2. |
| RLS cross-tenant negative tests against a live DB | **BLOCKED** — requires Supabase instance. Phase 3. |
| E2E (624 tests) | **BLOCKED** — no browsers, no `E2E_*` credentials, needs live app + Supabase. |
| Live production state (`www.calqulus.site`) | Not touched; no destructive or live actions performed. |
| Supabase type drift (`types.ts` vs live schema) | Unknown until Phase 2 regeneration. |

## 8. CURRENT SCORE

**Verified-green:** install, typecheck, lint, production build, unit test suite (904/904 executed passing).

**Provisional overall: 65 / 100 — "major work required" band.**

Rationale: the build/tooling surface is genuinely healthy, but the three highest-risk
certifications — **database replay (Phase 2), RLS isolation (Phase 3), financial atomicity
against a real DB (Phase 4)** — have NOT been executed in this environment, and historical
docs claiming 100/100 contradict the independent 55/100 gate. Per blueprint Rule 9, nothing
uncertified is counted as complete.

## 9. Issue Summary

**CRITICAL** — none confirmed in Phase 0 scope (build is green; security/financial layers not yet exercised).

**HIGH**
1. `CREATE POLICY IF NOT EXISTS` (invalid syntax) in 2 migration files — blocks clean DB replay (Phase 2).
2. 36 Edge Functions with `verify_jwt = false` — unverified security models (Phase 8).
3. 18 `USING(true)`/`WITH CHECK(true)` policies + 84 `SECURITY DEFINER` functions — unclassified (Phase 3).
4. `.env.example` drift — missing 6 referenced vars, lists 3 unreferenced (Phase 19).
5. E2E suite has never been verifiably run in this environment (Phase 16).

**MEDIUM**
1. 73 `@ts-nocheck`, 457 explicit `any` (Phase 10).
2. 8 source files >1000 lines (Phase 14).
3. Duplicate contract components (Phase 13).
4. Contradictory audit documentation claiming incompatible scores (Phase 22).

**LOW**
1. 11 ESLint warnings (`exhaustive-deps`).
2. Empty `bun.lock` artifact.
3. `inlineDynamicImports` deprecation warning in PWA build.
4. Suspected unused dep `capacitor-native-biometric` (Phase 1).
5. `helm/` + `terraform/` alongside Vercel-only path (Phase 21).

## 10. NEXT RECOMMENDED PHASE

**Phase 1 — Clean Build, Tooling & Dependency Certification** (quick win: build already green;
certify `npm ci` reproducibility, fix `.env.example` drift classification, prune unused deps,
remove empty `bun.lock`), then immediately **Phase 2** with a local Postgres/Supabase
environment, since every subsequent security/financial phase depends on a certifiable schema.
