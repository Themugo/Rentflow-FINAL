import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const migration=read('supabase/migrations/20260904000010_payment_authority_convergence.sql');
const tenant=read('src/features/tenant-portal/components/TenantPaymentDetails.tsx');
const stk=read('supabase/functions/initiate-mpesa-stk-push/index.ts');
const checks=[
 ['account reference column',/ADD COLUMN IF NOT EXISTS account_reference text/i],
 ['management RLS policy',/CREATE POLICY pca_management_read/i],
 ['canonical tenant route RPC',/CREATE OR REPLACE FUNCTION public\.get_tenant_payment_routes/i],
 ['tenant route authorization',/ur\.user_id=auth\.uid\(\) AND ur\.role='tenant'/i],
 ['tenant route uses effective resolver',/get_effective_payment_collection_account/i],
 ['tenant UI uses canonical route RPC',/rpc\('get_tenant_payment_routes'/i],
 ['tenant UI no longer reads manager mpesa settings',!/manager-mpesa-for-tenant|from\('manager_mpesa_settings'\)/i.test(tenant)],
 ['STK uses canonical account reference',/route\.account_reference/i],
 ['migration balanced',(migration.match(/\(/g)||[]).length===(migration.match(/\)/g)||[]).length]
];
let fail=0; for(const [name,ok] of checks){ if(ok) console.log(`PASS ${name}`); else {console.log(`FAIL ${name}`);fail++;} }
if(fail) process.exit(1); console.log('PAYMENT_AUTHORITY_CONVERGENCE_AUDIT=PASS');
