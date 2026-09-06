# CALQULUS PMS — Phase 19–20 Audit

## Phase 19 — Platform invoice lifecycle convergence

- Webhost manager-invoice creation uses `create_manager_invoice_atomic`.
- Manual and bulk settlement use `record_platform_invoice_payment_atomic`.
- Manual and bulk cancellation use `cancel_manager_invoice_atomic`.
- The cancellation RPC locks the invoice and rejects cancellation of paid invoices.
- No direct `manager_invoices` INSERT/UPDATE/DELETE remains in `ManagerInvoices.tsx`.

## Phase 20 — Bank integration settings atomicity

- Creation uses `create_bank_integration_atomic`.
- Activation/deactivation uses `set_bank_integration_active_atomic`.
- Deletion uses `delete_bank_integration_atomic`.
- Creation validates manager context, manager role, supported bank, match mode, and property ownership.
- Webhook secrets are generated server-side when a supplied secret is too short.
- No direct `bank_integration_settings` INSERT/UPDATE/DELETE remains in `BankIntegrationSettings.tsx`.

## Migration ordering

New migrations use unique timestamps `20260903000005` and `20260903000006`.
Existing historical duplicate prefixes are not renamed or rewritten.

## Verification

- Static direct-mutation audit: PASS
- Migration/function privilege audit: PASS
- Delimiter/source audit: PASS
- `npm run audit:prod`: PASS
- `npm run lint`: BLOCKED — `eslint` unavailable because dependencies are not installed
- `npm test`: BLOCKED — `vitest` unavailable because dependencies are not installed
- `npm run build`: BLOCKED — `vite` unavailable because dependencies are not installed
