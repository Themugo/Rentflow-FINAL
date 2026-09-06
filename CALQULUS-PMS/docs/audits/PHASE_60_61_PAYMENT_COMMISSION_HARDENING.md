# CALQULUS PMS — Phase 60–61 Payment/Commission Hardening

## Phase 60 — Payment audit-log convergence

`payment_logs` is now treated as an append-only audit trail for `payment_transactions`.

- Added `append_payment_log_atomic(payment_id,event_type,event_data)`.
- Authorization is derived from the referenced payment transaction and its invoice/property or tenant role.
- Event data must be a JSON object and event type is normalized/length-limited.
- The payment row is locked for a consistent authorization read.
- Authenticated/anonymous direct INSERT/UPDATE/DELETE is revoked.
- `paymentLogger.ts` now uses the real `payment_logs` schema and the RPC; the previous implementation attempted to write non-existent columns and mutate payment status directly.

## Phase 61 — Commission ledger convergence

The legacy `commissions` table has no current browser callers, so it is explicitly server-owned rather than left writable through RLS gaps.

- Added nonnegative amount and 0–100 rate constraints.
- Added service-role-only `record_commission_atomic` with invoice/manager relationship validation and invoice-level idempotency.
- Added service-role-only `transition_commission_atomic` for `pending`, `collected`, and `refunded`.
- Authenticated/anonymous direct INSERT/UPDATE/DELETE is revoked.

## Verification

- Static production audit: run `npm run audit:prod`.
- SQL structural checks: migration quote balance, function signatures, grants/revokes and protected-table mutation scan.
- No live Supabase database is available in this environment; migrations are structurally reviewed only.
- Existing environment limitations remain: Vitest, TypeScript dependencies and Vite are not installed in the supplied source environment.
