import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const ui = readFileSync('src/features/webhost/components/ManagerInvoices.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/20260903000005_platform_invoice_lifecycle_atomic.sql', 'utf8');

describe('Phase 19 platform invoice lifecycle', () => {
  it('routes all financial mutations through atomic RPCs', () => {
    expect(ui).not.toMatch(/\.from\(['"]manager_invoices['"]\)[\s\S]{0,300}\.(insert|update|delete)\(/);
    expect(ui).toContain("rpc('create_manager_invoice_atomic'");
    expect(ui).toContain("rpc('record_platform_invoice_payment_atomic'");
    expect(ui).toContain("rpc('cancel_manager_invoice_atomic'");
  });
  it('authorizes cancellation and locks the invoice', () => {
    expect(migration).toContain("role IN ('webhost','platform_admin')");
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("v_invoice.status = 'paid'");
  });
});
