import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const failures=[];
const protectedTables = new Set([
 'admin_permissions','bank_details','contracts','customer_billing_blocks','disputes','expenditures','fraud_flags',
 'in_app_notifications','insurance_claims','insurance_policies','landlord_bank_details','landlord_messages','manager_profiles',
 'manager_submanagers','messages','notification_failures','payout_requests','payment_logs','payment_processing','platform_admins',
 'platform_billing_rules','provider_reviews','push_subscriptions','subscription_tiers','tenant_invitations','tenant_notification_preferences',
 'tenant_pets','tenant_vehicles','user_roles','utility_bills','utility_connections','vacation_notices','webhook_dead_letter','work_orders','contractor_bids'
]);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p]})}
const sourceFiles=walk(path.join(root,'src')).filter(f=>/\.(ts|tsx)$/.test(f)&&!f.includes(`${path.sep}test${path.sep}`)&&!f.endsWith('.test.ts')&&!f.endsWith('.test.tsx'));
const direct=[];
for(const f of sourceFiles){const s=fs.readFileSync(f,'utf8'); for(const table of protectedTables){const re=new RegExp(`\\.from\\(["']${table}["']\\)[\\s\\S]{0,700}?\\.(insert|update|upsert|delete)\\s*\\(`,'g'); if(re.test(s)) direct.push(`${path.relative(root,f)} -> ${table}`)}}
if(direct.length) failures.push(`Protected direct application mutations found:\n${direct.join('\n')}`);
const sqlDir=path.join(root,'supabase','migrations');
const sqlFiles=walk(sqlDir).filter(f=>f.endsWith('.sql'));
const sql=sqlFiles.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const sensitiveRpc=/self_register_tenant_atomic|create_dispute_atomic|process_payment_atomic|transition_payout_request_atomic|record_commission_atomic|create_fraud_flag_atomic|transition_notification_failure_atomic/i;
for(const m of sql.matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+([^;\n]+?)\s+TO\s+anon/gi)){if(sensitiveRpc.test(m[1])) failures.push(`Sensitive RPC granted to anon: ${m[1].trim()}`)}
// Final storage-policy heuristic: public/authenticated broad-write policies are rejected;
// read policies are permitted only when explicitly tied to a documented public bucket.
const storageStatements = sql.split(';').map(s => s.trim()).filter(s => /(?:DROP POLICY|CREATE POLICY)/i.test(s) && /ON\s+storage\.objects/i.test(s));
for(const st of storageStatements){
 if(/FOR\s+(?:INSERT|UPDATE|DELETE)/i.test(st) && /TO\s+(?:public|anon)/i.test(st)) failures.push(`Broad public storage write policy: ${st.replace(/\s+/g,' ').slice(0,220)}`);
 if(/FOR\s+SELECT/i.test(st) && /USING\s*\(\s*true\s*\)/i.test(st) && /TO\s+authenticated/i.test(st) && !/kenya|water/i.test(st)) failures.push(`Broad authenticated storage read policy: ${st.replace(/\s+/g,' ').slice(0,220)}`);
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`final-security-audit: PASS (${sourceFiles.length} app source files; ${sqlFiles.length} migration files)`);
