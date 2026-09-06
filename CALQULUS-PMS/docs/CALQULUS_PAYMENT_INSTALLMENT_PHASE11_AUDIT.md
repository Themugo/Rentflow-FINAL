# CALQULUS — Phase 11 Audit: Atomic Manual Installment Payments

## Scope
Converge the manual `record-payment` financial path so optional installment-plan side effects and payment processing succeed or fail as one database transaction.

## Changes
- Added `record_payment_with_installment_atomic(...)` security-definer RPC.
- Moved installment schedule creation and `invoices.installment_plan` update into the same transaction as `process_payment_atomic(...)`.
- Added `payment_reference` to `arrears_schedule` with a tenant-scoped unique partial index for retry safety.
- Enforced manager/submanager identity, portfolio ownership, and restricted-property checks inside the RPC rather than trusting the Edge Function alone.
- Removed the Edge Function's direct `arrears_schedule` insert, direct invoice flag update, and service-role HTTP hop to `process-payment`.
- Added regression tests.

## Security
The RPC is executable only by authenticated/service-role roles. The public and anonymous roles are explicitly revoked. Normal `record-payment` calls use the authenticated user's session, so the security-definer RPC still evaluates the caller's manager/submanager relationship before invoking the existing atomic payment primitive.

## Atomicity
If payment processing fails, the installment schedule and invoice flag are rolled back with the payment transaction. If the request is retried with the same tenant/reference, the unique payment reference prevents duplicate installment schedules while `process_payment_atomic` provides payment idempotency.

## Verification
- Static source audit: PASS
- Direct installment financial writes removed from `record-payment`: PASS
- RPC scope/permission audit: PASS
- Retry/idempotency source audit: PASS
- ZIP integrity: PASS
- npm lint/test/build: BLOCKED when dependencies are unavailable; do not treat this as a passed runtime gate.
