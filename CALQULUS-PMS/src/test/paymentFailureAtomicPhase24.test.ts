import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const mpesa = readFileSync('supabase/functions/mpesa-callback/index.ts', 'utf8');
const verify = readFileSync('supabase/functions/verify-mpesa-stk-status/index.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260903000009_payment_failure_atomic.sql', 'utf8');

describe('Phase 24 payment failure lifecycle', () => {
  it('routes provider failure transitions through one atomic boundary', () => {
    expect(mpesa).toContain('mark_payment_transaction_failed_atomic');
    expect(verify).toContain('mark_payment_transaction_failed_atomic');
    expect(mpesa).not.toMatch(/from\(["']payment_transactions["']\)[\s\S]{0,180}\.update\(/);
    expect(verify).not.toMatch(/from\(["']payment_transactions["']\)[\s\S]{0,180}\.update\(/);
  });
  it('rejects failure transitions on completed transactions', () => {
    expect(migration).toContain("v_tx.status = 'completed'");
    expect(migration).toContain("Completed payment cannot be marked failed");
    expect(migration).toContain('FOR UPDATE');
  });
});
