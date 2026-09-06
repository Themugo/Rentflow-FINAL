import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Phase 17 platform invoice atomicity', () => {
  it('does not directly write manager invoices from webhost billing UI', () => {
    const files = [
      'src/features/webhost/components/ManagerBillingDrilldown.tsx',
      'src/features/webhost/components/ManagerManagement.tsx',
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).not.toMatch(/from\(['"]manager_invoices['"]\)[\s\S]{0,120}\.(insert|update|upsert|delete)\(/);
    }
  });
  it('uses the dedicated atomic platform invoice RPCs', () => {
    const a = fs.readFileSync('src/features/webhost/components/ManagerBillingDrilldown.tsx','utf8');
    const b = fs.readFileSync('src/features/webhost/components/ManagerManagement.tsx','utf8');
    expect(a).toContain("rpc('create_manager_invoice_atomic'");
    expect(a).toContain("rpc('record_platform_invoice_payment_atomic'");
    expect(b).toContain("rpc('create_manager_invoice_atomic'");
  });
});
