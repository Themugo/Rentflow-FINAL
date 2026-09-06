import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const rpc = readFileSync('supabase/migrations/20260903000005_platform_invoice_lifecycle_atomic.sql', 'utf8');
const drilldown = readFileSync('src/features/webhost/components/ManagerBillingDrilldown.tsx', 'utf8');

describe('Phase 21 platform settlement integrity', () => {
  it('locks and short-circuits already-paid invoices before creating another transaction', () => {
    expect(rpc).toContain('FROM public.manager_invoices WHERE id=p_manager_invoice_id FOR UPDATE');
    expect(rpc).toContain("IF v_invoice.status = 'paid' THEN");
    expect(rpc).toContain("'already_paid', true");
  });
  it('uses a deterministic manager invoice payment reference', () => {
    expect(drilldown).toContain('p_reference: `WEBHOST-${id}`');
    expect(drilldown).not.toContain('Date.now()');
  });
});
