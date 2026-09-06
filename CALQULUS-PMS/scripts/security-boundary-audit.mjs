import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fnRoot = path.join(root, 'supabase', 'functions');
const migRoot = path.join(root, 'supabase', 'migrations');
const protectedTables = new Set([
  'user_roles','profiles','properties','units','tenants','leases','invoices',
  'payment_transactions','payout_requests','commissions','disputes',
  'platform_admins','admin_permissions','subscription_tiers','property_tier_limits',
  'manager_profiles','manager_submanagers','submanager_permissions',
  'landlord_bank_details','wallet_transactions','fraud_flags','messages'
]);
let failures = [];
function walk(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
}
for (const file of walk(fnRoot).filter(f=>f.endsWith('.ts'))) {
  const s=fs.readFileSync(file,'utf8');
  if (s.includes('.insert(')||s.includes('.update(')||s.includes('.upsert(')||s.includes('.delete(')) {
    if (file.includes(`${path.sep}_shared${path.sep}`) || file.includes(`${path.sep}tests${path.sep}`)) continue;
    const hasAuth=/authenticateUser\(|auth\.getUser\(|Authorization|verifyServiceRole\(|withMiddleware\([\s\S]{0,500}requireAuth\s*:\s*true/.test(s);
    const hasService=/SERVICE_ROLE_KEY|supabaseAdmin|verifyServiceRole/.test(s);
    if (!hasAuth && !hasService) failures.push(`edge function lacks auth/service gate: ${path.relative(root,file)}`);
  }
}
for (const file of walk(migRoot).filter(f=>f.endsWith('.sql'))) {
  const s=fs.readFileSync(file,'utf8');
  for (const m of s.matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+([^;\n]+?)\s+TO\s+anon/gi)) {
    const sig=m[1].trim();
    if (/process_payment|process_invoice_payment|reconcile_bank_transaction|use_activation_token|log_payment_processed/i.test(sig)) failures.push(`sensitive function granted to anon in ${path.basename(file)}: ${sig}`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('security-boundary-audit: PASS');
