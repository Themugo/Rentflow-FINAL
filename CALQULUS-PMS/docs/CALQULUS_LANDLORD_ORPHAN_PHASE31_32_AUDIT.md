# CALQULUS Phase 31–32 Audit — Landlord Billing + Orphan Payment Lifecycle

## Phase 31 — landlord invoice lifecycle
- Webhost UI direct `landlord_invoices` INSERT/UPDATE mutations replaced by atomic lifecycle RPCs.
- Creation validates webhost authority, landlord role, amount, invoice type, optional manager/property scope, and generates invoice numbers server-side.
- Payment, waiver and cancellation are row-locked state transitions; paid/waived/cancelled states are terminal.
- Payment requires a reference and records method/date atomically.
- Authenticated direct INSERT/UPDATE/DELETE on `landlord_invoices` is revoked.

## Phase 32 — orphan payment diary lifecycle
- Self-logged orphan payment INSERT replaced by `record_orphan_payment_atomic`.
- Receipt URL UPDATE replaced by `attach_orphan_payment_receipt_atomic`.
- Ownership and amount/date validation are enforced inside SECURITY DEFINER RPCs.
- Authenticated direct INSERT/UPDATE/DELETE on `orphan_payment_entries` is revoked.
- Condition photos remain outside this financial phase because they are evidence metadata, not payment ledger entries.

## Verification
- Targeted direct-mutation source audit and lifecycle test source added.
- `npm run audit:prod` is the dependency-free production audit.
- Full lint/typecheck/build/Vitest require installed workspace dependencies.
