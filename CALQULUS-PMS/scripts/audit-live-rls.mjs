import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'docs', 'audits', 'LIVE_RLS_SECURITY.json');
const db = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const report = { generatedAt: new Date().toISOString(), status: 'EXTERNAL_REQUIRED', databaseAccessed: false };
const hardened = [
  'properties','units','property_landlords','landlord_invitations','property_billing_config','property_deductions','property_amenity_charges',
  'tenant_blacklist','tenant_notices','unit_key_records','unit_amenities','unit_utility_meters','unit_inspections','water_billing_config',
  'tenant_notification_preferences','tenant_reference_requests','tenant_lease_renewal_responses','vacation_notices','tenant_pets','tenant_vehicles',
  'messages','move_condition_photos','contracts','physical_invoices','physical_receipts','tenant_payment_details','service_providers','provider_services',
  'expenditures','provider_reviews','unit_photos','landlord_bank_details','landlord_notification_preferences','landlord_messages','payout_requests',
  'disputes','landlord_wallets','wallet_transactions','account_activations','payment_logs','commissions','webhost_payment_settings','platform_billing_rules',
  'customer_billing_blocks','payment_processing','loan_applications','insurance_policies','insurance_claims','work_orders','contractor_bids','fraud_flags',
  'notification_failures','platform_admins','admin_permissions','user_roles','subscription_tiers','property_tier_limits','property_categories',
  'workflow_templates','workflow_instances','workflow_steps','workflow_automations','utility_connections','utility_bills','manager_profiles',
  'manager_status_log','bank_details','manager_ewallet_settings','company_settings','agencies','receipt_settings','manager_submanagers',
  'submanager_permissions','submanager_property_assignments','push_subscriptions','in_app_notifications','activity_logs','tenant_invitations',
  'rent_report_schedules','leases','manager_contracts','insurance_claims'
];

if (!db) {
  report.reason = 'DATABASE_URL or SUPABASE_DB_URL is required; no live database is accessed implicitly.';
} else {
  report.databaseAccessed = true;
  const tables = [...new Set(hardened)].sort();
  const quoted = tables.map(x => `'${x.replaceAll("'", "''")}'`).join(',');
  const sql = `select c.relname as table_name, c.relrowsecurity as rls_enabled, exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as has_policy, (select count(*) from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=c.relname and g.grantee in ('anon','authenticated') and g.privilege_type in ('INSERT','UPDATE','DELETE')) as direct_write_grants from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname in (${quoted}) order by c.relname;`;
  const r = spawnSync('psql', ['--no-psqlrc','--tuples-only','--csv', db, '-c', sql], { encoding: 'utf8' });
  if (r.status !== 0) { report.status='BLOCKED'; report.error=String(r.stderr||r.error||'psql failed').trim().slice(0,500); }
  else {
    const rows = r.stdout.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(line=>line.split(',').map(v=>v.replace(/^"|"$/g,'')));
    report.tables = rows.map(([table_name,rls_enabled,has_policy,direct_write_grants])=>({table_name,rls_enabled:rls_enabled==='t',has_policy:has_policy==='t',direct_write_grants:Number(direct_write_grants)}));
    report.missingTables = tables.filter(t=>!report.tables.some(x=>x.table_name===t));
    report.rlsFailures = report.tables.filter(x=>!x.rls_enabled || !x.has_policy);
    report.directWriteGrantFailures = report.tables.filter(x=>x.direct_write_grants>0);
    report.status = report.missingTables.length || report.rlsFailures.length || report.directWriteGrantFailures.length ? 'FAIL' : 'PASS';
  }
}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`live-rls: ${report.status}`);
if(report.status==='FAIL'||report.status==='BLOCKED') process.exit(1);
