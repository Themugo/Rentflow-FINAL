import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const fnRoot=path.join(root,'supabase','functions');
const migRoot=path.join(root,'supabase','migrations');
const failures=[];
const balanced = (text) => {
  const stripped=text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|\s)\/\/.*$/gm,'');
  return ['()','{}','[]'].every(pair => { const [a,b]=pair; let d=0; for(const ch of stripped){ if(ch===a)d++; else if(ch===b)d--; if(d<0)return false; } return d===0; });
};
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
for(const f of walk(fnRoot).filter(x=>x.endsWith('index.ts'))){
 const s=fs.readFileSync(f,'utf8');
 if(f.includes(`${path.sep}_shared${path.sep}`)) continue;
 if(/from\(["']user_roles["']\)[\s\S]{0,500}\.single\(\)/.test(s) && /roleData\?\.role|roleRow\?\.role/.test(s) && !/auth\.getUser|withMiddleware\([\s\S]{0,500}(?:requireAuth\s*:\s*true|allowedRoles\s*:\s*\[)/.test(s)) failures.push(`role lookup without explicit auth gate: ${path.relative(root,f)}`);
 const hasProtectedMutation = /\.from\(["'](payment_transactions|payout_requests|disputes|user_roles|platform_admins|admin_permissions|payment_parties)["']\)[\s\S]{0,1000}\.(?:update|insert)\(/.test(s);
 const hasAuthOrServiceGate = /SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY|withMiddleware\([\s\S]{0,800}(?:requireAuth\s*:\s*true|allowedRoles\s*:\s*\[)|auth\.getUser|authenticateUser/.test(s);
 const isExplicitlyPublicShareFlow = f.endsWith(`${path.sep}initiate-shared-payment${path.sep}index.ts`) && /get_public_payment_share/.test(s) && /check_shared_payment_attempt_atomic/.test(s) && /consume_shared_payment_link_atomic/.test(s);
 if(hasProtectedMutation && !hasAuthOrServiceGate && !isExplicitlyPublicShareFlow) failures.push(`protected mutation lacks visible auth/service gate: ${path.relative(root,f)}`);
}
for(const f of walk(migRoot).filter(x=>x.endsWith('.sql'))){
 const s=fs.readFileSync(f,'utf8');
 for(const m of s.matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+([^;\n]+?)\s+TO\s+anon/gi)){
  if(/self_register_tenant_atomic|create_dispute_atomic|process_payment_atomic|transition_payout_request_atomic|record_commission_atomic/i.test(m[1])) failures.push(`sensitive RPC granted to anon: ${path.basename(f)} :: ${m[1].trim()}`);
 }
}
for(const rel of ['supabase/functions/self-register-tenant/index.ts','supabase/functions/create-dispute/index.ts','supabase/functions/send-invoice-email/index.ts']){ const f=path.join(root,rel); if(!balanced(fs.readFileSync(f,'utf8'))) failures.push(`unbalanced changed edge function: ${rel}`); }
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('cross-role-isolation-audit: PASS');
