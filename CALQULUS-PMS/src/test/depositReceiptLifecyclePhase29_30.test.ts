import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Phase 29–30 deposit and receipt lifecycle', () => {
  it('defines atomic deposit lifecycle RPCs and mutation revocation', () => {
    const sql = read('supabase/migrations/20260903000011_deposit_lifecycle_atomic.sql');
    expect(sql).toContain('record_deposit_deduction_atomic');
    expect(sql).toContain('reverse_deposit_deduction_atomic');
    expect(sql).toContain('create_deposit_refund_atomic');
    expect(sql).toContain('transition_deposit_refund_atomic');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.deposit_refunds FROM authenticated');
    expect(sql).toContain("'Completed refund cannot change status'");
  });

  it('defines receipt submission/rejection and revokes direct writes', () => {
    const sql = read('supabase/migrations/20260903000012_payment_receipt_lifecycle_atomic.sql');
    expect(sql).toContain('submit_payment_receipt_atomic');
    expect(sql).toContain('reject_payment_receipt_atomic');
    expect(sql).toContain("role='tenant'");
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.payment_receipts FROM authenticated');
  });

  it('keeps targeted production UI on RPC-only mutation paths', () => {
    const files = [
      'src/features/tenants/components/DepositDeductionDialog.tsx',
      'src/features/tenants/components/DepositAccountabilityStatement.tsx',
      'src/features/tenant-portal/components/ReceiptUpload.tsx',
      'src/features/payments/components/ReceiptVerification.tsx',
    ];
    for (const file of files) {
      const source = read(file);
      expect(source).not.toMatch(/from\(['"](?:deposit_deductions|deposit_refunds|unit_deposit_ledger|payment_receipts)['"]\)[\s\S]{0,120}\.(?:insert|update|delete)\(/);
    }
  });
});
