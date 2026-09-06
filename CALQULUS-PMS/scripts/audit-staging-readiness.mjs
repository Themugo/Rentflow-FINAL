import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=[
 'supabase/config.toml','supabase/migrations','scripts/audit-production.mjs','scripts/security-boundary-audit.mjs','scripts/cross-role-isolation-audit.mjs','scripts/audit-final-security.mjs','scripts/audit-migration-chain.mjs','config/migration-history-policy.json'
];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
const migrations=fs.readdirSync(path.join(root,'supabase','migrations')).filter(f=>f.endsWith('.sql'));
const config=fs.readFileSync(path.join(root,'supabase','config.toml'),'utf8');
const verifyFalse=(config.match(/verify_jwt\s*=\s*false/g)||[]).length;
const report={generatedAt:new Date().toISOString(),status:missing.length?'FAIL':'PASS',migrationCount:migrations.length,verifyJwtFalseCount:verifyFalse,missing};
fs.writeFileSync(path.join(root,'docs','audits','STAGING_READINESS_CERTIFICATE.json'),JSON.stringify(report,null,2)+'\n');
console.log(`staging-readiness: ${report.status}`);
console.log(`- migrations: ${migrations.length}`);
console.log(`- verify_jwt=false functions: ${verifyFalse} (requires endpoint-by-endpoint review; not an automatic failure)`);
if(missing.length){console.error('Missing required artifacts:',missing.join(', '));process.exit(1)}
