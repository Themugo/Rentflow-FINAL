/** Columns the tenant portal actually renders — avoid select('*') payloads. */
export const TENANT_INVOICE_COLUMNS =
  'id, invoice_number, amount, balance_due, due_date, paid_date, status, description';

export function amountOnInvoice(invoice: {
  amount: number;
  balance_due?: number | null;
}): number {
  return Number(invoice.balance_due ?? invoice.amount);
}
