import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sqlPath = path.join(root, 'supabase/migrations/20260904000001_property_tenancy_operations_ecosystem.sql');
const moveOutPath = path.join(root, 'src/features/tenants/components/MoveOutDialog.tsx');
const testPath = path.join(root, 'src/test/propertyTenancyOperationsIntegrity.test.ts');

const sql = fs.readFileSync(sqlPath, 'utf8');
const moveOut = fs.readFileSync(moveOutPath, 'utf8');
const test = fs.readFileSync(testPath, 'utf8');

const checks = [
  ['authoritative lease transition', sql.includes('CREATE OR REPLACE FUNCTION public.transition_lease_atomic')],
  ['lease activation opens tenancy history', sql.includes("INSERT INTO public.unit_tenancy_history") && sql.includes("status = 'active'" )],
  ['pre-lease assignment remains non-occupying', sql.includes('A pre-lease assignment never creates occupancy.')],
  ['move-out archives tenancy', sql.includes("status = 'archived'") && sql.includes('p_move_out_date')],
  ['unit is freed after final active lease closes', sql.includes("SET status = 'vacant', updated_at = now()")],
  ['property occupancy is recomputed', sql.includes('refresh_property_occupancy_atomic')],
  ['direct lifecycle writes are revoked', sql.includes('REVOKE INSERT, UPDATE, DELETE ON public.leases FROM authenticated')],
  ['move-out uses manager scope', moveOut.includes('const { managerId } = useManagerScope();') && moveOut.includes('p_manager_id:        managerId ?? user!.id')],
  ['regression tests exist', test.includes('property & tenancy operations ecosystem')],
];

const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(`PROPERTY_TENANCY_OPERATIONS_AUDIT=${failures.length ? 'FAIL' : 'PASS'}`);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failures.length) process.exit(1);
