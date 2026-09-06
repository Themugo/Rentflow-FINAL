import fs from 'node:fs';
const sql=fs.readFileSync('supabase/migrations/20260904000004_unit_first_multi_payer_bulk_payments.sql','utf8');
const required=['payment_parties','payer_unit_links','payment_receipts','process_payer_payment_atomic','get_portal_billing_units','payer_party_id','payment_allocations','receipt_number'];
for(const x of required) if(!sql.includes(x)) throw new Error(`Missing ${x}`);
let depth=0; for(const c of sql){if(c==='(')depth++; if(c===')')depth--; if(depth<0)throw new Error('Unbalanced parentheses');}
if(depth!==0)throw new Error('Unbalanced parentheses');
console.log('UNIT_FIRST_MULTI_PAYER_AUDIT=PASS');

const read = (f) => fs.readFileSync(f,'utf8');
const assert = (c,m) => { if(!c) throw new Error(m); };
const finalMigration = read('supabase/migrations/20260904000005_payment_receipt_delivery_and_stk_completion.sql');
assert(finalMigration.includes('CREATE TABLE IF NOT EXISTS public.issued_payment_receipts'), 'issued receipt table missing');
assert(finalMigration.includes('issue_payment_receipt_atomic'), 'canonical receipt RPC missing');
assert(finalMigration.includes('resolve_tenant_auth_user'), 'tenant auth bridge missing');
assert(finalMigration.includes("property+landlord"), 'hierarchical landlord property note missing');
const paymentEngine = read('supabase/functions/process-payment/index.ts');
assert(paymentEngine.includes('issue_payment_receipt_atomic'), 'payment engine does not issue canonical receipt');
assert(paymentEngine.includes('secondary artifact'), 'receipt failure handling is not documented');
console.log('UNIT_FIRST_PAYMENT_RECEIPT_COMPLETION_AUDIT=PASS');
