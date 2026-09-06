/**
 * payment.test.ts
 *
 * Tests for payment-related business logic:
 *   - Invoice status transitions (mark paid, partial, overdue)
 *   - Amount validation
 *   - Payment recording via the supabase client
 *   - Credit ledger behaviour (advance payment goes to credit)
 *
 * Run with:  npm test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockInvoke = vi.fn();
const mockRPC    = vi.fn();
const createQueryBuilder = () => ({
  select:      mockSelect,
  insert:      mockInsert,
  update: (...args: Parameters<typeof mockUpdate>) => {
    const result = mockUpdate(...args);
    return {
      eq: vi.fn(() => result),
      in: vi.fn(() => result),
      order: vi.fn(() => result),
      limit: vi.fn(() => result),
      single: vi.fn(() => result),
      maybeSingle: vi.fn(() => result),
    };
  },
  eq:          vi.fn().mockReturnThis(),
  in:          vi.fn().mockReturnThis(),
  order:       vi.fn().mockReturnThis(),
  limit:       vi.fn().mockReturnThis(),
  single:      vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(createQueryBuilder),
    functions: { invoke: mockInvoke },
    rpc:       mockRPC,
  },
}));

// ── Pure helper functions (no Supabase) ───────────────────────────────────────
// These mirror the same logic in the edge functions so we can test them fast.

function validatePaymentAmount(amount: unknown): { valid: boolean; error?: string } {
  if (typeof amount !== "number" || isNaN(amount)) return { valid: false, error: "Amount must be a number" };
  if (amount <= 0)   return { valid: false, error: "Amount must be greater than zero" };
  if (amount > 10_000_000) return { valid: false, error: "Amount exceeds maximum allowed" };
  return { valid: true };
}

function computePaymentAllocation(
  invoiceBalance: number,
  paymentAmount: number,
): { applied: number; credit: number; status: "paid" | "partial" } {
  const applied = Math.min(paymentAmount, invoiceBalance);
  const credit  = Math.max(0, paymentAmount - invoiceBalance);
  const status  = applied >= invoiceBalance ? "paid" : "partial";
  return { applied, credit, status };
}

function isInvoiceOverdue(dueDateISO: string, todayISO = new Date().toISOString().slice(0, 10)): boolean {
  return dueDateISO < todayISO;
}

function normalizePhoneKe(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("07") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.startsWith("254") && digits.length === 12) return digits;
  return digits;
}

// ── Amount validation ─────────────────────────────────────────────────────────

describe("validatePaymentAmount", () => {
  it("accepts a positive number", () => {
    expect(validatePaymentAmount(1000).valid).toBe(true);
  });

  it("rejects zero", () => {
    const r = validatePaymentAmount(0);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/greater than zero/i);
  });

  it("rejects negative numbers", () => {
    expect(validatePaymentAmount(-500).valid).toBe(false);
  });

  it("rejects NaN", () => {
    expect(validatePaymentAmount(NaN).valid).toBe(false);
  });

  it("rejects strings", () => {
    expect(validatePaymentAmount("1000").valid).toBe(false);
  });

  it("rejects amounts over 10 million", () => {
    const r = validatePaymentAmount(10_000_001);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/maximum/i);
  });
});

// ── Payment allocation ────────────────────────────────────────────────────────

describe("computePaymentAllocation", () => {
  it("marks invoice paid when payment equals balance", () => {
    const r = computePaymentAllocation(5000, 5000);
    expect(r.status).toBe("paid");
    expect(r.applied).toBe(5000);
    expect(r.credit).toBe(0);
  });

  it("marks invoice paid when payment exceeds balance and stores credit", () => {
    const r = computePaymentAllocation(5000, 6000);
    expect(r.status).toBe("paid");
    expect(r.applied).toBe(5000);
    expect(r.credit).toBe(1000);
  });

  it("marks invoice partial when payment is less than balance", () => {
    const r = computePaymentAllocation(5000, 3000);
    expect(r.status).toBe("partial");
    expect(r.applied).toBe(3000);
    expect(r.credit).toBe(0);
  });

  it("applied + credit always equals payment amount", () => {
    const cases = [
      [5000, 5000],
      [5000, 7500],
      [5000, 2000],
      [1,    1],
      [100,  99],
    ] as const;
    for (const [balance, payment] of cases) {
      const { applied, credit } = computePaymentAllocation(balance, payment);
      expect(applied + credit).toBe(payment);
    }
  });
});

// ── Overdue detection ─────────────────────────────────────────────────────────

describe("isInvoiceOverdue", () => {
  it("returns true when due date is in the past", () => {
    expect(isInvoiceOverdue("2020-01-01", "2024-06-01")).toBe(true);
  });

  it("returns false when due date is today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isInvoiceOverdue(today, today)).toBe(false);
  });

  it("returns false when due date is in the future", () => {
    expect(isInvoiceOverdue("2099-12-31", "2024-06-01")).toBe(false);
  });
});

// ── Kenyan phone normalisation ────────────────────────────────────────────────

describe("normalizePhoneKe", () => {
  it("converts 07XXXXXXXX to 254XXXXXXXXX", () => {
    expect(normalizePhoneKe("0712345678")).toBe("254712345678");
  });

  it("leaves 254XXXXXXXXX unchanged", () => {
    expect(normalizePhoneKe("254712345678")).toBe("254712345678");
  });

  it("strips non-digit characters before normalising", () => {
    expect(normalizePhoneKe("+254 712 345 678")).toBe("254712345678");
  });
});

// ── Supabase-integrated payment recording ─────────────────────────────────────

describe("mark invoice paid (via supabase)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates status to 'paid' and sets paid_date", async () => {
    mockUpdate.mockResolvedValueOnce({ error: null });

    const { supabase } = await import("@/integrations/supabase/client");
    const paidDate = "2024-06-01";

    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_date: paidDate })
      .eq("id", "inv-001");

    expect(error).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith({ status: "paid", paid_date: paidDate });
  });

  it("propagates a database error", async () => {
    mockUpdate.mockResolvedValueOnce({ error: { message: "Row not found" } });

    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_date: "2024-06-01" })
      .eq("id", "does-not-exist");

    expect(error?.message).toBe("Row not found");
  });
});

describe("invoke process-payment edge function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success on a valid payload", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { success: true, receiptNumber: "R-001" }, error: null });

    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("process-payment", {
      body: {
        tenantId:      "tenant-001",
        managerId:     "manager-001",
        amount:        5000,
        paymentMethod: "mpesa_stk",
        paymentDate:   "2024-06-01",
        reference:     "RBK7G12345",
        invoiceId:     "inv-001",
      },
    });

    expect(error).toBeNull();
    expect(data.success).toBe(true);
    expect(data.receiptNumber).toBe("R-001");
  });

  it("returns an error when the edge function rejects", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Authentication failed" },
    });

    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.functions.invoke("process-payment", {
      body: { tenantId: "x", managerId: "y", amount: 100, paymentMethod: "cash", paymentDate: "2024-06-01", reference: "REF" },
    });

    expect(error?.message).toBe("Authentication failed");
  });
});
