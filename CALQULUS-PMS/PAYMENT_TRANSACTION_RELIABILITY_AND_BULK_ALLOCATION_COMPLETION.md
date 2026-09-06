# Payment Transaction Reliability & Bulk Allocation Completion

Completed related payment-flow hardening:

1. **Durable STK transaction before Safaricom request**
   - Creates the pending payment transaction and callback secret before issuing the STK push.
   - Prevents a successful Safaricom request from existing without a local reconciliation record.
   - Failed STK responses mark the pre-created transaction failed.

2. **Callback recovery by callback secret**
   - If the Safaricom checkout/merchant IDs cannot be attached immediately after STK initiation, the callback can recover the pending transaction using its protected callback secret.
   - Existing secret validation remains mandatory.

3. **Multi-invoice fallback allocation correctness**
   - The direct STK verification fallback now reads the stored invoice list and passes `invoiceIds` into the central payment processor.
   - A combined payment therefore cannot silently allocate only to the primary invoice when the normal callback was missed.

4. **Partial-payment UI correctness**
   - The M-Pesa dialog now uses `balance_due` when available instead of the original invoice amount.
   - The amount shown/sent to the customer therefore matches the current outstanding balance.

## Verification
- Cross-role isolation audit: PASS
- Migration chain audit: PASS (historical exceptions acknowledged; no new violations)
- Deployment controls audit: PASS
- Full npm/TypeScript/Vitest/build verification remains unavailable in this packaged workspace because dependencies are not installed.
- Git is intentionally unavailable in the packaged workspace; commit/push must be performed from the user's local Git checkout.
