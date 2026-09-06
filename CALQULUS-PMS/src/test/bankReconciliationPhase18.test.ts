import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Phase 18 bank reconciliation UI atomicity', () => {
  it('contains no direct bank transaction mutations in manager reconciliation UIs', () => {
    for (const file of [
      'src/features/payments/components/UnmatchedBankTransactions.tsx',
      'src/features/payments/components/BankReconciliationPanel.tsx',
    ]) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).not.toMatch(/from\(['"]bank_transactions['"]\)[\s\S]{0,180}\.(insert|update|upsert|delete)\(/);
    }
  });
  it('converges matching and dismissal on atomic RPCs', () => {
    const a=fs.readFileSync('src/features/payments/components/UnmatchedBankTransactions.tsx','utf8');
    const b=fs.readFileSync('src/features/payments/components/BankReconciliationPanel.tsx','utf8');
    expect(a).toContain("rpc('reconcile_bank_transaction_atomic'");
    expect(a).toContain("rpc('dismiss_bank_transaction_atomic'");
    expect(b).toContain("rpc('reconcile_bank_transaction_atomic'");
    expect(b).toContain("rpc('dismiss_bank_transaction_atomic'");
  });
});
