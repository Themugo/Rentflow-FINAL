# CALQULUS PMS — Phase 14–15 Audit

## Phase 14 — Migration and platform-payment integrity

- Removed the newly introduced duplicate `20260902000004` migration version by moving the Phase 12–13 migration to `20260903000000_payment_lifecycle_credit_atomic.sql`.
- Historical duplicate migration versions already present in the repository were **not rewritten**, because changing an already-applied migration filename can desynchronize deployed migration history.
- Added a dedicated `platform_payment_transactions` table. Platform manager invoices no longer rely on the tenant `payments` compatibility view.
- Added RLS for manager self-read and webhost/platform-admin management.
- Added atomic creation, provider binding, and lifecycle RPCs with amount, manager, invoice, reference, and provider-correlation checks.
- Enforced terminal-state transition rules, including success → refunded and rejection of success → failed.

## Phase 15 — Stripe lifecycle convergence

- `create-manager-invoice-checkout` now authenticates through the shared auth helper.
- Checkout creates a local platform payment intent before Stripe session creation.
- Stripe PaymentIntent metadata carries the local reference and invoice correlation.
- Checkout binds the Stripe session through an atomic RPC and marks initialization failures as failed locally where possible.
- `stripe-webhook` no longer writes through the tenant `payments` view or directly updates `manager_invoices` for successful platform checkout.
- Successful, failed, and refunded platform Stripe events converge through `update_platform_payment_atomic`.
- Stripe payment-intent IDs are used as a fallback correlation key for failure/refund events.
- Fixed the unsupported `manager_invoices.invoice_type = 'one_time'` caller to use the schema-supported `other` value.

## Verification

- `node scripts/audit-phase14-15.mjs` — PASS
- `npm run audit:prod` — PASS
- Migration-version audit — PASS for newly introduced 20260903 migrations; historical duplicate versions retained unchanged for deployment-history safety.
- Platform-payment isolation audit — PASS
- Stripe checkout/webhook lifecycle audit — PASS
- npm lint — BLOCKED: `eslint` is unavailable because dependencies are not installed.
- npm test — BLOCKED: `vitest` is unavailable because dependencies are not installed.
- npm build — BLOCKED: `vite` is unavailable because dependencies are not installed.
- npm typecheck — BLOCKED by missing project dependencies (`react`, `react-router-dom`, `@tanstack/react-query`, etc.); the reported source errors are dominated by absent packages.

## Important deployment note

If the Phase 12–13 migration has already been applied to a live Supabase project under its old filename, do **not** rename/replay that historical migration in the deployed migration history. The packaged source keeps the new filename to prevent a duplicate migration version in the repository; deployment should follow the project's existing Supabase migration history/repair procedure.
