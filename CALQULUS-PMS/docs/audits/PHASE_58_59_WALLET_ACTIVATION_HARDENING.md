# Phase 58–59 — Wallet Ledger + Account Activation Hardening

## Scope

### Phase 58 — Landlord wallet ledger
- Added a unique partial reference key on wallet transactions to prevent replay of the same financial event.
- Added `ensure_landlord_wallet_atomic` as a service-only wallet creation/locking primitive.
- Added `record_landlord_wallet_transaction_atomic` as the sole service-only wallet mutation primitive.
- Wallet updates lock the wallet row, apply a signed server-derived balance delta, reject negative balances, and return an idempotent result for repeated references.
- Positive transaction amounts are stored in the ledger; transaction type determines whether the wallet is credited (`deposit`) or debited (`withdrawal`, `payout`, `fee`).
- Authenticated/anonymous direct INSERT/UPDATE/DELETE access is revoked.

### Phase 59 — Account activation
- Removed the historical `USING (true)` manager policy from `account_activations`.
- Retained only a narrowly scoped authenticated SELECT policy for the caller's own activation record.
- Direct authenticated/anonymous writes are revoked; existing edge-function/service workflows continue through `service_role`.

## Verification

- Production audit script: `npm run audit:prod`.
- Static SQL checks cover function definitions, service-role grants, revocation of direct writes, idempotency key, negative-balance guard, and removal of the permissive activation policy.
- Vitest, TypeScript, and Vite build remain environment-blocked in the supplied source package when their dependencies are not installed.
- No live Supabase database was available; migrations were not applied to a live database.
