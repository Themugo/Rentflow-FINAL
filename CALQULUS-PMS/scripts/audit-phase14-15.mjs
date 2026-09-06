import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'));

const versions = new Map();
for (const file of migrations) {
  const version = file.split('_', 1)[0];
  if (!/^\d{14}$/.test(version)) continue;
  const list = versions.get(version) ?? [];
  list.push(file);
  versions.set(version, list);
}
const duplicateVersions = [...versions.entries()].filter(([, files]) => files.length > 1);
const introducedDuplicateVersions = duplicateVersions.filter(([version]) => version.startsWith('20260903'));
if (introducedDuplicateVersions.length) {
  throw new Error(`Duplicate migration versions introduced by current hardening: ${JSON.stringify(introducedDuplicateVersions)}`);
}
if (duplicateVersions.length) {
  console.warn(`Pre-existing duplicate migration versions retained for history: ${JSON.stringify(duplicateVersions)}`);
}

const lifecycle = read('supabase/migrations/20260903000001_platform_billing_atomicity.sql');
const checkout = read('supabase/functions/create-manager-invoice-checkout/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const types = read('src/integrations/supabase/types.ts');
const drill = read('src/features/webhost/components/ManagerBillingDrilldown.tsx');

for (const needle of [
  'CREATE TABLE IF NOT EXISTS public.platform_payment_transactions',
  'CREATE OR REPLACE FUNCTION public.create_platform_payment_atomic',
  'CREATE OR REPLACE FUNCTION public.update_platform_payment_atomic',
  'CREATE OR REPLACE FUNCTION public.bind_platform_payment_provider_atomic',
  'REVOKE EXECUTE ON FUNCTION public.update_platform_payment_atomic FROM PUBLIC, anon, authenticated',
  "CHECK (status IN ('pending','success','failed','refunded'))",
]) {
  if (!lifecycle.includes(needle)) throw new Error(`Missing platform billing invariant: ${needle}`);
}

if (checkout.includes('.from("payments")') || checkout.includes(".from('payments')"))
  throw new Error('Platform checkout still writes through tenant payments view');
if (!checkout.includes('create_platform_payment_atomic') || !checkout.includes('bind_platform_payment_provider_atomic'))
  throw new Error('Platform checkout is not using atomic platform payment RPCs');
if (!checkout.includes('payment_intent_data')) throw new Error('Stripe PaymentIntent correlation metadata missing');
if (webhook.includes('.from("payments")') || webhook.includes(".from('payments')"))
  throw new Error('Stripe webhook still writes through tenant payments view');
if (!webhook.includes('update_platform_payment_atomic')) throw new Error('Stripe webhook is missing atomic platform lifecycle');
if (!types.includes('platform_payment_transactions:') || !types.includes('update_platform_payment_atomic:'))
  throw new Error('Supabase TypeScript types missing platform payment contract');
if (drill.includes("invoice_type:   'one_time'")) throw new Error('Unsupported manager invoice type one_time remains');

console.log('Phase 14–15 static audit: PASS');
console.log(`Migration files checked: ${migrations.length}`);
console.log('Platform payment table/RPC grants: PASS');
console.log('Stripe checkout isolation/correlation: PASS');
console.log('Stripe webhook atomic lifecycle/no tenant-view writes: PASS');
console.log('Manager invoice type contract: PASS');
