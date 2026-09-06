import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('supabase/migrations/20260904000008_tenant_share_payment_links.sql');
const edge=read('supabase/functions/initiate-shared-payment/index.ts');
const page=read('src/features/payments/pages/PublicPaymentShare.tsx');
const button=read('src/features/tenant-portal/components/TenantPaymentShareButton.tsx');
const routes=read('src/app/routes.ts');
const checks=[
 ['share links table',/CREATE TABLE IF NOT EXISTS public\.payment_share_links/],
 ['opaque SHA256 token',/digest\(v_token,'sha256'\)/],
 ['tenant ownership',/ur\.user_id=auth\.uid\(\) AND ur\.role='tenant'/],
 ['expiry and revocation',/revoked_at IS NULL[\s\S]*expires_at>now\(\)/],
 ['public limited invoice read',/get_public_payment_share/],
 ['public payment status',/get_public_payment_share_status/],
 ['anonymous STK function',/requireAuth: false/],
 ['payer attribution',/payer_party_id: party\.id/],
 ['public share route',/\/pay\/:token/],
 ['tenant share button',/TenantPaymentShareButton/],
];
let fail=false;for(const [n,re] of checks){if(!re.test(sql+edge+page+button+routes)){console.error('FAIL',n);fail=true}else console.log('PASS',n)}
const par=(x)=>{let d=0;for(const c of x){if(c==='(')d++;else if(c===')')d--;if(d<0)return false}return d===0};
if(!par(sql)){console.error('FAIL SQL parentheses');fail=true}else console.log('PASS SQL parentheses');
if(fail)process.exit(1);console.log('TENANT_SHARE_PAYMENT_LINK_AUDIT=PASS');
