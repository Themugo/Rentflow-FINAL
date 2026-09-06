import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const sql = fs.readFileSync(path.join(root,'supabase/migrations/20260904000003_billing_due_payment_routing.sql'),'utf8');
const required = [
  'billing_due_configurations','get_effective_billing_due_config','resolve_invoice_due_dates',
  'payment_collection_accounts','save_payment_collection_account_atomic','get_invoice_payment_instructions',
  'send_tenant_payment_prompts_atomic','overdue_date','payment_account_id','property_landlords_property_owner_uidx'
];
const missing = required.filter(x => !sql.includes(x));
if (missing.length) { console.error('BILLING_DUE_PAYMENT_ROUTING_AUDIT=FAIL', missing); process.exit(1); }
if (!fs.existsSync(path.join(root,'src/features/billing/components/BillingDueConfigPanel.tsx'))) process.exit(1);
if (!fs.existsSync(path.join(root,'src/features/billing/components/PaymentCollectionRoutingPanel.tsx'))) process.exit(1);
console.log('BILLING_DUE_PAYMENT_ROUTING_AUDIT=PASS');
