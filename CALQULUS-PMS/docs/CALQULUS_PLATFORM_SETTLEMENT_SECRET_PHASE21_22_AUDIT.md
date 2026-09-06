# CALQULUS PMS — Phase 21–22 Audit

## Phase 21 — Platform settlement integrity

- `record_platform_invoice_payment_atomic` now locks the target manager invoice before settlement.
- A manager invoice already in `paid` state cannot create another successful platform payment transaction.
- When an existing successful transaction is available, repeated settlement returns it as an idempotent result.
- Legacy paid invoices with no transaction are reported as already paid without creating money.
- `ManagerBillingDrilldown` now uses deterministic `WEBHOST-{invoiceId}` references instead of timestamp-based references.
- Existing Phase 19 `ManagerInvoices` deterministic references remain unchanged.
- No direct `manager_invoices` financial mutation was introduced.

## Phase 22 — Bank webhook secret security

- Normal bank integration listing explicitly selects non-secret columns only.
- Authenticated PostgREST column privileges for `webhook_secret` are revoked for SELECT/INSERT/UPDATE.
- Managers can explicitly retrieve their own secret through `get_bank_webhook_secret_atomic`.
- Managers can rotate their own secret through `rotate_bank_webhook_secret_atomic`.
- Secret RPCs are SECURITY DEFINER and enforce manager ownership; service-role access remains available for trusted backend operations.
- `bank-webhook` continues to read the secret server-side using service role and does not expose it to callers.
- UI state holds a revealed secret only after an explicit user action and does not request it during the normal integration list query.

## Validation

- Production audit: PASS.
- Source delimiter/balance audit: PASS for changed TSX files.
- Secret exposure source audit: PASS; no normal UI `select('*')` remains for bank integration settings and no UI direct bank-setting mutations remain.
- Full lint/test/build/typecheck: BLOCKED in this environment because repository dependencies are not installed (`eslint`, `vitest`, `vite`, and React/type packages unavailable). Typecheck errors are dependency-resolution failures rather than a verified clean typecheck.
- Historical migration filenames were not renamed.
