import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260904000002_financial_billing_operations_ecosystem.sql'), 'utf8');
const tenantUi = fs.readFileSync(path.join(root, 'src/features/tenant-portal/components/TenantBalanceSummary.tsx'), 'utf8');

describe('Financial & Billing Operations Ecosystem', () => {
  it('defines one derived financial ledger', () => {
    expect(sql).toContain('CREATE OR REPLACE VIEW public.financial_ledger');
    expect(sql).toContain("'payment_allocation'");
    expect(sql).toContain("'payment_credit'");
    expect(sql).toContain("'expenditure'");
  });

  it('makes rent generation idempotent and service-only', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.generate_rent_invoices_atomic');
    expect(sql).toContain("v_key := format('rent:%s:%s:%s'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.generate_rent_invoices_atomic(date,date,uuid) FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.generate_rent_invoices_atomic(date,date,uuid) TO service_role");
  });

  it('provides role-scoped canonical financial positions', () => {
    expect(sql).toContain('public.get_tenant_financial_position');
    expect(sql).toContain('public.get_manager_financial_position');
    expect(sql).toContain('public.get_landlord_financial_position');
    expect(sql).toContain('public.can_manage_property_scope(p_manager_id)');
  });

  it('moves tenant balance UI to the canonical position', () => {
    expect(tenantUi).toContain("rpc('get_tenant_financial_position'");
    expect(tenantUi).toContain('balance?.outstanding');
    expect(tenantUi).toContain('balance?.total_credited');
  });

  it('audits without silently rewriting financial history', () => {
    expect(sql).toContain('public.audit_financial_integrity');
    expect(sql).toContain('reports inconsistencies without silently');
  });
});
