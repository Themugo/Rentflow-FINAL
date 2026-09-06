# CALQULUS PMS — Phase 29–30 Deposit & Receipt Lifecycle Audit

## Phase 29 — Deposit lifecycle
- Deposit deductions, reversals, refund creation and refund transitions use SECURITY DEFINER RPCs.
- Tenant deposit balance and maintenance/deposit ledger changes occur in the same transaction as the deduction/refund operation.
- Row locks protect tenant and refund state from concurrent mutation.
- Refund creation is idempotency-safe against an existing active refund.
- Refund cancellation restores the held balance and records a compensating ledger entry.
- Direct authenticated INSERT/UPDATE/DELETE access to deposit financial tables is revoked.

## Phase 30 — Payment receipts
- Tenant receipt submission uses `submit_payment_receipt_atomic` with tenant-role ownership validation.
- Manager rejection uses `reject_payment_receipt_atomic` with manager portfolio validation and row locking.
- Existing verification remains on `verify_payment_receipt_atomic` and therefore shares the payment atomic boundary.
- Direct authenticated INSERT/UPDATE/DELETE access to `payment_receipts` is revoked.
- Storage upload remains separate evidence storage; database receipt creation is the authoritative lifecycle boundary.

## Validation
- Production audit: PASS.
- Targeted static lifecycle assertions: PASS.
- Runtime Vitest/lint/build/typecheck depend on project dependencies that are not installed in this runtime; they must be rerun in a fully installed development environment.
