# CALQULUS Bank Webhook Phase 16 Audit

## Objective
Make bank webhook ingestion, duplicate handling, invoice matching, payment allocation, and bank-match state one database transaction.

## Changes
- Added `ingest_bank_webhook_atomic(...)` as a service-role-only SECURITY DEFINER RPC.
- Bank webhook now calls the RPC instead of directly inserting/updating `bank_transactions`.
- Same manager/external-id retries are serialized with a transaction advisory lock.
- Existing matched transactions are returned idempotently.
- Existing unmatched transactions may be retried for reconciliation.
- Reference, unit+amount, and unique exact-amount matching remain supported.
- The RPC calls the central `process_payment_atomic(...)` before marking the bank row matched.
- Any payment-processing error aborts the RPC transaction, so the bank match cannot become a false positive.
- Removed the unused legacy bank payload normalizer from the webhook function.
- Updated generated Supabase function types and added Phase 16 source-contract tests.

## Verification
- Static source/security audit: PASS
- Direct `bank_transactions` write audit: PASS
- Atomic ordering audit: PASS
- RPC privilege audit: PASS
- `npm run audit:prod`: PASS
- `npm run lint`: BLOCKED — dependencies are not installed in the workspace
- `npm test`: BLOCKED — Vitest is unavailable without dependencies
- `npm run build`: BLOCKED — Vite is unavailable without dependencies
