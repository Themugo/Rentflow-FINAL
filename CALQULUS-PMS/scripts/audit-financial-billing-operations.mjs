import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = path.join(root, 'supabase/migrations/20260904000002_financial_billing_operations_ecosystem.sql');
const tenantUi = path.join(root, 'src/features/tenant-portal/components/TenantBalanceSummary.tsx');
const types = path.join(root, 'src/integrations/supabase/types.ts');

for (const file of [migration, tenantUi, types]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
}
const sql = fs.readFileSync(migration, 'utf8');
const ui = fs.readFileSync(tenantUi, 'utf8');
const dbTypes = fs.readFileSync(types, 'utf8');

const requiredSql = [
  'CREATE OR REPLACE VIEW public.financial_ledger',
  'CREATE OR REPLACE FUNCTION public.generate_rent_invoices_atomic',
  'CREATE OR REPLACE FUNCTION public.mark_rent_invoices_overdue_atomic',
  'CREATE OR REPLACE FUNCTION public.get_tenant_financial_position',
  'CREATE OR REPLACE FUNCTION public.get_manager_financial_position',
  'CREATE OR REPLACE FUNCTION public.get_landlord_financial_position',
  'CREATE OR REPLACE FUNCTION public.audit_financial_integrity',
  "GRANT EXECUTE ON FUNCTION public.generate_rent_invoices_atomic(date,date,uuid) TO service_role",
  "GRANT EXECUTE ON FUNCTION public.mark_rent_invoices_overdue_atomic(date) TO service_role",
];
for (const marker of requiredSql) if (!sql.includes(marker)) throw new Error(`Missing SQL control: ${marker}`);
if (!ui.includes("rpc('get_tenant_financial_position'")) throw new Error('Tenant balance UI is not using canonical financial position RPC');
for (const marker of ['get_tenant_financial_position:', 'get_manager_financial_position:', 'get_landlord_financial_position:', 'audit_financial_integrity:']) {
  if (!dbTypes.includes(marker)) throw new Error(`Missing generated type declaration: ${marker}`);
}
if ((sql.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length < 6) throw new Error('Expected canonical financial RPC set');
console.log('FINANCIAL_BILLING_OPERATIONS_AUDIT=PASS');
