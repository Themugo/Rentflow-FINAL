import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('Phase 35-36 mutation integrity', () => {
  it('defines contract and lease atomic lifecycle functions and revokes direct writes', () => {
    const sql = read('supabase/migrations/20260903000018_contract_lease_lifecycle_atomic.sql');
    for (const fn of ['create_contract_atomic', 'transition_contract_atomic', 'transition_lease_atomic', 'attach_lease_document_atomic', 'assign_lease_tenant_atomic']) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }
    expect(sql).toContain('REVOKE INSERT,UPDATE,DELETE ON public.contracts FROM authenticated');
    expect(sql).toContain('REVOKE UPDATE ON public.leases FROM authenticated');
    expect(sql).toContain('FOR UPDATE');
  });

  it('defines water and unit utility atomic functions and revokes direct writes', () => {
    const sql = read('supabase/migrations/20260903000019_water_billing_lifecycle_atomic.sql');
    for (const fn of ['save_water_billing_config_atomic', 'record_water_meter_reading_atomic', 'submit_tenant_water_reading_atomic', 'dispute_water_reading_atomic', 'link_water_reading_invoice_atomic', 'save_unit_utility_meter_atomic', 'update_unit_utility_meter_reading_atomic', 'set_unit_utility_meter_active_atomic', 'delete_unit_utility_meter_atomic']) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }
    expect(sql).toContain('REVOKE INSERT,UPDATE,DELETE ON public.water_billing_config FROM authenticated');
    expect(sql).toContain('REVOKE INSERT,UPDATE,DELETE ON public.water_meter_readings FROM authenticated');
    expect(sql).toContain('REVOKE INSERT,UPDATE,DELETE ON public.unit_utility_meters FROM authenticated');
    expect(sql).toContain('pg_advisory_xact_lock');
  });

  it('routes active feature mutations through RPCs', () => {
    const files = [
      'src/features/contracts/services/contracts.service.ts',
      'src/features/contracts/hooks/useContractsData.ts',
      'src/features/contracts/components/QuickCreateContract.tsx',
      'src/features/tenant-portal/hooks/useTenantContracts.ts',
      'src/features/leases/pages/Leases.tsx',
      'src/features/water/components/WaterBillingManager.tsx',
      'src/features/tenant-portal/components/TenantWaterPortal.tsx',
      'src/features/properties/components/PropertyBillingTab.tsx',
      'src/features/units/components/UnitUtilityMeters.tsx',
    ];
    const targetTables = ['contracts', 'leases', 'water_billing_config', 'water_meter_readings', 'unit_utility_meters', 'expenditures'];
    for (const file of files) {
      const source = read(file);
      for (const table of targetTables) {
        const lines = source.split('\n');
        lines.forEach((line, index) => {
          if (!line.includes(`from("${table}")`) && !line.includes(`from('${table}')`)) return;
          const context = lines.slice(index, index + 10).join('\n');
          expect(context, `${file}:${index + 1} still performs a direct mutation on ${table}`).not.toMatch(/\.(insert|update|upsert|delete)\(/);
        });
      }
    }
  });
});
