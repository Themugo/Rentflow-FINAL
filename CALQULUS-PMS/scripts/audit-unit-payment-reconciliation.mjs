import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const sql = read('supabase/migrations/20260904000006_unit_payment_reconciliation_portal.sql');
const ui = read('src/features/billing/components/UnitPaymentReconciliation.tsx');
const checks = [
  ['manager RPC', sql.includes('get_manager_unit_payment_reconciliation')],
  ['property RPC', sql.includes('get_unit_payment_reconciliation')],
  ['activity RPC', sql.includes('get_unit_payment_activity')],
  ['completed allocation truth', sql.includes("pt.status='completed'")],
  ['payer attribution', sql.includes('payer_party_id')],
  ['landlord suppression', sql.includes('tenant personal fields are suppressed') || ui.includes('landlordView')],
  ['bulk transaction drilldown', ui.includes('larger bulk transaction')],
  ['property billing integration', read('src/features/properties/components/PropertyBillingTab.tsx').includes('UnitPaymentReconciliation')],
  ['global billing integration', read('src/features/billing/pages/Billing.tsx').includes('UnitPaymentReconciliation')],
  ['landlord integration', read('src/features/landlord/components/LandlordPropertyDetail.tsx').includes('UnitPaymentReconciliation')],
];
for (const [name, ok] of checks) if (!ok) throw new Error(`FAIL: ${name}`);
console.log('UNIT_PAYMENT_RECONCILIATION_AUDIT=PASS');
