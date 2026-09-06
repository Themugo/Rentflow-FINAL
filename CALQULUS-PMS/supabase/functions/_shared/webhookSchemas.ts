/**
 * _shared/webhookSchemas.ts
 *
 * Zod schemas for runtime validation of webhook payloads.
 * Ensures all incoming webhook data conforms to expected structure.
 *
 * Usage:
 *   import { mpesaCallbackSchema, bankWebhookSchema } from "../_shared/webhookSchemas.ts";
 *
 *   const result = mpesaCallbackSchema.safeParse(callbackData);
 *   if (!result.success) {
 *     return new Response("Invalid payload", { status: 400 });
 *   }
 */

// Zod schema definitions for webhook payloads
// Using basic validation patterns since Zod isn't available in Deno by default
// These schemas provide runtime validation with descriptive errors

export interface MpesaCallbackItem {
  Name: string;
  Value: unknown;
}

export interface MpesaCallbackPayload {
  Body: {
    stkCallback: {
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: MpesaCallbackItem[];
      };
    };
  };
}

export interface BankWebhookPayload {
  // Generic bank webhook format
  id?: string;
  transaction_id?: string;
  externalId?: string;
  reference?: string;
  narration?: string;
  description?: string;
  amount?: number;
  credit_amount?: number;
  transactionAmount?: number;
  date?: string;
  transaction_date?: string;
  value_date?: string;
  payer_name?: string;
  sender_name?: string;
  payer_phone?: string;
  phone?: string;
  msisdn?: string;
  account?: string;
  account_number?: string;
  [key: string]: unknown;
}

export interface StripeWebhookPayload {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  [key: string]: unknown;
}

/**
 * Validate M-Pesa callback payload structure
 */
export function validateMpesaCallback(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: MpesaCallbackPayload;
} {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Payload must be an object" };
  }

  const p = payload as Record<string, unknown>;

  // Check Body exists
  if (!p.Body || typeof p.Body !== "object") {
    return { valid: false, error: "Missing Body object" };
  }

  const body = p.Body as Record<string, unknown>;

  // Check stkCallback exists
  if (!body.stkCallback || typeof body.stkCallback !== "object") {
    return { valid: false, error: "Missing stkCallback object" };
  }

  const stkCallback = body.stkCallback as Record<string, unknown>;

  // Validate CheckoutRequestID
  if (typeof stkCallback.CheckoutRequestID !== "string" || !stkCallback.CheckoutRequestID) {
    return { valid: false, error: "CheckoutRequestID must be a non-empty string" };
  }

  // Validate ResultCode
  if (typeof stkCallback.ResultCode !== "number") {
    return { valid: false, error: "ResultCode must be a number" };
  }

  // Validate ResultDesc
  if (typeof stkCallback.ResultDesc !== "string") {
    return { valid: false, error: "ResultDesc must be a string" };
  }

  // Validate CallbackMetadata if present
  if (stkCallback.CallbackMetadata !== undefined) {
    if (typeof stkCallback.CallbackMetadata !== "object" || stkCallback.CallbackMetadata === null) {
      return { valid: false, error: "CallbackMetadata must be an object" };
    }

    const meta = stkCallback.CallbackMetadata as Record<string, unknown>;
    if (!Array.isArray(meta.Item)) {
      return { valid: false, error: "CallbackMetadata.Item must be an array" };
    }

    for (const item of meta.Item) {
      if (typeof item !== "object" || item === null) {
        return { valid: false, error: "Each CallbackMetadata.Item must be an object" };
      }
      const itemObj = item as Record<string, unknown>;
      if (typeof itemObj.Name !== "string") {
        return { valid: false, error: "Each Item must have a string Name" };
      }
    }
  }

  return { valid: true, data: payload as MpesaCallbackPayload };
}

/**
 * Validate bank webhook payload structure
 */
export function validateBankWebhook(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: BankWebhookPayload;
} {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Payload must be an object" };
  }

  const p = payload as Record<string, unknown>;

  // Amount validation (critical field)
  const amount = p.amount ?? p.credit_amount ?? p.transactionAmount;
  if (amount === undefined) {
    return { valid: false, error: "Missing amount field" };
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount)) {
    return { valid: false, error: "Amount must be a valid number" };
  }

  if (numAmount < 0) {
    return { valid: false, error: "Amount cannot be negative" };
  }

  return { valid: true, data: payload as BankWebhookPayload };
}

/**
 * Extract M-Pesa metadata from callback
 */
export function extractMpesaMetadata(
  callback: MpesaCallbackPayload
): {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  amount?: number;
  receiptNumber?: string;
  transactionDate?: string;
  phone?: string;
} {
  const stkCallback = callback.Body.stkCallback;
  const getVal = (name: string) =>
    stkCallback.CallbackMetadata?.Item.find((m) => m.Name === name)?.Value;

  return {
    checkoutRequestId: stkCallback.CheckoutRequestID,
    resultCode: stkCallback.ResultCode,
    resultDesc: stkCallback.ResultDesc,
    amount: getVal("Amount") !== undefined ? Number(getVal("Amount")) : undefined,
    receiptNumber: getVal("MpesaReceiptNumber") as string | undefined,
    transactionDate: getVal("TransactionDate") as string | undefined,
    phone: getVal("PhoneNumber") as string | undefined,
  };
}

/**
 * Sanitize and normalize bank webhook payload
 */
export function normalizeBankPayload(
  raw: BankWebhookPayload
): {
  externalId: string;
  reference: string;
  description: string;
  amount: number;
  date: string;
  payerName: string;
  payerPhone: string;
  accountNumber: string;
} {
  return {
    externalId: String(
      raw.id ?? raw.transaction_id ?? raw.externalId ?? ""
    ),
    reference: String(
      raw.reference ?? raw.narration ?? raw.description ?? ""
    ),
    description: String(raw.description ?? raw.narration ?? ""),
    amount: Number(raw.amount ?? raw.credit_amount ?? raw.transactionAmount ?? 0),
    date: String(
      raw.date ?? raw.transaction_date ?? raw.value_date ?? new Date().toISOString()
    ),
    payerName: String(raw.payer_name ?? raw.sender_name ?? ""),
    payerPhone: String(raw.payer_phone ?? raw.phone ?? raw.msisdn ?? ""),
    accountNumber: String(raw.account ?? raw.account_number ?? ""),
  };
}
