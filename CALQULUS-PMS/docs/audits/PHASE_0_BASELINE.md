# CALQULUS PMS — Phase 0 Baseline Audit Report

**Date:** August 11, 2026  
**Status:** Completed  
**Objective:** Establish a safe engineering baseline and change-control foundation prior to operational remediation.

---

## 1. Executive Summary & Verification State

| Check / Verification Command | Result | Notes |
| :--- | :--- | :--- |
| **Package Manager** | npm (v10.x+) | Engine requirement: Node `>=20.0.0` |
| **Type Check (`npx tsc --noEmit`)** | **PASSED (0 errors)** | Full TypeScript compliance |
| **Unit Tests (`npx vitest run`)** | **PASSED (125/125 passed)** | 12 test suites covering financial integrity, isolation, benchmarks, API contracts |
| **Production Build (`npm run build`)** | **PASSED** | Compiled via Vite & ESBuild in 12.63s; SW generated via `vite-plugin-pwa` |
| **ESLint (`npm run lint`)** | **PASSED (19 warnings)** | 0 errors, 19 React Hook missing dependency warnings |
| **Production Audit (`npm run audit:prod`)** | **FAILED (Config Drift)** | Fails due to 11 missing env vars in `production-env.json` and hardcoded Supabase URL fallback in `client.ts` |

---

## 2. Technical Architecture Overview

### Framework & Frontend Stack
* **Framework:** React v19.2.7 with TypeScript v6.0.3, bundled via Vite v8.0.15.
* **Styling:** Tailwind CSS v4.3.0 with `@tailwindcss/postcss`, Radix UI primitives, Lucide React icons (`v1.16.0`), and custom "Geometric Balance" design system.
* **Routing & State:** React Router DOM v7.18.1, `@tanstack/react-query` v5.101.0, and React Context for Auth/RBAC.
* **Mobile & Offline:** Capacitor v8.4.0 (iOS / Android), Service Worker via `vite-plugin-pwa` v1.3.0, IndexedDB offline state via Dexie v4.4.3.

### Database Integration & Migrations
* **Provider:** Supabase (PostgreSQL) with `@supabase/supabase-js` v2.108.1.
* **Migrations:** 62 SQL migration files located in `supabase/migrations/` (spanning base schema, RLS hardening, MFA, atomic payments, and role firewalls).
* **RPC Procedures:** Custom PostgreSQL functions for performance optimization (e.g., `get_manager_dashboard_stats`, `get_tenants_with_properties`, `get_properties_with_tenant_counts`).

### Authentication & Role Architecture
* **Auth System:** Supabase Auth (Email/Password, Magic Link, Invite tokens, Activation flows, MFA & Biometric device management).
* **Three-Tier Role Structure:**
  1. **Tier 1 — Webhost Platform Ownership:** `super_admin`, `admin`, `limited_admin` (`platform_admins` table). Hard firewall prohibiting tenant PII access.
  2. **Tier 2 — Property Management:** `Manager` (`/`), `Agency` (`/agency`), `Landlord` (`/landlord/dashboard`), `Submanager` (role-scoped sub-user under Manager/Agency).
  3. **Tier 3 — Tenant Portal:** `Tenant` (`/portal`), scoped exclusively to own leased units and invoices.

### Financial & Payment Architecture
* **Payment Gateways:** M-Pesa STK Push & Paybill, Paystack, Bank Transfer Webhooks, Stripe Subscriptions & Webhooks, E-Wallet integration.
* **Integrity Controls:** Idempotency keys (`payment_idempotency`), atomic payment processing RPCs (`20260728000002_atomic_payment_processing.sql`), double-entry ledger verification, and water billing manager.

### Edge Functions & Serverless Logic
* **Functions:** 85 Supabase Edge Functions in `supabase/functions/` handling webhook processing, M-Pesa callbacks, automated invoice generation, tenant invitations, SMS/WhatsApp/Email notifications, and PDF/Excel report exports.

### Test Infrastructure & CI/CD
* **Unit/Integration Testing:** Vitest v4.1.8 with `@testing-library/react` and `fast-check` property testing.
* **End-to-End Testing:** Playwright v1.60.0 in `e2e/`.
* **Load Testing:** k6 scripts in `src/load-tests/`.
* **CI/CD Workflows:** GitHub Actions (`.github/workflows/`): `ci.yml`, `security-scan.yml`, `deploy-production.yml`, `deploy-smoke.yml`, `e2e.yml`, `monitor.yml`.

---

## 3. Existing Failures, Warnings & Diagnostics

### A. Production Audit Failures (`scripts/audit-production.mjs`)
1. **Missing Variables in `production-env.json`:**
   - `VITE_ENABLE_DEV_ACCESS`
   - `VITE_DEV_ACCESS_EMAIL`
   - `VITE_DEV_ACCESS_PASSWORD`
   - `VITE_WEBHOOK_PAYMENT_FAILURES`
   - `VITE_WEBHOOK_SECRET`
   - `VITE_WEBHOOK_SECURITY_ALERTS`
   - `VITE_WEBHOOK_CALLBACK_FAILURES`
   - `VITE_WEBHOOK_DATABASE_ANOMALIES`
   - `VITE_UPSTASH_REDIS_REST_URL`
   - `VITE_UPSTASH_REDIS_REST_TOKEN`
   - `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`
2. **Hardcoded Supabase URL Fallback:**
   - Identified in `/src/integrations/supabase/client.ts` (`aelzsqxllkypbzslxyju.supabase.co`).

### B. ESLint Hook Warnings (19 Total)
* `src/features/auth/pages/PendingApproval.tsx` (useEffect missing dependency)
* `src/features/properties/components/PropertyBillingConfig.tsx`
* `src/features/properties/components/PropertyInvoicesTab.tsx`
* `src/features/reports/components/RentCollectionSummary.tsx`
* `src/features/services/components/ServiceProviderProfile.tsx`
* `src/features/settings/components/CompanySettings.tsx`
* `src/features/settings/components/EWalletSettings.tsx`
* `src/features/settings/components/MpesaSettings.tsx`
* `src/features/settings/components/ReceiptSettings.tsx`
* `src/features/settings/pages/Settings.tsx`
* `src/features/tenants/components/TenantProfilePanel.tsx`
* `src/features/tenants/components/TenantStatement.tsx`
* `src/features/webhost/components/WebhostPaymentSettings.tsx`
* `src/shared/components/layout/GlobalSearch.tsx`
* `src/shared/components/layout/ProfileMenu.tsx`
* `src/shared/components/ui/push-notification-prompt.tsx`

### C. Build Performance Warning
* `WebhostDashboard-CNtNHEQY.js` chunk size is 787 kB (exceeds standard 600 kB warning threshold).

---

## 4. Protected Files & Change-Control Constraints

The following core files must NOT be modified casually during operational fixes:
1. `/src/integrations/supabase/client.ts` — Core database client initialization.
2. `/src/integrations/supabase/types.ts` — Auto-generated database schema bindings.
3. `/supabase/migrations/*` — Immutable database migration history.
4. `/src/features/auth/AuthContext.tsx` — Core identity, JWT session, and role detection context.
5. `/src/shared/hooks/useRBAC.ts` — Permission enforcement engine.
6. `/scripts/deploy-production.mjs` & `/scripts/audit-production.mjs` — Production deployment quality gates.
7. `/vite.config.ts` & `/package.json` — Build pipeline and dependency configurations.

---

## 5. Recommended Remediation Order for Subsequent Phases

1. **Phase 1 — Environment & Audit Config Normalization:** Update `production-env.json` schema declarations and refactor `src/integrations/supabase/client.ts` to retrieve runtime configuration dynamically without hardcoded fallbacks.
2. **Phase 2 — ESLint Dependency Warning Cleanup:** Safely address the 19 React Hook dependency warnings without altering component lifecycles or triggering infinite re-render loops.
3. **Phase 3 — Webhost Dashboard Code-Splitting:** Dynamic import sub-tabs in `WebhostDashboard.tsx` to reduce bundle chunk size below 600 kB.
4. **Phase 4 — End-to-End Verification & Production Readiness:** Re-run `npm run verify` to ensure zero audit errors, zero TypeScript errors, and zero lint warnings prior to deployment.
