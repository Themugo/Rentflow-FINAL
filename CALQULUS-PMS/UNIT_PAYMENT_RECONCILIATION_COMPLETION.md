# CALQULUS PMS — Unit Payment Reconciliation Completion

## Completed initiative

The billing model now has a manager/agency/landlord-facing reconciliation surface that is explicitly **unit-first**.

### What changed

- Added `get_unit_payment_reconciliation(property_id, as_of)` for property-scoped unit collection truth.
- Added `get_manager_unit_payment_reconciliation(as_of)` for portfolio-wide manager/agency reconciliation.
- Added `get_unit_payment_activity(unit_id, as_of)` for unit-level payment drill-down.
- Unit rows show invoiced, collected, outstanding, overdue, invoice count, completed payment count, payer count, last payment and a normalized status.
- Bulk payments are not treated as one opaque receipt: each completed allocation is visible against the affected unit/invoice.
- Manager/agency views show payer attribution.
- Landlord views reuse the same reconciliation engine but suppress tenant-auth identity fields.
- Added **Unit Collections** to the global Billing page and property Billing tab.
- Added **Collections** to the landlord property view.
- Kept the legacy uploaded-proof `payment_receipts` table separate from canonical issued receipts.

## Verification

- `UNIT_PAYMENT_RECONCILIATION_AUDIT=PASS`
- Migration parenthesis balance: 94 / 94
- Migration dollar-quote balance: 6 markers
- `git diff --check` could not be run because the recovered project directory contains no `.git` metadata.
- Full TypeScript check could not complete because the recovered dependency tree is incomplete; existing missing dependencies/errors include React JSX typings and Capacitor/biometric modules.
- ESLint could not run: `eslint` executable is not installed in the recovered dependency tree.
- Vite build could not run: `vite` executable is not installed in the recovered dependency tree.

No claim is made that a full production build passed. The implementation was statically audited and the new migration/component integrations were verified.
