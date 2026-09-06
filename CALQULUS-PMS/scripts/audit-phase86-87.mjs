import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const protectedTables = [
  'company_settings','bank_details','manager_ewallet_settings','receipt_settings','agencies',
  'manager_submanagers','submanager_permissions','submanager_property_assignments','user_roles',
  'workflow_templates','workflow_instances','workflow_steps','workflow_automations',
  'utility_connections','utility_bills','subscription_tiers','manager_profiles','manager_notification_settings'
];
const sourceDirs = ['src/features','src/shared'];
const files = [];
function walk(dir){
  if(!fs.existsSync(dir)) return;
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) walk(p);
    else if(/\.(ts|tsx)$/.test(e.name) && !p.includes(`${path.sep}test${path.sep}`)) files.push(p);
  }
}
sourceDirs.forEach(walk);
const violations=[];
for(const f of files){
  const s=fs.readFileSync(f,'utf8');
  for(const table of protectedTables){
    const re=new RegExp(`from\\((['"])${table}\\1\\)[\\s\\S]{0,500}\\.(insert|update|upsert|delete)\\(`,'g');
    if(re.test(s)) violations.push(`${path.relative(root,f)} -> ${table}`);
  }
}
const mig=fs.readFileSync(path.join(root,'supabase/migrations/20260903000051_phase86_administration_orchestration_convergence.sql'),'utf8');
const storage=fs.readFileSync(path.join(root,'supabase/migrations/20260903000056_phase87_storage_path_hardening.sql'),'utf8');
const required86=['save_manager_bank_details_atomic','save_manager_ewallet_settings_atomic','save_manager_company_settings_atomic','save_manager_receipt_settings_atomic','provision_submanager_atomic','save_workflow_template_atomic','save_utility_connection_atomic','update_profile_settings_atomic','save_webhost_tier_price_atomic','save_manager_notification_settings_atomic'];
const missing86=required86.filter(x=>!mig.includes(`FUNCTION public.${x}`));
const required87=['property_images_scoped_write','property_images_scoped_delete','contracts_scoped_insert','signed_contracts_scoped_insert','profile_photos_scoped_insert','company_logos_scoped_insert'];
const missing87=required87.filter(x=>!storage.includes(`POLICY "${x}"`));
const dollar86=(mig.match(/\$\$/g)||[]).length;
const dollar87=(storage.match(/\$\$/g)||[]).length;
if(violations.length||missing86.length||missing87.length||dollar86%2||dollar87%2){
  console.error(JSON.stringify({violations,missing86,missing87,dollar86,dollar87},null,2)); process.exit(1);
}
console.log(JSON.stringify({status:'PASS',protected_direct_mutations:0,phase86_required_functions:required86.length,phase87_required_policies:required87.length,dollar86,dollar87},null,2));
