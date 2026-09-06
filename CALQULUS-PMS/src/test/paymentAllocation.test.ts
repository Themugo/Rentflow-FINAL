/**
 * paymentAllocation.test.ts — allocation algorithm from src/shared/lib/money.ts
 */
import { describe, it, expect } from "vitest";
import { allocatePaymentMinor, type PayableInvoice } from "@/shared/lib/money";

interface Invoice extends PayableInvoice {
  invoice_number: string;
  due_date: string;
}

function allocatePayment(invoices: Invoice[], amount: number) {
  const r = allocatePaymentMinor(invoices, amount);
  return {
    ...r,
    closedInvoiceNumbers: invoices
      .filter((inv) => r.allocations.some((a) => a.invoiceId === inv.id && a.closes))
      .map((inv) => inv.invoice_number),
  };
}

const inv = (over: Partial<Invoice>): Invoice => ({
  id: "inv-" + Math.random().toString(36).slice(2, 8),
  invoice_number: "INV-001",
  amount: 10_000,
  paid_amount: 0,
  balance_due: 10_000,
  due_date: "2026-05-01",
  status: "pending",
  ...over,
});

describe("allocatePayment — single invoice", () => {
  it("closes an invoice when payment exactly matches the balance", () => {
    const r = allocatePayment([inv({ id: "a", balance_due: 5_000, invoice_number: "INV-A" })], 5_000);
    expect(r.allocations).toHaveLength(1);
    expect(r.allocations[0]).toMatchObject({ alloc: 5_000, closes: true });
    expect(r.closedInvoiceNumbers).toEqual(["INV-A"]);
    expect(r.remaining).toBe(0);
  });

  it("partial payment leaves invoice open", () => {
    const r = allocatePayment([inv({ id: "a", balance_due: 5_000, invoice_number: "INV-A" })], 2_000);
    expect(r.allocations[0]).toMatchObject({ alloc: 2_000, closes: false });
    expect(r.closedInvoiceNumbers).toEqual([]);
    expect(r.remaining).toBe(0);
    expect(r.applied).toBe(2_000);
  });

  it("overpayment closes the invoice and reports remaining", () => {
    const r = allocatePayment([inv({ id: "a", balance_due: 5_000, invoice_number: "INV-A" })], 8_000);
    expect(r.allocations[0]).toMatchObject({ alloc: 5_000, closes: true });
    expect(r.remaining).toBe(3_000);
    expect(r.applied).toBe(5_000);
  });

  it("falls back to amount - paid_amount when balance_due is missing", () => {
    const r = allocatePayment(
      [{ id: "1", invoice_number: "L-1", amount: 10_000, paid_amount: 3_000,
         due_date: "2026-05-01", status: "pending" }],
      4_000,
    );
    expect(r.allocations[0].alloc).toBe(4_000);
    expect(r.allocations[0].closes).toBe(false);
  });

  it("skips fully-paid invoices (balance_due = 0)", () => {
    const r = allocatePayment([inv({ balance_due: 0, invoice_number: "DONE" })], 5_000);
    expect(r.allocations).toHaveLength(0);
    expect(r.remaining).toBe(5_000);
  });
});

describe("allocatePayment — multiple invoices", () => {
  it("pays oldest invoice first when payment covers only one", () => {
    const invoices = [
      inv({ id: "1", invoice_number: "INV-OLD",   balance_due: 5_000, due_date: "2026-04-01" }),
      inv({ id: "2", invoice_number: "INV-NEW",   balance_due: 5_000, due_date: "2026-05-01" }),
    ];
    const r = allocatePayment(invoices, 5_000);
    expect(r.closedInvoiceNumbers).toEqual(["INV-OLD"]);
    expect(r.allocations).toHaveLength(1);
  });

  it("spills over from older to newer invoice", () => {
    const invoices = [
      inv({ id: "1", invoice_number: "INV-OLD", balance_due: 5_000, due_date: "2026-04-01" }),
      inv({ id: "2", invoice_number: "INV-NEW", balance_due: 5_000, due_date: "2026-05-01" }),
    ];
    const r = allocatePayment(invoices, 7_500);
    expect(r.allocations).toEqual([
      { invoiceId: "1", alloc: 5_000, closes: true },
      { invoiceId: "2", alloc: 2_500, closes: false },
    ]);
    expect(r.closedInvoiceNumbers).toEqual(["INV-OLD"]);
    expect(r.remaining).toBe(0);
  });

  it("closes multiple invoices and reports them all", () => {
    const invoices = [
      inv({ id: "1", invoice_number: "INV-A", balance_due: 3_000 }),
      inv({ id: "2", invoice_number: "INV-B", balance_due: 4_000 }),
      inv({ id: "3", invoice_number: "INV-C", balance_due: 2_000 }),
    ];
    const r = allocatePayment(invoices, 9_000);
    expect(r.closedInvoiceNumbers).toEqual(["INV-A", "INV-B", "INV-C"]);
    expect(r.remaining).toBe(0);
  });

  it("closes some, leaves last partial, no credit", () => {
    const invoices = [
      inv({ id: "1", invoice_number: "INV-A", balance_due: 3_000 }),
      inv({ id: "2", invoice_number: "INV-B", balance_due: 4_000 }),
      inv({ id: "3", invoice_number: "INV-C", balance_due: 5_000 }),
    ];
    const r = allocatePayment(invoices, 10_000);
    expect(r.closedInvoiceNumbers).toEqual(["INV-A", "INV-B"]);
    expect(r.allocations[2]).toEqual({ invoiceId: "3", alloc: 3_000, closes: false });
    expect(r.remaining).toBe(0);
  });

  it("pays everything and leaves credit when payment exceeds total owed", () => {
    const invoices = [
      inv({ id: "1", invoice_number: "INV-A", balance_due: 3_000 }),
      inv({ id: "2", invoice_number: "INV-B", balance_due: 4_000 }),
    ];
    const r = allocatePayment(invoices, 10_000);
    expect(r.closedInvoiceNumbers).toEqual(["INV-A", "INV-B"]);
    expect(r.remaining).toBe(3_000);
    expect(r.applied).toBe(7_000);
  });

  it("invariant: applied + remaining always equals payment", () => {
    const invoices = [
      inv({ id: "1", balance_due: 1_234 }),
      inv({ id: "2", balance_due: 5_678 }),
      inv({ id: "3", balance_due: 9_012 }),
    ];
    for (const payment of [0, 1, 500, 1_234, 6_900, 15_924, 20_000]) {
      const r = allocatePayment(invoices, payment);
      expect(r.applied + r.remaining).toBe(payment);
    }
  });

  it("handles a payment of zero (no allocation, no credit)", () => {
    const invoices = [inv({ balance_due: 5_000 })];
    const r = allocatePayment(invoices, 0);
    expect(r.allocations).toEqual([]);
    expect(r.remaining).toBe(0);
    expect(r.applied).toBe(0);
  });

  it("rounds 0.1 + 0.2 style floats through minor units", () => {
    const r = allocatePayment([inv({ id: "1", balance_due: 0.3 })], 0.1 + 0.2);
    expect(r.allocations[0].alloc).toBe(0.3);
    expect(r.remaining).toBe(0);
    expect(r.allocations[0].closes).toBe(true);
  });
});
