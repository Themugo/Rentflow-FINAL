# CALQULUS PMS — Phases 25–26 Audit

## Phase 25 — Tenant Invoice Lifecycle Atomicity

`PropertyBillingTab` no longer mutates `invoices.status` directly when voiding an invoice. It calls `cancel_invoice_atomic(uuid)`.

The RPC:
- authenticates callers;
- permits only the invoice manager (or service role);
- locks the invoice with `FOR UPDATE`;
- rejects paid invoices;
- rejects partially paid invoices so financial history cannot be silently erased;
- treats an already-cancelled invoice as idempotent;
- permits only pending/overdue/partially-paid lifecycle states, with the partially-paid state explicitly rejected before mutation;
- updates only status and timestamp.

A production-source audit found no remaining direct non-test `invoices` UPDATE/DELETE/UPSERT mutation in application billing code. Invoice edits, installment-plan changes, cancellation, and receipt-linked payment verification now use atomic RPC boundaries. The demo seed cleanup remains intentionally service-role-only demo infrastructure.

## Phase 26 — Commission Integrity Cleanup

`supabase/functions/process-commission` was schema-incompatible with the canonical database: it expected landlord-specific `commission_configs` columns and commission columns that do not exist. Repository search found no production caller. It was therefore retired from source and `supabase/config.toml` rather than leaving an apparently live but broken financial worker.

The dormant `commissions` table now has a unique partial index on `invoice_id`, preventing duplicate commission rows for the same invoice while allowing legacy/null invoice records.

The current platform billing path remains the canonical manager billing flow (`manager_invoices` + `platform_payment_transactions`). No replacement commission processor was invented because there is no production caller or authoritative commission settlement contract to preserve.

## Validation

- Static invoice mutation audit: pass.
- Commission caller/config audit: pass.
- Structural checks for changed TypeScript/TSX: pass.
- `npm run audit:prod`: run as part of packaging.
- Lint/test/build/typecheck: attempted; dependency availability is reported separately and not represented as a false pass.
