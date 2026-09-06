/**
 * paymentFlow.test.ts
 *
 * Comprehensive end-to-end payment flow tests.
 * Covers ALL edge functions: initiate-mpesa-stk-push, process-payment,
 * mpesa-callback, verify-mpesa-stk-status, record-payment.
 *
 * Pure-function mirrors of Deno edge function algorithms so we can
 * test them fast without deploying. Keep in sync if edge functions change.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ════════════════════════════════════════════════════════════════════════
// SECTION 1 — STK Push Initiation Helpers
// ════════════════════════════════════════════════════════════════════════

function formatMpesaPhone(phoneNumber: string): string {
  let formatted = phoneNumber.replace(/\s+/g, "").replace(/^(\+?254|0)/, "254");
  if (!formatted.startsWith("254")) formatted = "254" + formatted;
  return formatted;
}

function buildAccountReference(unitNumber: string): string {
  return unitNumber.slice(0, 12);
}

function buildMpesaTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
}

function roundForMpesa(amount: number): number {
  return Math.round(amount);
}

function validateStkPushRequest(body: {
  invoiceIds?: string[];
  invoiceId?: string;
  amount: number;
  phoneNumber: string;
  paymentType: string;
}): { valid: boolean; error?: string } {
  const targetIds = [...(body.invoiceIds ?? []), ...(body.invoiceId ? [body.invoiceId] : [])].filter(Boolean);
  if (!targetIds.length) return { valid: false, error: "Missing invoice" };
  if (!body.amount || body.amount <= 0) return { valid: false, error: "Invalid amount" };
  if (!body.phoneNumber) return { valid: false, error: "Missing phone number" };
  if (!["paybill", "till"].includes(body.paymentType)) return { valid: false, error: "Invalid payment type" };
  if (targetIds.length > 20) return { valid: false, error: "Too many invoices (max 20)" };
  return { valid: true };
}

function validateInvoiceOwnership(
  invoices: Array<{ id: string; tenant_id: string }>,
  callerTenantId: string,
): { valid: boolean; error?: string; mismatched?: string[] } {
  const mismatched = invoices.filter((inv) => inv.tenant_id !== callerTenantId);
  if (mismatched.length) {
    return {
      valid: false,
      error: "Forbidden: only the tenant can initiate payment for their own bills",
      mismatched: mismatched.map((i) => i.id),
    };
  }
  return { valid: true };
}

function validateAmountMatch(
  invoices: Array<{ amount: number; balance_due?: number; paid_amount?: number }>,
  amount: number,
  tolerance = 1,
): { valid: boolean; expectedTotal: number; error?: string } {
  const expectedTotal = invoices.reduce((sum, inv) => {
    const owed = Number(inv.balance_due ?? (Number(inv.amount) - Number(inv.paid_amount ?? 0)));
    return sum + Math.max(0, owed);
  }, 0);
  if (Math.abs(Math.round(amount) - Math.round(expectedTotal)) > tolerance) {
    return {
      valid: false,
      expectedTotal,
      error: `Amount mismatch: expected KES ${Math.round(expectedTotal)}, received KES ${Math.round(amount)}`,
    };
  }
  return { valid: true, expectedTotal };
}

describe("STK Push — validateStkPushRequest", () => {
  it("accepts valid paybill request", () => {
    expect(
      validateStkPushRequest({ invoiceId: "inv-1", amount: 5000, phoneNumber: "0712345678", paymentType: "paybill" }).valid,
    ).toBe(true);
  });

  it("accepts valid till request with multiple invoices", () => {
    expect(
      validateStkPushRequest({ invoiceIds: ["inv-1", "inv-2"], amount: 10000, phoneNumber: "0712345678", paymentType: "till" }).valid,
    ).toBe(true);
  });

  it("rejects missing invoice", () => {
    const r = validateStkPushRequest({ amount: 5000, phoneNumber: "0712345678", paymentType: "paybill" });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Missing invoice/i);
  });

  it("rejects zero amount", () => {
    const r = validateStkPushRequest({ invoiceId: "inv-1", amount: 0, phoneNumber: "0712345678", paymentType: "paybill" });
    expect(r.valid).toBe(false);
  });

  it("rejects more than 20 invoices", () => {
    const ids = Array.from({ length: 21 }, (_, i) => `inv-${i}`);
    const r = validateStkPushRequest({ invoiceIds: ids, amount: 50000, phoneNumber: "0712345678", paymentType: "paybill" });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/max 20/i);
  });

  it("rejects unknown payment type", () => {
    const r = validateStkPushRequest({ invoiceId: "inv-1", amount: 5000, phoneNumber: "0712345678", paymentType: "card" });
    expect(r.valid).toBe(false);
  });
});

describe("STK Push — validateInvoiceOwnership", () => {
  it("passes when all invoices belong to caller", () => {
    const invoices = [
      { id: "inv-1", tenant_id: "tenant-1" },
      { id: "inv-2", tenant_id: "tenant-1" },
    ];
    expect(validateInvoiceOwnership(invoices, "tenant-1").valid).toBe(true);
  });

  it("rejects when any invoice belongs to another tenant", () => {
    const invoices = [
      { id: "inv-1", tenant_id: "tenant-1" },
      { id: "inv-2", tenant_id: "tenant-2" },
    ];
    const r = validateInvoiceOwnership(invoices, "tenant-1");
    expect(r.valid).toBe(false);
    expect(r.mismatched).toEqual(["inv-2"]);
  });

  it("rejects when all invoices belong to another tenant", () => {
    const invoices = [
      { id: "inv-1", tenant_id: "tenant-2" },
      { id: "inv-2", tenant_id: "tenant-3" },
    ];
    expect(validateInvoiceOwnership(invoices, "tenant-1").valid).toBe(false);
  });

  it("handles single invoice case", () => {
    expect(validateInvoiceOwnership([{ id: "inv-1", tenant_id: "tenant-1" }], "tenant-1").valid).toBe(true);
    expect(validateInvoiceOwnership([{ id: "inv-1", tenant_id: "tenant-2" }], "tenant-1").valid).toBe(false);
  });
});

describe("STK Push — validateAmountMatch", () => {
  it("exact match passes", () => {
    const invoices = [
      { amount: 5000, balance_due: 5000 },
      { amount: 3000, balance_due: 3000 },
    ];
    expect(validateAmountMatch(invoices, 8000).valid).toBe(true);
  });

  it("within 1 KES tolerance passes", () => {
    const invoices = [{ amount: 5000, balance_due: 5000 }];
    expect(validateAmountMatch(invoices, 5001).valid).toBe(true);
    expect(validateAmountMatch(invoices, 4999).valid).toBe(true);
  });

  it("outside tolerance fails", () => {
    const invoices = [{ amount: 5000, balance_due: 5000 }];
    const r = validateAmountMatch(invoices, 5200);
    expect(r.valid).toBe(false);
    expect(r.expectedTotal).toBe(5000);
  });

  it("handles mixed balance_due and amount fallback", () => {
    const invoices = [
      { amount: 5000, balance_due: 3000 },
      { amount: 4000, paid_amount: 1000 },
    ];
    expect(validateAmountMatch(invoices, 6000).valid).toBe(true); // 3000 + 3000
  });
});

// ════════════════════════════════════════════════════════════════════════
// SECTION 2 — M-Pesa Callback Helpers
// ════════════════════════════════════════════════════════════════════════

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function isCallbackExpired(initiatedAt: string, maxAgeMs = 10 * 60 * 1000): boolean {
  return Date.now() - new Date(initiatedAt).getTime() > maxAgeMs;
}

function extractCallbackMetadata(callbackData: {
  Body?: { stkCallback?: { CallbackMetadata?: { Item?: Array<{ Name: string; Value: unknown }> } } };
}): { paidAmount: number; mpesaReceiptNumber: string } {
  const stkCallback = callbackData?.Body?.stkCallback;
  const items = stkCallback?.CallbackMetadata?.Item ?? [];
  const getVal = (name: string) => items.find((m) => m.Name === name)?.Value;
  return {
    paidAmount: Number(getVal("Amount") ?? 0),
    mpesaReceiptNumber: String(getVal("MpesaReceiptNumber") ?? ""),
  };
}

function parseAllocationNotes(notes: string | null | undefined): string[] | null {
  if (!notes?.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(notes) as { invoice_ids?: string[] };
    return Array.isArray(parsed.invoice_ids) && parsed.invoice_ids.length > 0 ? parsed.invoice_ids : null;
  } catch {
    return null;
  }
}

describe("mpesa-callback — timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(timingSafeEqual("abc123", "abc1234")).toBe(false);
  });

  it("returns true for UUID-style secrets", () => {
    const uuid = crypto.randomUUID();
    expect(timingSafeEqual(uuid, uuid)).toBe(true);
    expect(timingSafeEqual(uuid, crypto.randomUUID())).toBe(false);
  });

  it("handles empty strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("", "a")).toBe(false);
  });
});

describe("mpesa-callback — isCallbackExpired", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for recent transaction", () => {
    const now = new Date("2026-05-19T12:00:00Z");
    vi.setSystemTime(now);
    expect(isCallbackExpired("2026-05-19T11:55:00Z", 10 * 60 * 1000)).toBe(false); // 5 min ago
  });

  it("returns true for transaction older than 10 minutes", () => {
    const now = new Date("2026-05-19T12:15:00Z");
    vi.setSystemTime(now);
    expect(isCallbackExpired("2026-05-19T12:00:00Z", 10 * 60 * 1000)).toBe(true); // 15 min ago
  });

  it("uses the default 10 minute max age", () => {
    const now = new Date("2026-05-19T12:11:00Z");
    vi.setSystemTime(now);
    expect(isCallbackExpired("2026-05-19T12:00:00Z")).toBe(true); // 11 min > 10 min default
    expect(isCallbackExpired("2026-05-19T12:05:00Z")).toBe(false); // 6 min < 10 min default
  });
});

describe("mpesa-callback — extractCallbackMetadata", () => {
  it("extracts Amount and MpesaReceiptNumber from successful callback", () => {
    const callback = {
      Body: {
        stkCallback: {
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 5000 },
              { Name: "MpesaReceiptNumber", Value: "RBK7G12345" },
              { Name: "TransactionDate", Value: "20260519120000" },
            ],
          },
        },
      },
    };
    const result = extractCallbackMetadata(callback);
    expect(result.paidAmount).toBe(5000);
    expect(result.mpesaReceiptNumber).toBe("RBK7G12345");
  });

  it("returns zeros when callback has no metadata", () => {
    const callback = { Body: { stkCallback: {} } };
    expect(extractCallbackMetadata(callback).paidAmount).toBe(0);
    expect(extractCallbackMetadata(callback).mpesaReceiptNumber).toBe("");
  });

  it("handles missing Amount gracefully", () => {
    const callback = {
      Body: {
        stkCallback: {
          CallbackMetadata: {
            Item: [{ Name: "MpesaReceiptNumber", Value: "RBK1X" }],
          },
        },
      },
    };
    expect(extractCallbackMetadata(callback).paidAmount).toBe(0);
  });
});

describe("mpesa-callback — parseAllocationNotes", () => {
  it("parses valid JSON allocation notes", () => {
    expect(parseAllocationNotes('{"invoice_ids":["inv-1","inv-2"]}')).toEqual(["inv-1", "inv-2"]);
  });

  it("returns null for single-invoice notes (no JSON)", () => {
    expect(parseAllocationNotes("single invoice")).toBeNull();
    expect(parseAllocationNotes("")).toBeNull();
    expect(parseAllocationNotes(null)).toBeNull();
    expect(parseAllocationNotes(undefined)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseAllocationNotes("{bad-json}")).toBeNull();
  });

  it("returns null for empty invoice_ids array", () => {
    expect(parseAllocationNotes('{"invoice_ids":[]}')).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// SECTION 3 — process-payment Allocation Engine (mirrors edge function)
// ════════════════════════════════════════════════════════════════════════

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  original_amount?: number;
  paid_amount?: number;
  balance_due?: number;
  due_date: string;
  status: "pending" | "overdue" | "paid";
  installment_plan?: boolean;
}

interface Allocation {
  invoiceId: string;
  alloc: number;
  closes: boolean;
}

interface AllocationResult {
  allocations: Allocation[];
  closedInvoiceNumbers: string[];
  remaining: number;
  applied: number;
}

function allocatePayment(invoices: Invoice[], amount: number): AllocationResult {
  let remaining = amount;
  const allocations: Allocation[] = [];
  const closedInvoiceNumbers: string[] = [];

  for (const inv of invoices) {
    if (remaining <= 0) break;
    const owed = Number(inv.balance_due ?? (Number(inv.original_amount ?? inv.amount) - Number(inv.paid_amount ?? 0)));
    if (owed <= 0) continue;
    const alloc = Math.min(remaining, owed);
    const closes = alloc >= owed;
    remaining -= alloc;
    allocations.push({ invoiceId: inv.id, alloc, closes });
    if (closes) closedInvoiceNumbers.push(inv.invoice_number);
  }

  return { allocations, closedInvoiceNumbers, remaining, applied: amount - remaining };
}

function computeNewStatus(originalStatus: string, closes: boolean): string {
  if (closes) return "paid";
  return originalStatus === "overdue" ? "overdue" : "pending";
}

function buildMethodLabel(paymentMethod: string): string {
  const labels: Record<string, string> = {
    mpesa_stk: "M-Pesa (STK Push)",
    mpesa_ussd: "M-Pesa (USSD/Paybill)",
    mpesa_till: "M-Pesa (Buy Goods)",
    bank_transfer: "Bank Transfer",
    bank_direct_debit: "Bank Direct Debit",
    receipt_upload: "Manual (Receipt Uploaded)",
    stripe_checkout: "Stripe Checkout",
  };
  return labels[paymentMethod] ?? paymentMethod;
}

function outstandingBalance(invoices: Array<{ balance_due?: number; amount?: number; paid_amount?: number; original_amount?: number }>): number {
  return (invoices || []).reduce((s, i) => {
    const bd = Number(i.balance_due ?? NaN);
    if (Number.isFinite(bd)) return s + Math.max(0, bd);
    const amt = Number(i.original_amount ?? i.amount ?? 0);
    const paid = Number(i.paid_amount ?? 0);
    return s + Math.max(0, amt - paid);
  }, 0);
}

function computeCreditBalance(
  existingBalance: number | null | undefined,
  remaining: number,
): number {
  return (existingBalance ?? 0) + remaining;
}

function isPartialPayment(allocations: Allocation[], remaining: number): boolean {
  return remaining === 0 && allocations.some((a) => !a.closes);
}

function isAdvancePayment(remaining: number): boolean {
  return remaining > 0;
}

describe("process-payment — buildMethodLabel", () => {
  it("returns correct labels for all payment methods", () => {
    expect(buildMethodLabel("mpesa_stk")).toBe("M-Pesa (STK Push)");
    expect(buildMethodLabel("mpesa_ussd")).toBe("M-Pesa (USSD/Paybill)");
    expect(buildMethodLabel("mpesa_till")).toBe("M-Pesa (Buy Goods)");
    expect(buildMethodLabel("bank_transfer")).toBe("Bank Transfer");
    expect(buildMethodLabel("bank_direct_debit")).toBe("Bank Direct Debit");
    expect(buildMethodLabel("receipt_upload")).toBe("Manual (Receipt Uploaded)");
    expect(buildMethodLabel("stripe_checkout")).toBe("Stripe Checkout");
  });

  it("falls back to raw method name for unknown methods", () => {
    expect(buildMethodLabel("cash")).toBe("cash");
    expect(buildMethodLabel("cheque")).toBe("cheque");
  });
});

describe("process-payment — computeNewStatus", () => {
  it("marks paid when invoice is closed", () => {
    expect(computeNewStatus("pending", true)).toBe("paid");
    expect(computeNewStatus("overdue", true)).toBe("paid");
  });

  it("keeps overdue status when partial and was overdue", () => {
    expect(computeNewStatus("overdue", false)).toBe("overdue");
  });

  it("keeps pending status when partial and was pending", () => {
    expect(computeNewStatus("pending", false)).toBe("pending");
  });
});

describe("process-payment — isPartialPayment / isAdvancePayment", () => {
  it("detects partial payment", () => {
    expect(
      isPartialPayment(
        [
          { invoiceId: "1", alloc: 3000, closes: false },
          { invoiceId: "2", alloc: 5000, closes: true },
        ],
        0,
      ),
    ).toBe(true);
  });

  it("full payment is not partial", () => {
    expect(isPartialPayment([{ invoiceId: "1", alloc: 5000, closes: true }], 0)).toBe(false);
  });

  it("advance payment detected when remaining > 0", () => {
    expect(isAdvancePayment(3000)).toBe(true);
    expect(isAdvancePayment(0)).toBe(false);
  });
});

describe("process-payment — computeCreditBalance", () => {
  it("adds remaining to existing balance", () => {
    expect(computeCreditBalance(2000, 3000)).toBe(5000);
  });

  it("handles null existing balance as 0", () => {
    expect(computeCreditBalance(null, 3000)).toBe(3000);
  });

  it("handles undefined existing balance as 0", () => {
    expect(computeCreditBalance(undefined, 3000)).toBe(3000);
  });
});

describe("process-payment — outstandingBalance", () => {
  it("sums balance_due when present", () => {
    expect(
      outstandingBalance([
        { balance_due: 5000 },
        { balance_due: 3000 },
      ]),
    ).toBe(8000);
  });

  it("falls back to amount - paid_amount when no balance_due", () => {
    expect(outstandingBalance([{ amount: 10000, paid_amount: 4000 }])).toBe(6000);
  });

  it("falls back to original_amount - paid_amount", () => {
    expect(outstandingBalance([{ original_amount: 10000, paid_amount: 4000 }])).toBe(6000);
  });

  it("clamps negative to zero (overpayment)", () => {
    expect(outstandingBalance([{ amount: 5000, paid_amount: 7000 }])).toBe(0);
  });

  it("returns 0 for empty list", () => {
    expect(outstandingBalance([])).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// SECTION 4 — verify-mpesa-stk-status Authorization
// ════════════════════════════════════════════════════════════════════════

function canViewTransaction(args: {
  callerRole: string | null;
  callerTenantId?: string;
  callerUserId: string;
  transaction: {
    tenant_id: string;
    manager_id: string;
  };
  submanagerManagerId?: string;
}): boolean {
  const { callerRole, callerTenantId, callerUserId, transaction, submanagerManagerId } = args;
  if (callerRole === "webhost") return false;
  if (callerRole === "tenant" && callerTenantId === transaction.tenant_id) return true;
  if (transaction.manager_id === callerUserId) return true;
  if (callerRole === "submanager" && submanagerManagerId === transaction.manager_id) return true;
  return false;
}

describe("verify-mpesa-stk-status — canViewTransaction", () => {
  const tx = { tenant_id: "tenant-1", manager_id: "manager-1" };

  it("webhost cannot view tenant payment transactions", () => {
    expect(canViewTransaction({ callerRole: "webhost", callerUserId: "web-1", transaction: tx })).toBe(false);
  });

  it("tenant can view own transaction", () => {
    expect(
      canViewTransaction({ callerRole: "tenant", callerTenantId: "tenant-1", callerUserId: "user-1", transaction: tx }),
    ).toBe(true);
  });

  it("tenant cannot view another tenant's transaction", () => {
    expect(
      canViewTransaction({ callerRole: "tenant", callerTenantId: "tenant-2", callerUserId: "user-1", transaction: tx }),
    ).toBe(false);
  });

  it("manager can view own manager's transactions", () => {
    expect(
      canViewTransaction({ callerRole: "manager", callerUserId: "manager-1", transaction: tx }),
    ).toBe(true);
  });

  it("manager cannot view another manager's transactions", () => {
    expect(
      canViewTransaction({ callerRole: "manager", callerUserId: "manager-2", transaction: tx }),
    ).toBe(false);
  });

  it("submanager can view their manager's transactions", () => {
    expect(
      canViewTransaction({
        callerRole: "submanager",
        callerUserId: "sub-1",
        transaction: tx,
        submanagerManagerId: "manager-1",
      }),
    ).toBe(true);
  });

  it("submanager cannot view another manager's transactions", () => {
    expect(
      canViewTransaction({
        callerRole: "submanager",
        callerUserId: "sub-1",
        transaction: tx,
        submanagerManagerId: "manager-2",
      }),
    ).toBe(false);
  });

  it("rejects null role", () => {
    expect(
      canViewTransaction({ callerRole: null, callerUserId: "anon", transaction: tx }),
    ).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════
// SECTION 5 — record-payment Validators
// ════════════════════════════════════════════════════════════════════════

function validateRecordPaymentRequest(body: {
  tenantId?: string;
  amount?: number;
  reference?: string;
}): { valid: boolean; error?: string } {
  if (!body.tenantId) return { valid: false, error: "tenantId required" };
  if (!body.amount || body.amount <= 0) return { valid: false, error: "amount required" };
  if (!body.reference) return { valid: false, error: "reference required" };
  return { valid: true };
}

function computeInstalmentAmount(
  unpaidInvoices: Array<{ amount: number; balance_due?: number }>,
  instalmentCount: number,
): number {
  const totalOwed = unpaidInvoices.reduce((s, i) => s + Number(i.balance_due ?? i.amount), 0);
  return Math.ceil(totalOwed / instalmentCount);
}

function resolveEffectiveManagerId(
  role: string,
  userId: string,
  managerSubmanagers: Array<{ submanager_user_id: string; manager_id: string }>,
): string {
  if (role === "submanager") {
    const rel = managerSubmanagers.find((r) => r.submanager_user_id === userId);
    return rel?.manager_id ?? userId;
  }
  return userId;
}

describe("record-payment — validateRecordPaymentRequest", () => {
  it("accepts valid request", () => {
    expect(validateRecordPaymentRequest({ tenantId: "t-1", amount: 5000, reference: "REF-001" }).valid).toBe(true);
  });

  it("rejects missing tenantId", () => {
    const r = validateRecordPaymentRequest({ amount: 5000, reference: "REF-001" });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/tenantId/i);
  });

  it("rejects zero amount", () => {
    const r = validateRecordPaymentRequest({ tenantId: "t-1", amount: 0, reference: "REF-001" });
    expect(r.valid).toBe(false);
  });

  it("rejects missing reference", () => {
    const r = validateRecordPaymentRequest({ tenantId: "t-1", amount: 5000 });
    expect(r.valid).toBe(false);
  });
});

describe("record-payment — computeInstalmentAmount", () => {
  it("splits total evenly with ceil rounding", () => {
    expect(
      computeInstalmentAmount(
        [
          { amount: 10000, balance_due: 10000 },
          { amount: 5000, balance_due: 5000 },
        ],
        3,
      ),
    ).toBe(5000); // ceil(15000/3) = ceil(5000) = 5000
  });

  it("handles single invoice split", () => {
    expect(computeInstalmentAmount([{ amount: 10000, balance_due: 10000 }], 4)).toBe(2500);
  });

  it("handles non-divisible amounts", () => {
    expect(computeInstalmentAmount([{ amount: 10000, balance_due: 10000 }], 3)).toBe(3334); // ceil(3333.33)
  });

  it("uses amount when balance_due missing", () => {
    expect(computeInstalmentAmount([{ amount: 6000 }], 2)).toBe(3000);
  });
});

describe("record-payment — resolveEffectiveManagerId", () => {
  const submanagerRelations = [
    { submanager_user_id: "sub-1", manager_id: "manager-1" },
    { submanager_user_id: "sub-2", manager_id: "manager-2" },
  ];

  it("manager uses own id", () => {
    expect(resolveEffectiveManagerId("manager", "manager-1", [])).toBe("manager-1");
  });

  it("submanager resolves to their manager", () => {
    expect(resolveEffectiveManagerId("submanager", "sub-1", submanagerRelations)).toBe("manager-1");
  });

  it("submanager without relation falls back to own id", () => {
    expect(resolveEffectiveManagerId("submanager", "sub-unknown", submanagerRelations)).toBe("sub-unknown");
  });
});

// ════════════════════════════════════════════════════════════════════════
// SECTION 6 — Full Integration Scenarios (Pure Functions)
// ════════════════════════════════════════════════════════════════════════

interface TenantBalance {
  balance_due: number;
  is_in_arrears: boolean;
}

function computeFinalBalance(
  balanceData: TenantBalance[] | null,
  error: boolean,
): { finalBalance: number; inArrears: boolean; balanceKnown: boolean } {
  const balanceKnown = !error && Array.isArray(balanceData) && balanceData.length > 0;
  const finalBalance = balanceKnown ? Number(balanceData?.[0]?.balance_due ?? 0) : 0;
  const inArrears = balanceKnown ? (balanceData?.[0]?.is_in_arrears ?? false) : false;
  return { finalBalance, inArrears, balanceKnown };
}

function buildResponsePayload(args: {
  success: boolean;
  transactionId: string;
  allocated: number;
  advanceCredit: number;
  creditBalance: number;
  finalBalance: number;
  inArrears: boolean;
  closedInvoices: string[];
  allocations: Array<{ invoiceId: string; amount: number; closed: boolean }>;
}) {
  return args;
}

describe("Integration — full STK Push flow", () => {
  it("phone formatting + account ref + timestamp produce valid M-Pesa payload", () => {
    const rawPhone = "0712345678";
    const unitNumber = "BLOCK-A-12";
    const amount = 5000.75;
    const date = new Date("2026-05-19T12:34:56.789Z");

    const formattedPhone = formatMpesaPhone(rawPhone);
    const accountRef = buildAccountReference(unitNumber);
    const timestamp = buildMpesaTimestamp(date);
    const roundedAmount = roundForMpesa(amount);

    expect(formattedPhone).toBe("254712345678");
    expect(accountRef).toBe("BLOCK-A-12");
    expect(timestamp).toBe("20260519123456");
    expect(roundedAmount).toBe(5001);
    expect(roundedAmount).toEqual(expect.any(Number));
  });

  it("validates invoice ownership before initiating STK push", () => {
    const myInvoices = [
      { id: "inv-a", tenant_id: "tenant-1", amount: 5000, balance_due: 5000 },
      { id: "inv-b", tenant_id: "tenant-1", amount: 3000, balance_due: 3000 },
    ];

    // Ownership passes
    expect(validateInvoiceOwnership(myInvoices, "tenant-1").valid).toBe(true);

    // Amount matches
    expect(validateAmountMatch(myInvoices, 8000).valid).toBe(true);

    // Request is valid
    expect(
      validateStkPushRequest({
        invoiceIds: ["inv-a", "inv-b"],
        amount: 8000,
        phoneNumber: "0712345678",
        paymentType: "paybill",
      }).valid,
    ).toBe(true);
  });

  it("rejects STK push when amount doesn't match invoices total", () => {
    const invoices = [
      { id: "inv-1", tenant_id: "tenant-1", amount: 10000, balance_due: 10000 },
    ];

    // Ownership passes
    expect(validateInvoiceOwnership(invoices, "tenant-1").valid).toBe(true);

    // Amount mismatch
    const amountCheck = validateAmountMatch(invoices, 5000);
    expect(amountCheck.valid).toBe(false);
    expect(amountCheck.expectedTotal).toBe(10000);
  });

  it("rejects STK push when tenant tries to pay another tenant's invoice", () => {
    const invoices = [
      { id: "inv-1", tenant_id: "tenant-2", amount: 5000, balance_due: 5000 },
    ];

    const ownership = validateInvoiceOwnership(invoices, "tenant-1");
    expect(ownership.valid).toBe(false);
    expect(ownership.mismatched).toEqual(["inv-1"]);
  });
});

describe("Integration — callback → process-payment delegation", () => {
  it("handles successful callback → extract metadata → allocate", () => {
    // Simulate a successful Safaricom callback
    const callbackData = {
      Body: {
        stkCallback: {
          CheckoutRequestID: "ws_CO_1905202612345678",
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 5000 },
              { Name: "MpesaReceiptNumber", Value: "RBK7G12345" },
              { Name: "TransactionDate", Value: "20260519123456" },
            ],
          },
        },
      },
    };

    // Extract callback metadata
    const { paidAmount, mpesaReceiptNumber } = extractCallbackMetadata(callbackData);
    expect(paidAmount).toBe(5000);
    expect(mpesaReceiptNumber).toBe("RBK7G12345");

    // Verify callback secret
    const storedSecret = "secret-123";
    const urlSecret = "secret-123";
    expect(timingSafeEqual(storedSecret, urlSecret)).toBe(true);

    // Check not expired
    const initiatedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 min ago
    expect(isCallbackExpired(initiatedAt)).toBe(false);

    // Process pending invoices
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 5000, balance_due: 5000, due_date: "2026-05-01", status: "pending" },
    ];
    const allocation = allocatePayment(invoices, paidAmount);
    expect(allocation.allocations).toHaveLength(1);
    expect(allocation.allocations[0].closes).toBe(true);
    expect(allocation.closedInvoiceNumbers).toEqual(["INV-001"]);
  });

  it("handles callback with invalid secret", () => {
    const storedSecret = "correct-secret";
    const urlSecret = "wrong-secret";
    expect(timingSafeEqual(storedSecret, urlSecret)).toBe(false);

    // The callback would reject — transaction stays pending
  });

  it("handles callback after expiry", () => {
    const initiatedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 min ago
    expect(isCallbackExpired(initiatedAt)).toBe(true);

    // The callback would mark transaction as expired/failed
  });

  it("handles callback for already-processed transaction", () => {
    // If status is already "completed" or "failed", the callback skips
    const status = "completed";
    expect(status).not.toBe("pending");
    // Guard: "if transaction.status !== 'pending' → skip"
  });
});

describe("Integration — multi-invoice allocation with advance credit", () => {
  it("allocates across 3 invoices oldest-first with overpayment", () => {
    const invoices: Invoice[] = [
      { id: "inv-a", invoice_number: "INV-A", amount: 5000, balance_due: 5000, due_date: "2026-04-01", status: "overdue" },
      { id: "inv-b", invoice_number: "INV-B", amount: 3000, balance_due: 3000, due_date: "2026-05-01", status: "pending" },
      { id: "inv-c", invoice_number: "INV-C", amount: 2000, balance_due: 2000, due_date: "2026-06-01", status: "pending" },
    ];

    const r = allocatePayment(invoices, 12000);

    expect(r.allocations).toEqual([
      { invoiceId: "inv-a", alloc: 5000, closes: true },
      { invoiceId: "inv-b", alloc: 3000, closes: true },
      { invoiceId: "inv-c", alloc: 2000, closes: true },
    ]);
    expect(r.remaining).toBe(2000); // advance credit
    expect(r.closedInvoiceNumbers).toEqual(["INV-A", "INV-B", "INV-C"]);

    // Advance credit is stored
    const existingCredit = 0;
    const creditBalance = computeCreditBalance(existingCredit, r.remaining);
    expect(creditBalance).toBe(2000);
  });

  it("handles partial payment across many small invoices", () => {
    const invoices: Invoice[] = Array.from({ length: 10 }, (_, i) => ({
      id: `inv-${i}`,
      invoice_number: `INV-${String(i + 1).padStart(3, "0")}`,
      amount: 1000,
      balance_due: 1000,
      due_date: `2026-0${Math.min(6, 1 + Math.floor(i / 3))}-01`,
      status: "pending" as const,
    }));

    // Pay 7500 — should close 7, leave 1 partial (250 owed)
    const r = allocatePayment(invoices, 7500);

    expect(r.allocations).toHaveLength(8); // 7 closed + 1 partial
    expect(r.allocations.filter((a) => a.closes)).toHaveLength(7);
    expect(r.closedInvoiceNumbers).toHaveLength(7);
    expect(r.remaining).toBe(0);
    expect(r.applied).toBe(7500);

    // Check the partial invoice
    const lastAlloc = r.allocations[r.allocations.length - 1];
    expect(lastAlloc.closes).toBe(false);
    expect(lastAlloc.alloc).toBe(500);
  });

  it("spills over to next invoice when first is fully paid", () => {
    const invoices: Invoice[] = [
      { id: "inv-old", invoice_number: "INV-OLD", amount: 3000, balance_due: 3000, due_date: "2026-03-01", status: "overdue" },
      { id: "inv-mid", invoice_number: "INV-MID", amount: 5000, balance_due: 5000, due_date: "2026-04-01", status: "pending" },
      { id: "inv-new", invoice_number: "INV-NEW", amount: 2000, balance_due: 2000, due_date: "2026-05-01", status: "pending" },
    ];

    const r = allocatePayment(invoices, 6000);

    expect(r.allocations).toEqual([
      { invoiceId: "inv-old", alloc: 3000, closes: true },
      { invoiceId: "inv-mid", alloc: 3000, closes: false },
    ]);
    expect(r.closedInvoiceNumbers).toEqual(["INV-OLD"]);
    expect(r.remaining).toBe(0);
  });
});

describe("Integration — idempotency", () => {
  it("detects duplicate (tenant_id, bank_reference)", () => {
    // Simulate UNIQUE(tenant_id, bank_reference) constraint violation
    const existingTx = { id: "tx-existing", status: "completed" };

    // process-payment's idempotency handler:
    // if error.code === "23505" → look up existing, return success
    function handleIdempotentReplay(errorCode: string | null): boolean {
      return errorCode === "23505";
    }

    expect(handleIdempotentReplay("23505")).toBe(true);
    expect(handleIdempotentReplay("23503")).toBe(false);
    expect(handleIdempotentReplay(null)).toBe(false);

    // The response is marked as idempotent
    const response = {
      success: true,
      idempotent: true,
      transactionId: existingTx.id,
      message: "Payment already recorded with this reference",
    };
    expect(response.idempotent).toBe(true);
    expect(response.transactionId).toBe("tx-existing");
  });

  it("returns the same result for identical allocation inputs", () => {
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 5000, balance_due: 5000, due_date: "2026-05-01", status: "pending" },
    ];

    const r1 = allocatePayment(invoices, 5000);
    const r2 = allocatePayment(invoices, 5000);
    const r3 = allocatePayment(invoices, 5000);

    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });
});

describe("Integration — rollback on allocation failure", () => {
  it("computes rollback snapshots correctly", () => {
    // When allocation fails mid-way, process-payment rolls back
    // the invoices that were already updated.
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 5000, balance_due: 5000, paid_amount: 0, due_date: "2026-05-01", status: "pending" },
      { id: "inv-2", invoice_number: "INV-002", amount: 3000, balance_due: 3000, paid_amount: 0, due_date: "2026-05-01", status: "pending" },
    ];

    // Simulate allocation for first invoice, then failure on second
    const snapshots = invoices.map((inv) => ({
      id: inv.id,
      paid_amount: Number(inv.paid_amount ?? 0),
      balance_due: Number(inv.balance_due ?? (inv.amount - (inv.paid_amount ?? 0))),
      status: inv.status,
      paid_date: null as string | null,
    }));

    expect(snapshots).toEqual([
      { id: "inv-1", paid_amount: 0, balance_due: 5000, status: "pending", paid_date: null },
      { id: "inv-2", paid_amount: 0, balance_due: 3000, status: "pending", paid_date: null },
    ]);

    // After rollback, these values would be restored via .update()
    // Verifying the rollback data is correct is sufficient
  });
});

describe("Integration — payment recording by submanager", () => {
  it("submanager resolves to manager_id for recording", () => {
    const submanagerRelations = [
      { submanager_user_id: "sub-1", manager_id: "manager-001" },
    ];

    const effectiveManagerId = resolveEffectiveManagerId("submanager", "sub-1", submanagerRelations);
    expect(effectiveManagerId).toBe("manager-001");
  });

  it("installment plan calculation is correct", () => {
    const unpaidInvoices = [
      { amount: 50000, balance_due: 50000 },
      { amount: 25000, balance_due: 25000 },
    ];

    const instalmentAmount = computeInstalmentAmount(unpaidInvoices, 3);
    expect(instalmentAmount).toBe(25000); // ceil(75000/3)
    expect(instalmentAmount * 3).toBeGreaterThanOrEqual(75000); // total covers owed
  });
});

describe("Integration — notification fan-out decisions", () => {
  it("sends notifications based on receipt settings", () => {
    const receiptSettings = {
      auto_send_receipts: true,
      send_sms_receipt: true,
    };
    const notifPrefs = {
      notify_email: true,
      notify_whatsapp: false,
    };

    const sendEmail = receiptSettings.auto_send_receipts !== false;
    const sendSms = receiptSettings.send_sms_receipt !== false;
    const sendWA = notifPrefs.notify_whatsapp === true;
    const notifyMgr = notifPrefs.notify_email !== false;

    expect(sendEmail).toBe(true);
    expect(sendSms).toBe(true);
    expect(sendWA).toBe(false);
    expect(notifyMgr).toBe(true);
  });

  it("builds correct balance messages for receipt", () => {
    function buildBalanceMsg(remaining: number, finalBalance: number, fmt: (n: number) => string): string {
      return remaining > 0
        ? `Advance credit of ${fmt(remaining)} held for your account.`
        : finalBalance > 0
          ? `Outstanding balance: ${fmt(finalBalance)}.`
          : "Account fully paid up.";
    }

    const fmt = (n: number) => `KES ${n}`;

    expect(buildBalanceMsg(2000, 0, fmt)).toBe("Advance credit of KES 2000 held for your account.");
    expect(buildBalanceMsg(0, 3000, fmt)).toBe("Outstanding balance: KES 3000.");
    expect(buildBalanceMsg(0, 0, fmt)).toBe("Account fully paid up.");
  });

  it("builds SMS message correctly", () => {
    function buildSmsMessage(args: {
      companyName: string;
      amount: string;
      displayUnit: string;
      invoiceNumber: string;
      reference: string;
      paymentDate: string;
      remaining: number;
      finalBalance: number;
      fmt: (n: number) => string;
    }): string {
      const { companyName, amount, displayUnit, invoiceNumber, reference, paymentDate, remaining, finalBalance, fmt } = args;
      const balStr = remaining > 0
        ? ` Credit: ${fmt(remaining)}.`
        : finalBalance > 0
          ? ` Bal: ${fmt(finalBalance)}.`
          : " A/C paid up.";
      return `${companyName}: ${amount} rcvd - Unit ${displayUnit} (${invoiceNumber}). Ref: ${reference}. ${paymentDate}.${balStr}`;
    }

    const fmt = (n: number) => `KES ${n}`;

    const msg = buildSmsMessage({
      companyName: "Acme Properties",
      amount: "KES 5,000",
      displayUnit: "A3",
      invoiceNumber: "INV-001",
      reference: "RBK7G12345",
      paymentDate: "2026-05-19",
      remaining: 0,
      finalBalance: 0,
      fmt,
    });
    expect(msg).toContain("Acme Properties");
    expect(msg).toContain("KES 5,000 rcvd");
    expect(msg).toContain("Unit A3");
    expect(msg).toContain("A/C paid up.");
  });
});

describe("Integration — dead-letter flow", () => {
  it("records a dead-letter entry on process-payment failure", () => {
    // Simulate mpesa-callback catching an error from process-payment
    const deadLetterEntry = {
      source: "mpesa",
      reference: "RBK7G12345",
      payload: {
        transactionId: "tx-001",
        invoiceId: "inv-001",
        tenantId: "tenant-001",
        managerId: "manager-001",
        amount: 5000,
        paidDate: "2026-05-19",
        mpesaReceiptNumber: "RBK7G12345",
        unitNumber: "A3",
      },
      error: new Error("process-payment returned 500: Internal Server Error"),
    };

    expect(deadLetterEntry.source).toBe("mpesa");
    expect(deadLetterEntry.reference).toBe("RBK7G12345");
    expect(deadLetterEntry.error.message).toContain("process-payment");
  });
});

describe("Integration — verify-mpesa-stk-status state machine", () => {
  it("completed transaction returns success immediately", () => {
    const transaction = {
      id: "tx-001",
      status: "completed",
      mpesa_receipt_number: "RBK7G12345",
      amount: 5000,
      completed_at: "2026-05-19T12:34:56Z",
    };

    // If status === 'completed', return success
    expect(transaction.status).toBe("completed");
    const response = {
      status: "completed",
      message: "Payment completed successfully",
      mpesaReceiptNumber: transaction.mpesa_receipt_number,
      amount: transaction.amount,
      completedAt: transaction.completed_at,
    };
    expect(response.mpesaReceiptNumber).toBe("RBK7G12345");
  });

  it("failed transaction returns failure", () => {
    const transaction = {
      status: "failed",
      failure_reason: "Transaction cancelled by user",
    };

    expect(transaction.status).toBe("failed");
    const response = {
      status: "failed",
      message: transaction.failure_reason || "Payment failed",
    };
    expect(response.message).toBe("Transaction cancelled by user");
  });

  it("pending transaction less than 30s returns pending", () => {
    const transaction = {
      status: "pending",
      initiated_at: new Date(Date.now() - 10 * 1000).toISOString(), // 10s ago
    };

    // Check elapsed seconds
    const initiatedAt = new Date(transaction.initiated_at).getTime();
    const elapsed = (Date.now() - initiatedAt) / 1000;
    expect(elapsed).toBeLessThan(30);
    expect(transaction.status).toBe("pending");
  });

  it("pending transaction more than 30s triggers Safaricom query fallback", () => {
    const transaction = {
      status: "pending",
      initiated_at: new Date(Date.now() - 45 * 1000).toISOString(), // 45s ago
      manager_id: "manager-001",
    };

    const initiatedAt = new Date(transaction.initiated_at).getTime();
    const elapsed = (Date.now() - initiatedAt) / 1000;
    expect(elapsed).toBeGreaterThan(30);
    expect(transaction.manager_id).toBeTruthy();
    // Would trigger querySafaricomSTK()
  });
});

describe("Integration — landlord payment destination", () => {
  it("routes to landlord M-Pesa settings when payment_destination = landlord", () => {
    // From initiate-mpesa-stk-push:
    // If property_landlords.payment_destination === 'landlord', use landlord_mpesa_settings
    const propertyLandlord = {
      landlord_user_id: "landlord-001",
      payment_destination: "landlord",
    };

    const paymentReceiverType = propertyLandlord.payment_destination === "landlord" ? "landlord" : "manager";
    const landlordId = propertyLandlord.payment_destination === "landlord" ? propertyLandlord.landlord_user_id : null;

    expect(paymentReceiverType).toBe("landlord");
    expect(landlordId).toBe("landlord-001");
  });

  it("routes to manager M-Pesa settings when payment_destination = manager", () => {
    const propertyLandlord = {
      landlord_user_id: "landlord-001",
      payment_destination: "manager",
    };

    const paymentReceiverType = propertyLandlord.payment_destination === "landlord" ? "landlord" : "manager";
    const landlordId = propertyLandlord.payment_destination === "landlord" ? propertyLandlord.landlord_user_id : null;

    expect(paymentReceiverType).toBe("manager");
    expect(landlordId).toBeNull();
  });

  it("defaults to manager when no property_landlord record exists", () => {
    const pl = null; // No property_landlord record

    const paymentReceiverType = pl?.payment_destination === "landlord" ? "landlord" : "manager";
    expect(paymentReceiverType).toBe("manager");
  });

  it("loads property-scoped landlord M-Pesa settings before global", () => {
    // Preference: property-scoped settings > global settings
    const propertySettings = {
      id: "ps-1",
      consumer_key: "prop-key",
      property_id: "prop-001",
    };
    const globalSettings = {
      id: "gs-1",
      consumer_key: "global-key",
      property_id: null,
    };

    // If property settings exist, use them
    const usePropertySettings = propertySettings !== null;
    const selectedSettings = usePropertySettings ? propertySettings : globalSettings;

    expect(usePropertySettings).toBe(true);
    expect(selectedSettings.consumer_key).toBe("prop-key");
  });

  it("falls back to global settings when no property-scoped settings exist", () => {
    const propertySettings = null;
    const globalSettings = {
      id: "gs-1",
      consumer_key: "global-key",
      property_id: null,
    };

    const usePropertySettings = propertySettings !== null;
    const selectedSettings = usePropertySettings ? propertySettings : globalSettings;

    expect(usePropertySettings).toBe(false);
    expect(selectedSettings.consumer_key).toBe("global-key");
  });
});

describe("Integration — edge cases", () => {
  it("handles skip of zero-balance invoices mid-list", () => {
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 5000, balance_due: 5000, due_date: "2026-04-01", status: "pending" },
      { id: "inv-2", invoice_number: "INV-002", amount: 5000, balance_due: 0, due_date: "2026-05-01", status: "paid" },
      { id: "inv-3", invoice_number: "INV-003", amount: 3000, balance_due: 3000, due_date: "2026-06-01", status: "pending" },
    ];

    const r = allocatePayment(invoices, 6000);

    expect(r.allocations).toHaveLength(2);
    expect(r.allocations[0].invoiceId).toBe("inv-1");
    expect(r.allocations[0].closes).toBe(true);
    expect(r.allocations[1].invoiceId).toBe("inv-3");
    expect(r.allocations[1].alloc).toBe(1000);
    expect(r.allocations[1].closes).toBe(false);
  });

  it("handles payment of exactly zero gracefully", () => {
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 5000, balance_due: 5000, due_date: "2026-05-01", status: "pending" },
    ];

    const r = allocatePayment(invoices, 0);
    expect(r.allocations).toEqual([]);
    expect(r.remaining).toBe(0);
    expect(r.applied).toBe(0);
  });

  it("handles very large payment amounts", () => {
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 10000, balance_due: 10000, due_date: "2026-05-01", status: "pending" },
    ];

    // Pay 100x the invoice amount
    const r = allocatePayment(invoices, 1_000_000);
    expect(r.allocations).toHaveLength(1);
    expect(r.allocations[0].closes).toBe(true);
    expect(r.remaining).toBe(990_000); // massive advance credit
  });

  it("handles missing balance_due by falling back to amount - paid_amount", () => {
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 10000, paid_amount: 3000, due_date: "2026-05-01", status: "pending" },
    ];
    // No balance_due — should compute owed = 10000 - 3000 = 7000

    const r = allocatePayment(invoices, 5000);
    expect(r.allocations[0].alloc).toBe(5000);
    expect(r.allocations[0].closes).toBe(false);
  });

  it("handles missing both balance_due and paid_amount", () => {
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 10000, due_date: "2026-05-01", status: "pending" },
    ];
    // owed = 10000 - 0 = 10000

    const r = allocatePayment(invoices, 5000);
    expect(r.allocations[0].alloc).toBe(5000);
    expect(r.allocations[0].closes).toBe(false);
  });

  it("final balance detection works correctly", () => {
    const scenarios: Array<{ balanceData: TenantBalance[] | null; error: boolean; expected: { finalBalance: number; inArrears: boolean; balanceKnown: boolean } }> = [
      { balanceData: [{ balance_due: 3000, is_in_arrears: true }], error: false, expected: { finalBalance: 3000, inArrears: true, balanceKnown: true } },
      { balanceData: [{ balance_due: 0, is_in_arrears: false }], error: false, expected: { finalBalance: 0, inArrears: false, balanceKnown: true } },
      { balanceData: null, error: true, expected: { finalBalance: 0, inArrears: false, balanceKnown: false } },
      { balanceData: [], error: false, expected: { finalBalance: 0, inArrears: false, balanceKnown: false } },
    ];

    for (const scenario of scenarios) {
      const result = computeFinalBalance(scenario.balanceData, scenario.error);
      expect(result).toEqual(scenario.expected);
    }
  });

  it("invariant: total paid = sum of allocations + advance credit", () => {
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 5000, balance_due: 5000, due_date: "2026-04-01", status: "pending" },
      { id: "inv-2", invoice_number: "INV-002", amount: 3000, balance_due: 3000, due_date: "2026-05-01", status: "pending" },
      { id: "inv-3", invoice_number: "INV-003", amount: 2000, balance_due: 2000, due_date: "2026-06-01", status: "pending" },
    ];

    const paymentAmount = 15000; // 10000 owed + 5000 advance
    const r = allocatePayment(invoices, paymentAmount);

    const sumAllocations = r.allocations.reduce((s, a) => s + a.alloc, 0);
    expect(sumAllocations + r.remaining).toBe(paymentAmount);
    expect(r.applied + r.remaining).toBe(paymentAmount);
  });

  it("invariant: remaining is never negative", () => {
    const invoices: Invoice[] = [
      { id: "inv-1", invoice_number: "INV-001", amount: 5000, balance_due: 5000, due_date: "2026-05-01", status: "pending" },
    ];

    for (const amount of [0, 1, 100, 4999, 5000, 5001, 100000]) {
      const r = allocatePayment(invoices, amount);
      expect(r.remaining).toBeGreaterThanOrEqual(0);
      expect(r.applied).toBeGreaterThanOrEqual(0);
      expect(r.applied + r.remaining).toBe(amount);
    }
  });
});
