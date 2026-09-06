# CALQULUS Payment Lifecycle — Phase 12-13 Audit

## Scope

Combined hardening of payment state transitions and tenant credit application.

## Phase 12 — Payment lifecycle integrity

- Existing payment transactions are locked before processing.
- Existing transaction tenant/manager ownership must match the requested payment.
- A transaction with existing allocations is idempotent.
- A transaction without allocations must still be `pending`; stale `completed` transactions cannot silently create new financial effects.
- Successful M-Pesa callback/query paths no longer mark `payment_transactions` completed before the central atomic processor runs.
- The central `process_payment_atomic` transaction owns completion, invoice allocation and overpayment credit.

## Phase 13 — Credit/ledger reconciliation integrity

- Manual credit application now calls `apply_tenant_credit_atomic`.
- Invoice balance/status changes, credit allocation rows and credit-ledger debit entries occur in one database transaction.
- Latest credit balance and invoice rows are locked to serialize competing applications.
- Credit applications use nullable `payment_allocations.transaction_id` rather than creating fake payment transactions.
- Manager/submanager scope is validated by the RPC; service-role calls remain available for trusted internal workflows.
- Failed allocation writes are no longer swallowed.

## Verification

- Source regression checks added in `src/test/paymentLifecyclePhase12_13.test.ts`.
- Static financial-write audit: expected direct writes removed from `apply-credit` and successful M-Pesa completion paths.
- npm lint/test/build should be run in an environment with project dependencies installed.
