import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const ui = readFileSync('src/features/payments/components/BankIntegrationSettings.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/20260903000007_bank_webhook_secret_security.sql', 'utf8');

describe('Phase 22 bank webhook secret security', () => {
  it('does not request webhook_secret in the normal integration list', () => {
    expect(ui).toContain(".select('id, bank_name, property_id, account_number, account_name, is_active, auto_reconcile, match_by, paybill_number')");
    expect(ui).not.toContain('.select(\'*\')');
  });
  it('uses explicit authorized RPCs for reveal and rotation', () => {
    expect(ui).toContain("rpc('get_bank_webhook_secret_atomic'");
    expect(ui).toContain("rpc('rotate_bank_webhook_secret_atomic'");
    expect(migration).toContain('REVOKE SELECT (webhook_secret)');
    expect(migration).toContain('auth.uid() <> v_manager');
  });
});
