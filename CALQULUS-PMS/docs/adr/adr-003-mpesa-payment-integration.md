# ADR-003: M-Pesa Payment Integration Strategy

**Status**: Accepted  
**Date**: 2024-02-10  
**Deciders**: Platform Team, Finance Team

## Context

M-Pesa is the dominant mobile money platform in Kenya, with over 90% market penetration. Our target users (property managers and tenants) predominantly use M-Pesa for transactions. We needed to integrate M-Pesa for:

1. **STK Push (Paybill/Till)**: Real-time payment requests
2. **Callbacks**: Payment confirmation
3. **Balance Inquiries**: Account balance checks
4. **Reversals**: Payment reversal handling

The challenge was designing a reliable, idempotent payment flow that handles:
- Network timeouts
- Duplicate callbacks
- Payment amount discrepancies
- Transaction reconciliation

## Decision

We implemented a **dual-channel payment system** with M-Pesa as the primary channel:

### Payment Flow Architecture

```
┌─────────┐     STK Push      ┌─────────┐
│ Tenant  │ ───────────────► │ Supabase│
│ Portal  │ ◄─────────────── │ Edge    │
└─────────┘    Callback      │Function │
                             └────┬────┘
                                  │
                                  ▼
                             ┌─────────┐
                             │ Safaricom│
                             │   API   │
                             └─────────┘
```

### Key Components

1. **initiate-mpesa-stk-push**: Creates payment request, validates amount, sends STK push
2. **mpesa-callback**: Processes M-Pesa callbacks, idempotency checks
3. **verify-mpesa-stk-status**: Polls Safaricom for transaction status
4. **record-payment**: Records successful payments in database

### Idempotency Strategy

```typescript
// Each payment has a unique idempotency key
const idempotencyKey = `${invoiceId}-${Date.now()}`;

// Before processing callback, check for duplicates
const existing = await supabase
  .from('payment_transactions')
  .select('id')
  .eq('transaction_id', mpesaReceipt)
  .single();

if (existing.data) {
  // Already processed, skip
  return { success: true, duplicate: true };
}
```

## Amount Tolerance

```typescript
// Allow 1 KES tolerance for rounding
const TOLERANCE = 1;
const amountMatch = Math.abs(
  callbackAmount - invoiceTotal
) <= TOLERANCE;
```

## Consequences

### Benefits

- **Idempotent Processing**: Duplicate callbacks handled gracefully
- **Amount Validation**: Prevents incorrect payment amounts
- **Audit Trail**: Complete transaction history with metadata
- **Multi-Provider Ready**: Architecture supports adding Stripe, bank transfers

### Drawbacks

- **Callback Reliability**: M-Pesa callbacks are not guaranteed; must poll as backup
- **Timeout Windows**: 10-minute timeout for STK push requires retry logic
- **Reconciliation Complexity**: Need nightly reconciliation jobs

## References

- [Payment Flow Test Report](../../PAYMENT_FLOW_RECEIPTS_TEST_REPORT.md)
- [M-Pesa API Documentation](https://developer.safaricom.co.ke/)
- [Edge Functions: Payment Processing](../edge-functions/payment-processing.md)
