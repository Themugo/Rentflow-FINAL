# CALQULUS PMS — Phases 23–24 Audit

## Phase 23 — Stripe webhook event lifecycle

`stripe_processed_events` is now a claim/complete state machine. A webhook is claimed before financial side effects, but it is only marked `completed` after the handler finishes successfully. Concurrent fresh claims are rejected as `processing`; stale claims older than ten minutes can be reclaimed. Failed claims are marked `failed`, recorded in the dead-letter queue, and return HTTP 500 so Stripe can retry. The claim/complete/fail RPCs are service-role-only.

## Phase 24 — Payment failure lifecycle

M-Pesa callback and STK verification no longer mutate `payment_transactions` directly. Terminal failure transitions go through `mark_payment_transaction_failed_atomic`, which locks the row, is idempotent for already-failed transactions, and refuses to turn a completed transaction back into failed.

## Validation

- Static source audits: required atomic boundaries present; direct production failure updates removed from targeted provider callbacks.
- Migration/function grants audited for service-role-only execution.
- Full npm lint/test/build/typecheck depend on installed project dependencies; if unavailable in the execution environment they remain explicitly blocked rather than reported as passing.
