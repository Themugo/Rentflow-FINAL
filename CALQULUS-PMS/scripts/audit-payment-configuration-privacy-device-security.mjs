import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const sql = read('supabase/migrations/20260904000009_payment_configuration_privacy_device_security.sql');
const app = read('src/shared/components/PortalDeviceGate.tsx');
const publicShare = read('src/features/payments/pages/PublicPaymentShare.tsx');
const shareFn = read('supabase/functions/initiate-shared-payment/index.ts');

const assert = (ok,msg) => { if(!ok) throw new Error(msg); };
assert(sql.match(/\(/g)?.length === sql.match(/\)/g)?.length,'migration parentheses mismatch');
assert((sql.match(/\$\$/g)||[]).length % 2 === 0,'migration dollar tags mismatch');
for (const needle of [
  'get_effective_payment_collection_account',
  'pca_agency_default_uidx',
  'pca_unit_default_uidx',
  'verify_public_payment_share',
  'payment_share_access_grants',
  'portal_device_sessions',
  'claim_portal_device_session_atomic',
  'create_portal_device_authorization_atomic',
  'DROP FUNCTION IF EXISTS public.get_public_payment_share(text);',
  'DROP FUNCTION IF EXISTS public.create_tenant_payment_share_link_atomic(uuid[],integer,text);'
]) assert(sql.includes(needle),`missing ${needle}`);
assert(app.includes('claim_portal_device_session_atomic'),'device gate missing claim');
assert(app.includes('another_device_active'),'device gate missing single-device block');
assert(publicShare.includes('verify_public_payment_share'),'public share missing verification');
assert(publicShare.includes('p_grant'),'public share missing grant-bound reads');
assert(shareFn.includes('accessGrant'),'shared payment function missing grant');
assert(shareFn.includes('consume_shared_payment_link_atomic'), 'shared payment missing atomic consume');
console.log('PAYMENT_CONFIGURATION_PRIVACY_DEVICE_SECURITY_AUDIT=PASS');
