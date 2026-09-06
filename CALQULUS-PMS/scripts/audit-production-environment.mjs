import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envExample = path.join(root, '.env.example');
const requiredFiles = [
  'supabase/config.toml',
  'scripts/deploy-production.mjs',
  'scripts/smoke-deploy.mjs',
  'scripts/audit-go-live.mjs',
  'scripts/reconcile-live-migrations.mjs',
  'docs/operations/STAGING_DEPLOYMENT_RUNBOOK.md',
  'docs/operations/DISASTER_RECOVERY_RUNBOOK.md',
];
const failures = [];
for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) failures.push(`missing artifact: ${file}`);
const envText = fs.existsSync(envExample) ? fs.readFileSync(envExample, 'utf8') : '';
const requiredVars = ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY'];
for (const key of requiredVars) if (!new RegExp(`^${key}\\s*=`, 'm').test(envText)) failures.push(`.env.example missing ${key}`);
const config = fs.existsSync(path.join(root,'supabase/config.toml')) ? fs.readFileSync(path.join(root,'supabase/config.toml'),'utf8') : '';
const jwtFalse = [...config.matchAll(/\[functions\.([^\]]+)\][\s\S]*?verify_jwt\s*=\s*false/g)].map(m=>m[1]);
const forbiddenDemo = ['VITE_ENABLE_DEV_ACCESS="true"','VITE_ENABLE_PUBLIC_DEMO="true"','VITE_ENABLE_DEMO_SEED="true"'];
for (const value of forbiddenDemo) if (envText.includes(value)) failures.push(`production-unsafe default in .env.example: ${value}`);
const report = { generatedAt:new Date().toISOString(), status: failures.length ? 'FAIL':'PASS', requiredFiles, requiredClientVariables:requiredVars, verifyJwtFalseFunctions:jwtFalse, productionUnsafeDefaults:forbiddenDemo.filter(v=>envText.includes(v)), failures, externalEvidenceRequired:['Vercel environment variables configured','Supabase project secrets configured','production domain configured','live migration reconciliation','staging smoke and restore evidence'] };
fs.writeFileSync(path.join(root,'docs','audits','PRODUCTION_ENVIRONMENT_CERTIFICATE.json'), JSON.stringify(report,null,2)+'\n');
console.log(`production-environment: ${report.status}`);
console.log(`- verify_jwt=false functions: ${jwtFalse.length}`);
if (failures.length) { for (const f of failures) console.error(`FAIL ${f}`); process.exit(1); }
