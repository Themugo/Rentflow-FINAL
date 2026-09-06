import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const sql62 = readFileSync(resolve(root, 'supabase/migrations/20260903000033_phase62_platform_billing_config_atomic.sql'), 'utf8');
const sql63 = readFileSync(resolve(root, 'supabase/migrations/20260903000034_phase63_customer_billing_block_atomic.sql'), 'utf8');
const rules = readFileSync(resolve(root, 'src/features/webhost/components/PlatformBillingRules.tsx'), 'utf8');
const settings = readFileSync(resolve(root, 'src/features/webhost/components/WebhostPaymentSettings.tsx'), 'utf8');
const blocks = readFileSync(resolve(root, 'src/features/webhost/components/CustomerBillingBlocks.tsx'), 'utf8');

describe('Phase 62–63 platform financial configuration hardening', () => {
  it('defines privileged RPCs and revokes direct browser writes', () => {
    for (const name of ['save_webhost_payment_settings_atomic','save_platform_billing_rule_atomic','transition_platform_billing_rule_atomic','delete_platform_billing_rule_atomic']) expect(sql62).toContain(name);
    expect(sql62).toContain('REVOKE INSERT, UPDATE, DELETE ON public.webhost_payment_settings FROM authenticated, anon');
    expect(sql62).toContain('REVOKE INSERT, UPDATE, DELETE ON public.platform_billing_rules FROM authenticated, anon');
    for (const name of ['save_customer_billing_block_atomic','delete_customer_billing_block_atomic']) expect(sql63).toContain(name);
    expect(sql63).toContain('REVOKE INSERT, UPDATE, DELETE ON public.customer_billing_blocks FROM authenticated, anon');
  });

  it('moves the three webhost financial editors to RPCs', () => {
    expect(settings).toContain("supabase.rpc('save_webhost_payment_settings_atomic'");
    expect(rules).toContain("supabase.rpc('save_platform_billing_rule_atomic'");
    expect(rules).toContain("supabase.rpc('transition_platform_billing_rule_atomic'");
    expect(rules).toContain("supabase.rpc('delete_platform_billing_rule_atomic'");
    expect(blocks).toContain("supabase.rpc('save_customer_billing_block_atomic'");
    expect(blocks).toContain("supabase.rpc('delete_customer_billing_block_atomic'");
    expect(settings).not.toContain("from('webhost_payment_settings').update");
    expect(settings).not.toContain("from('webhost_payment_settings').insert");
    expect(rules).not.toContain("from('platform_billing_rules') as any).insert");
    expect(blocks).not.toContain("from('customer_billing_blocks').insert");
  });
});
