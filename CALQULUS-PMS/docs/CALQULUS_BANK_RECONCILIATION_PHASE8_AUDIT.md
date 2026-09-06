# CALQULUS Bank Reconciliation — Phase 8 Audit

## Scope
Converge bank reconciliation onto atomic financial persistence so invoice/payment state cannot be committed separately from the bank match state.

## Changes
- Single bank reconciliation now calls `process_payment_atomic` instead of directly updating invoices and inserting payment transactions.
- Bulk bank reconciliation now calls `reconcile_bank_transaction_atomic`.
- Added `reconcile_bank_transaction_atomic` SECURITY DEFINER RPC with manager ownership checks, row locks, atomic payment processing, and atomic bank-match update.
- Added Phase 8 static regression coverage.
- Updated generated Supabase TypeScript RPC types.

## Verification
- Source audit: expected direct financial writes removed from `reconcile-bank`.
- Migration structure audit: RPC locks bank/invoice rows and performs payment + match in one transaction.
- Runtime npm lint/test/build remain dependency-blocked when `node_modules` is absent.
