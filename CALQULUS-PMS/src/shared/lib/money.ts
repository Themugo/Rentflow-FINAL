/**
 * Integer minor-unit money helpers. Persist rounded decimals only.
 * KES is stored as 2-decimal numeric (cents), never raw IEEE floats.
 */

export const MONEY_SCALE = 100;

export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * MONEY_SCALE);
}

export function fromMinorUnits(minor: number): number {
  return minor / MONEY_SCALE;
}

export function roundMoney(amount: number): number {
  return fromMinorUnits(toMinorUnits(amount));
}

export function isPositiveMoney(amount: number): boolean {
  return Number.isFinite(amount) && toMinorUnits(amount) > 0;
}

export function moneyEquals(a: number, b: number, toleranceMinor = 1): boolean {
  return Math.abs(toMinorUnits(a) - toMinorUnits(b)) <= toleranceMinor;
}

export interface PayableInvoice {
  id: string;
  invoice_number?: string;
  amount: number;
  // Nullable, not just optional: these are real nullable DB columns
  // (comprehensive-payment-schema migration) and invoiceOwedMinor() below
  // already defensively checks `!= null` / `?? amount` — the type just
  // needs to say what the runtime already assumes.
  original_amount?: number | null;
  paid_amount?: number | null;
  balance_due?: number | null;
  status: string;
}

export interface MoneyAllocation {
  invoiceId: string;
  alloc: number;
  closes: boolean;
}

export function invoiceOwedMinor(inv: PayableInvoice): number {
  if (inv.balance_due != null && Number.isFinite(Number(inv.balance_due))) {
    return Math.max(0, toMinorUnits(Number(inv.balance_due)));
  }
  const original = Number(inv.original_amount ?? inv.amount);
  const paid = Number(inv.paid_amount ?? 0);
  return Math.max(0, toMinorUnits(original) - toMinorUnits(paid));
}

export function nextInvoiceStatus(closes: boolean, newPaidMinor: number, previousStatus: string): string {
  if (closes) return "paid";
  if (newPaidMinor > 0) return "partially_paid";
  return previousStatus === "overdue" ? "overdue" : "pending";
}

export function allocatePaymentMinor(
  invoices: PayableInvoice[],
  amount: number,
): { allocations: MoneyAllocation[]; remaining: number; applied: number } {
  let remainingMinor = Math.max(0, toMinorUnits(amount));
  const allocations: MoneyAllocation[] = [];

  for (const inv of invoices) {
    if (remainingMinor <= 0) break;
    const owedMinor = invoiceOwedMinor(inv);
    if (owedMinor <= 0) continue;
    const allocMinor = Math.min(remainingMinor, owedMinor);
    remainingMinor -= allocMinor;
    allocations.push({
      invoiceId: inv.id,
      alloc: fromMinorUnits(allocMinor),
      closes: allocMinor >= owedMinor,
    });
  }

  const remaining = fromMinorUnits(remainingMinor);
  return {
    allocations,
    remaining,
    applied: roundMoney(amount) - remaining,
  };
}
