import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const ui = readFileSync('src/features/payments/components/BankIntegrationSettings.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/20260903000006_bank_integration_settings_atomic.sql', 'utf8');

describe('Phase 20 bank integration settings', () => {
  it('routes configuration mutations through atomic RPCs', () => {
    expect(ui).not.toMatch(/\.from\(['"]bank_integration_settings['"]\)[\s\S]{0,300}\.(insert|update|delete)\(/);
    expect(ui).toContain("rpc('create_bank_integration_atomic'");
    expect(ui).toContain("rpc('set_bank_integration_active_atomic'");
    expect(ui).toContain("rpc('delete_bank_integration_atomic'");
  });
  it('binds integrations to the supplied manager and validates property ownership', () => {
    expect(migration).toContain('p_manager_id <> auth.uid()');
    expect(migration).toContain('manager_id = p_manager_id');
    expect(migration).toContain("role = 'manager'");
    expect(migration).toContain("length(btrim(p_webhook_secret)) < 16");
  });
});
