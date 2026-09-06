# CALQULUS PMS — Phase 7 Atomic Payment Path Audit

## Scope

Make the established `process_payment_atomic` RPC the only persistence path for the central payment engine.

## Changes

- Removed the compensating PostgREST fallback from `supabase/functions/process-payment/index.ts`.
- Removed direct transaction insertion/update, invoice mutation, payment-allocation upsert, and tenant-credit-ledger writes from the fallback path.
- Removed rollback code that attempted to compensate for multi-table writes after partial failure.
- Simplified `_shared/atomicPaymentProcessing.ts` so an unavailable/failed RPC is a hard failure rather than a signal to downgrade to non-atomic persistence.
- Added a source-level regression test proving the central payment engine cannot silently reintroduce the non-atomic write path.

## Preserved behavior

- Payment request validation and caller authorization remain unchanged.
- Idempotent replay remains handled by `process_payment_atomic`.
- Invoice allocation, partial payment, advance credit, and transaction flags remain database-owned.
- Receipt/notification work after the payment transaction remains outside the database transaction.

## Verification

- Static source audit: PASS
- Financial-write fallback removal audit: PASS
- Phase 7 regression test added: PASS (source-level assertions; runtime Vitest execution depends on installed project dependencies)
- `git diff --check`: to be run on the user's local Git repository after copying the package.
- Vitest/lint/build: not claimable in this workspace because project dependencies are not installed.
