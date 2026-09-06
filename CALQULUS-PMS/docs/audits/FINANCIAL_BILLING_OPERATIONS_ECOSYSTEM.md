# CALQULUS PMS — Financial & Billing Operations Ecosystem

## Objective

Establish one coherent financial truth layer across rent invoices, payment allocations, tenant credit, expenditures and landlord ownership without replacing the existing payment rails.

## Implemented

- Added billing-period fields and indexes to tenant invoices.
- Added `financial_ledger`, a derived append-only ledger view sourced from invoice issuance, completed payment allocations, advance credit and expenditures.
- Added service-only `generate_rent_invoices_atomic()` with deterministic generation keys and lease-overlap proration.
- Added service-only `mark_rent_invoices_overdue_atomic()` for safe overdue projection.
- Added `get_tenant_financial_position()` for canonical tenant balances.
- Added `get_manager_financial_position()` for expected rent, allocated collections, receivables, arrears, credits, expenditure, net income and collection rate.
- Added `get_landlord_financial_position()` for owned-property financials and revenue-share-adjusted landlord net.
- Added `audit_financial_integrity()` that reports inconsistencies without rewriting financial history.
- Updated the tenant balance summary UI to consume the canonical financial-position RPC rather than maintaining a competing balance calculation.
- Added static audit and regression tests.

## Design decisions

1. **Payments are counted when allocated to invoices**, not merely when a payment transaction exists. This prevents unallocated/advance money from inflating rent collection.
2. **Advance payments remain credits** until applied to an invoice.
3. **Invoice generation is idempotent** using `rent:<lease>:<period_start>:<period_end>` generation keys.
4. **Partial lease periods are prorated** by overlapping calendar days.
5. **Financial history is append-only by construction** in the ledger view; corrections must occur through the existing payment/invoice lifecycle controls rather than silent row replacement.
6. **Manager and submanager access follows the existing `can_manage_property_scope()` boundary.**
7. **Landlord reporting is restricted to properties explicitly linked through `property_landlords`.**

## Verification

- `npm run audit:financial-billing-operations` — PASS.
- Migration text/structural checks completed.
- Targeted Vitest binary was unavailable in the recovered dependency tree.
- Local project TypeScript binary was unavailable; the earlier environment had also shown the dependency tree incomplete. No full build/typecheck/lint result is claimed.
- Live Supabase migration execution was not available in this workspace, so deployment should still be followed by the project's staging migration and financial smoke checks.
