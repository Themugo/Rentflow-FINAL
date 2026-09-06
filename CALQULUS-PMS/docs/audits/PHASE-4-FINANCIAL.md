# Phase 4 — Financial Integrity & Payment Engine Certification

**Date:** 2026-08-22
**Method:** Executed the real `process_payment_atomic` / `process_invoice_payment` RPCs against the replayed 81-migration schema (Docker `calqulus-pg`), simulating the service-role caller. Asserted financial invariants against live table state.
**Scope:** Atomic payment processing, idempotency, allocation ledger, credit ledger, audit trail, monetary types, webhook dead-lettering, reconciliation.

## Verdict: PASS (local certification) — 2 production-blocking defects fixed

The atomic payment engine is **architecturally sound and financially conservative**.
Two latent foreign-key defects that would break payments for manager-onboarded
tenants (who never sign up) were found and fixed.

---

## 1. The atomic payment engine is correct

`process_payment_atomic` (migration `20260819000003_phase4_financial_integrity.sql`,
hardening the earlier `20260728000002`) wraps the full payment in one transaction with
row-level `FOR UPDATE` locking. Verified behavior:

| Invariant | Result |
|-----------|--------|
| Full payment closes invoice, sets `paid_date`, `balance_due=0` | ✅ |
| Idempotent replay (same `tenant_id, bank_reference`) returns `idempotent:true`, creates no duplicate | ✅ |
| Partial payment → `partially_paid`, `paid_amount`/`balance_due` correct | ✅ |
| Overpayment closes invoice, banks excess in `tenant_credit_ledger` | ✅ |
| **Conservation A:** `sum(payment_allocations.allocated_amount) == sum(invoices.paid_amount)` | ✅ |
| **Conservation B:** `sum(payment_transactions.amount) == sum(allocations) + sum(credit_ledger)` | ✅ |
| Audit trail written per completed payment | ✅ |

Both conservation invariants held exactly (allocations 18000 = invoices paid 18000;
transactions 22000 = 18000 allocated + 4000 credited). No money created or destroyed.

### Idempotency — defense in depth
1. Pre-check `SELECT ... FOR UPDATE` on `(tenant_id, bank_reference)`.
2. Partial unique index `uniq_payment_tx_tenant_ref` (constraint backstop for races).
3. `INSERT ... ON CONFLICT` unique-violation catch returns the existing transaction.
4. Stripe: `stripe_processed_events` dedupes retried webhook events.
5. M-Pesa/bank: `webhook_dead_letter` captures provider-confirmed-but-locally-failed payments.

## 2. DEFECT FIXED — audit trigger FK violation broke payments

`log_payment_processed` (migration `20260506000021`) inserted `NEW.tenant_id` into
`security_audit_log.user_id`. But `user_id` is FK'd to `auth.users(id)`, and
`tenants.id` is NOT an auth user. **Every completed payment for a tenant without a
linked auth.users row raised an FK violation that rolled back the entire payment** —
inside the atomic RPC, in production.

**Fix (`20260822000001`):** `user_id := auth.uid()` (the actor), `tenant_id` moved into
`details` (joins `manager_id`), and the audit insert wrapped in `EXCEPTION WHEN OTHERS`
so a logging failure can never abort a financial transaction.

## 3. DEFECT FIXED — four `tenant_id` FKs pointed at `auth.users`

The schema predates the dedicated `tenants` table; several `tenant_id` columns were
declared `REFERENCES auth.users(id)` but store `public.tenants.id`. Inserting for a
tenant without an auth user FK-violated and rolled back. Affected:

| Table | Column | Was | Now |
|-------|--------|-----|-----|
| `payment_allocations` | `tenant_id` | `auth.users` | `public.tenants` |
| `tenant_credit_ledger` | `tenant_id` | `auth.users` | `public.tenants` |
| `bank_transactions` | `matched_tenant_id` | `auth.users` | `public.tenants` |
| `arrears_schedule` | `tenant_id` | `auth.users` | `public.tenants` |

Confirmed semantic via code: `UnmatchedBankTransactions.tsx` sets
`matched_tenant_id: invoice.tenant_id` and `bank-webhook` sets `matched_tenant_id:
match.tenant?.id` — both `tenants.id`. Columns named `tenant_id` belong to `tenants`;
columns named `*_user_id` (correctly) belong to `auth.users`.

**Fix (`20260822000002`):** dropped + recreated each FK referencing `public.tenants(id)`
via `NOT VALID` + `VALIDATE` (data is already `tenants.id`, so re-pointing — not just
validation — is required).

## 4. Notification failures tracked

`notification_failures` table records each failed email/SMS/WhatsApp send so a webhost
can replay. `process-payment` uses `Promise.allSettled` and returns success regardless —
the payment is never lost because a notification channel is down.

## 5. Monetary types

Core financial columns are `numeric(12,2)` (invoices paid/balance, allocations,
credit ledger, manager invoices, deposits). Amount entry columns (`invoices.amount`,
`payments.amount`, `payment_transactions.amount`, `leases.monthly_rent`,
`units.monthly_rent`) are unconstrained `numeric` — Postgres numeric is
arbitrary-precision so no float drift; `round(...,2)` applied in the RPC. Edge +
frontend share integer-minor-unit helpers (`money.ts`). Acceptable; tightening
unconstrained entry columns to `(12,2)` is a non-blocking consistency improvement.

## 6. Webhook dead-lettering & reconciliation

`webhook_dead_letter` captures M-Pesa/bank/Stripe callbacks where the provider moved
money but our side failed (source/external_ref/payload/error, webhost-only RLS).
`reconcile-bank` records bank transfers and marks invoices paid; `BankReconciliationPanel`
/`UnmatchedBankTransactions` give managers a UI to match unmatched bank transactions
to tenants (now that `matched_tenant_id` correctly references `tenants`).

## 7. Gate check

| Gate | Result |
|------|--------|
| `replay-migrations.sh` | 81/81 pass |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 904 passed / 1 skipped (905) |
| Payment engine invariants (T1–T7) | all pass against real schema |
| Audit-trigger FK defect | reproduced → fixed → re-verified |
| 4 tenant_id FK defects | reproduced → fixed → re-verified |

Evidence: `supabase/tests/rls/financial_integrity_payment_engine.sql` (7 assertions).

## 8. Not certified (out of scope / pending)

- **Live application**: `20260822000001` (trigger fix) and `20260822000002` (FK repair)
  exist only as migrations; the live Supabase project must receive them (`db push` /
  SQL Editor). The FK repair is safe to run live (`NOT VALID` + `VALIDATE`).
- **End-to-end provider flows**: real M-Pesa STK callback → payment → receipt, and
  Stripe webhook → payment, require live provider credentials / a deployed edge env
  (Phase 8 edge-function testing). Local engine verified via direct RPC.
- **Concurrent-callback race**: the unique constraint + `FOR UPDATE` design is sound;
  true concurrent webhooks not load-tested locally.
