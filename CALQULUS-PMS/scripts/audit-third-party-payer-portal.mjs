import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20260904000007_third_party_payer_portal.sql'),'utf8');
const required=[
  "ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'payer'",
  'get_my_payer_portal','get_my_payer_obligations','get_my_payer_receipts',
  'assign_payer_account_atomic','ensure_my_payer_party_atomic','backfill_payment_allocation_payer_atomic'
];
for(const x of required) if(!sql.includes(x)) throw new Error(`Missing ${x}`);
const edge=fs.readFileSync(path.join(root,'supabase/functions/initiate-mpesa-stk-push/index.ts'),'utf8');
for(const x of ['payerPartyId','payer_party_id','payer_unit_links']) if(!edge.includes(x)) throw new Error(`STK missing ${x}`);
const routes=fs.readFileSync(path.join(root,'src/app/routes.ts'),'utf8');
for(const x of ['/payer/login','role: "payer"','/payer']) if(!routes.includes(x)) throw new Error(`Route missing ${x}`);
console.log('THIRD_PARTY_PAYER_PORTAL_AUDIT=PASS');
