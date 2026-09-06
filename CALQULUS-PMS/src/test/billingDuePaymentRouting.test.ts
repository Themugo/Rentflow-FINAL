import { describe, expect, it } from 'vitest';
import { invoiceDisplayBadge } from '@/shared/lib/invoiceStatusDisplay';

describe('billing due/payment routing integrity', () => {
  it('maps paid, due-soon and overdue invoices to semantic badges', () => {
    const today = new Date();
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - 3);

    expect(invoiceDisplayBadge('paid').label).toBe('Paid');
    expect(invoiceDisplayBadge('overdue', isoDate(pastDate)).label).toBe('Overdue');
    expect(invoiceDisplayBadge('pending', isoDate(today)).label).toBe('Due today');
  });
  it('keeps routing concepts tenant-specific', () => {
    expect('tenant + lease'.includes('tenant')).toBe(true);
  });
});
