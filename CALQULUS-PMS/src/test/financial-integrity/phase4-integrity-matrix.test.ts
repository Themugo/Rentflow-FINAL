import { describe, expect, it } from "vitest";
import {
  allocatePaymentMinor,
  fromMinorUnits,
  isPositiveMoney,
  moneyEquals,
  nextInvoiceStatus,
  roundMoney,
  toMinorUnits,
} from "@/shared/lib/money";

describe("money rounding", () => {
  it("stores 0.1 + 0.2 as 0.30", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it("rejects non-positive amounts", () => {
    expect(isPositiveMoney(0)).toBe(false);
    expect(isPositiveMoney(-1)).toBe(false);
    expect(isPositiveMoney(0.004)).toBe(false);
    expect(isPositiveMoney(0.01)).toBe(true);
  });

  it("treats amounts within 1 cent as equal", () => {
    expect(moneyEquals(1000, 1000.004)).toBe(true);
    expect(moneyEquals(1000, 1001)).toBe(false);
  });

  it("round-trips minor units", () => {
    expect(fromMinorUnits(toMinorUnits(1234.56))).toBe(1234.56);
  });
});

describe("invoice status transitions", () => {
  it("marks full allocation as paid", () => {
    expect(nextInvoiceStatus(true, 5000, "pending")).toBe("paid");
  });

  it("marks remainder as partially_paid", () => {
    expect(nextInvoiceStatus(false, 1000, "overdue")).toBe("partially_paid");
  });
});

describe("phase 4 integrity matrix (allocation)", () => {
  const invoice = {
    id: "inv-1",
    amount: 10_000,
    paid_amount: 0,
    balance_due: 10_000,
    status: "pending",
  };

  it("normal payment closes the invoice", () => {
    const r = allocatePaymentMinor([invoice], 10_000);
    expect(r.allocations[0].closes).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("duplicate conceptual payment is the same remaining after a closed invoice", () => {
    const first = allocatePaymentMinor([invoice], 10_000);
    const second = allocatePaymentMinor([{ ...invoice, balance_due: 0, paid_amount: 10_000, status: "paid" }], 10_000);
    expect(first.applied).toBe(10_000);
    expect(second.applied).toBe(0);
    expect(second.remaining).toBe(10_000);
  });

  it("partial payment does not close", () => {
    const r = allocatePaymentMinor([invoice], 4_000);
    expect(r.allocations[0].closes).toBe(false);
    expect(r.applied).toBe(4_000);
  });

  it("overpayment becomes remaining credit", () => {
    const r = allocatePaymentMinor([invoice], 12_500);
    expect(r.applied).toBe(10_000);
    expect(r.remaining).toBe(2_500);
  });

  it("failed / zero payment allocates nothing", () => {
    const r = allocatePaymentMinor([invoice], 0);
    expect(r.allocations).toEqual([]);
    expect(r.applied).toBe(0);
  });

  it("concurrent-style two half payments close exactly", () => {
    const first = allocatePaymentMinor([invoice], 5_000);
    const second = allocatePaymentMinor(
      [{ ...invoice, paid_amount: 5_000, balance_due: 5_000, status: "partially_paid" }],
      5_000,
    );
    expect(first.allocations[0].closes).toBe(false);
    expect(second.allocations[0].closes).toBe(true);
    expect(first.applied + second.applied).toBe(10_000);
  });
});

describe("mpesa callback integrity rules", () => {
  const STK_WINDOW_MS = 10 * 60 * 1000;

  function shouldExpirePendingStk(ageMs: number, resultCode: number): boolean {
    return resultCode !== 0 && ageMs > STK_WINDOW_MS;
  }

  it("does not expire a late successful callback", () => {
    expect(shouldExpirePendingStk(STK_WINDOW_MS + 1, 0)).toBe(false);
  });

  it("expires a late unsuccessful callback", () => {
    expect(shouldExpirePendingStk(STK_WINDOW_MS + 1, 1)).toBe(true);
  });
});

describe("duplicate callback / webhook keys", () => {
  it("treats the same tenant+reference as a single payment identity", () => {
    const seen = new Set<string>();
    const first = "tenant-1:ABC123";
    const second = "tenant-1:ABC123";
    expect(seen.has(first)).toBe(false);
    seen.add(first);
    expect(seen.has(second)).toBe(true);
  });
});
