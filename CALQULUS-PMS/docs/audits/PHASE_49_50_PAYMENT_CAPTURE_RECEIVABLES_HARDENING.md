# CALQULUS PMS — Phase 49–50 Payment Capture & Receivables Hardening

## Scope

**Phase 49:** payment/receivable capture convergence — physical invoices, physical receipts, and receipt-to-payment linking.

**Phase 50:** tenant payment-detail mutation convergence — payment-term snapshots now use a scoped RPC; the legacy sync entry point is backend-only.

## Database boundary

Added migration `20260903000021_phase49_50_payment_capture_receivables_atomic.sql` with:

- `create_physical_invoice_atomic`
- `create_physical_receipt_atomic`
- `link_physical_receipt_payment_atomic`
- `mark_physical_document_sent_atomic`
- `save_tenant_payment_details_atomic`

Authenticated direct `INSERT/UPDATE/DELETE` was revoked on:

- `physical_invoices`
- `physical_receipts`
- `tenant_payment_details`

Existing payment processing remains delegated to `process_payment_atomic`, so linking a physical receipt to a digital payment retains the existing allocation/credit/idempotency safeguards.

## Frontend convergence

Updated:

- `src/features/communications/PhysicalDocumentEntry.tsx`
- `src/features/properties/components/AddTenantToPropertyDialog.tsx`

No authenticated UI path in the production source directly mutates the three protected tables.

## Verification

- Production audit: run `npm run audit:prod`.
- Targeted source scan: no authenticated production `.insert/.update/.upsert/.delete` remains against the protected tables.
- Migration structure: function/revoke/grant signatures checked.
- TypeScript delimiter balance: checked.
- Full TypeScript/Vitest/Vite checks depend on the repository's installed development dependencies; if unavailable, report them as blocked rather than passing them.

## Important deployment note

Apply the migration after the preceding phase migrations. The live Supabase database must be migrated before the frontend using these RPCs is deployed.

## Executed verification results — 2026-09-03

- `npm run audit:prod`: **PASS**
- Protected-table production source scan: **PASS — 0 direct authenticated UI mutations found**
- RPC structural check: **PASS — 5 phase RPCs present**
- Changed TS/TSX delimiter balance: **PASS**
- `npm test`: **BLOCKED** — `vitest: not found`
- `npm run typecheck`: **BLOCKED** by missing installed React/Capacitor typings/dependencies in the supplied environment
- `npm run build`: **BLOCKED** — `vite: not found`
- Live Supabase execution: **NOT RUN** because no live database connection is available in this workspace
