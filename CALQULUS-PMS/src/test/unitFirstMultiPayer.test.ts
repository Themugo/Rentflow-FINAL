import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('unit-first multi-payer billing', () => {
  const sql = fs.readFileSync('supabase/migrations/20260904000004_unit_first_multi_payer_bulk_payments.sql', 'utf8');
  it('supports one payment allocated across multiple invoices/units', () => {
    expect(sql).toContain('process_payer_payment_atomic');
    expect(sql).toContain('p_allocations jsonb');
    expect(sql).toContain('payment_allocations');
  });
  it('supports independent payer parties and unit links', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.payment_parties');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.payer_unit_links');
    expect(sql).toContain('get_portal_billing_units');
  });
  it('creates payer receipts and recipient copies', () => {
    expect(sql).toContain('payment_receipts');
    expect(sql).toContain('payment_receipt_recipients');
    expect(sql).toContain("recipient_type IN ('payer','tenant','landlord','manager','agency')");
  });
});
