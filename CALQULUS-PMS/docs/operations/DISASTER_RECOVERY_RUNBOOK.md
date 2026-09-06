# CALQULUS PMS — Disaster Recovery Runbook

## Recovery priorities
1. Preserve evidence and stop further writes if corruption is suspected.
2. Identify the last known-good recovery point.
3. Restore to an isolated recovery project/database first.
4. Validate migration history, RLS, role isolation, financial ledger integrity, and storage access.
5. Reconcile data created after the recovery point before production cutover.

## Financial safety
Never compensate a missing payment, payout, commission, wallet transaction, or invoice by manually editing balances. Reconstruct through the canonical ledger/RPC workflow after the recovered state is validated.

## Recovery evidence
Record backup timestamp, recovery target, migration history comparison, security audit output, smoke-test results, and final cutover decision.
