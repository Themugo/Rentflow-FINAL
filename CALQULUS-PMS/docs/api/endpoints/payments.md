# Payments API

## Endpoints

### POST /initiate-mpesa-stk-push

Initiate an M-Pesa STK Push payment request.

**Request:**
```json
{
  "invoiceIds": ["uuid-1", "uuid-2"],
  "amount": 25000,
  "phoneNumber": "0712345678",
  "paymentType": "paybill"
}
```

**Response (200):**
```json
{
  "data": {
    "merchantRequestId": "MR12345",
    "checkoutRequestId": "CK12345",
    "responseCode": "0",
    "responseDescription": "Success",
    "customerMessage": "Accept the payment request on your phone"
  },
  "error": null
}
```

**Validation Rules:**
- `invoiceIds`: Required, max 20 IDs, all must belong to caller tenant
- `amount`: Required, must match invoice total (±1 KES tolerance)
- `phoneNumber`: Required, valid Kenyan number (07xx or 254xx)
- `paymentType`: Required, "paybill" or "till"

---

### POST /mpesa-callback

Process M-Pesa payment callback.

**Request:**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "MR12345",
      "CheckoutRequestID": "CK12345",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 25000 },
          { "Name": "MpesaReceiptNumber", "Value": "QWE123456" },
          { "Name": "TransactionDate", "Value": "20240101120000" },
          { "Name": "PhoneNumber", "Value": "254712345678" }
        ]
      }
    }
  }
}
```

**Response (200):**
```json
{
  "data": {
    "ResultCode": 0,
    "ResultDesc": "Success"
  }
}
```

---

### POST /record-payment

Record a payment transaction.

**Request:**
```json
{
  "invoiceId": "uuid",
  "amount": 25000,
  "paymentMethod": "mpesa",
  "transactionId": "QWE123456",
  "metadata": {
    "mpesaReceipt": "QWE123456"
  }
}
```

**Response (200):**
```json
{
  "data": {
    "id": "payment-uuid",
    "invoiceId": "uuid",
    "amount": 25000,
    "status": "completed",
    "transactionId": "QWE123456",
    "paymentDate": "2024-01-01T12:00:00Z"
  }
}
```

---

### GET /reconcile-payments

Get payment reconciliation report.

**Query Parameters:**
- `propertyId` (optional): Filter by property
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)

**Response (200):**
```json
{
  "data": {
    "totalCollected": 1250000,
    "totalPending": 250000,
    "payments": [
      {
        "id": "payment-uuid",
        "invoiceId": "invoice-uuid",
        "amount": 25000,
        "paymentMethod": "mpesa",
        "transactionId": "QWE123456",
        "paymentDate": "2024-01-01T12:00:00Z",
        "status": "completed"
      }
    ],
    "discrepancies": []
  }
}
```

---

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INVOICE` | Invoice not found or doesn't belong to caller |
| `AMOUNT_MISMATCH` | Payment amount doesn't match invoice total |
| `DUPLICATE_PAYMENT` | Transaction ID already processed |
| `PAYMENT_FAILED` | M-Pesa payment failed |
| `UNAUTHORIZED` | Caller not authorized for this invoice |

## Payment Methods

| Method | Code | Description |
|--------|------|-------------|
| M-Pesa | `mpesa` | Safaricom M-Pesa STK Push |
| Cash | `cash` | Cash payment recorded manually |
| Bank Transfer | `bank_transfer` | Bank deposit/transfer |
| Stripe | `stripe` | Card payments via Stripe |

## Idempotency

All payment endpoints support idempotency via the `X-Idempotency-Key` header:

```typescript
const idempotencyKey = `${invoiceId}-${Date.now()}`;

fetch('/functions/v1/record-payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({ ... }),
});
```

Duplicate requests with the same idempotency key return the original response without re-processing.
