import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();
const out=path.join(root,'docs','audits','STAGING_BOOTSTRAP_READINESS.json');
const required=['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','SMOKE_BASE_URL'];
const missing=required.filter(k=>!process.env[k]);
const unsafe=[];
for(const k of ['VITE_SUPABASE_URL','SMOKE_BASE_URL']) if(process.env[k] && /localhost|127\.0\.0\.1|example\.com|demo/i.test(process.env[k])) unsafe.push(`${k}:unsafe-demo-or-local-url`);
const commands=['node','npm'];
const commandChecks=Object.fromEntries(commands.map(c=>[c,spawnSync(c,['--version'],{stdio:'ignore'}).status===0]));
const playwright=fs.existsSync(path.join(root,'node_modules','@playwright','test')) || fs.existsSync(path.join(root,'node_modules','playwright'));
const report={generatedAt:new Date().toISOString(),status:(missing.length||unsafe.length)?'EXTERNAL_REQUIRED':'PASS',missingEnvironment:missing,unsafeDefaults:unsafe,tooling:{...commandChecks,playwright},rules:{credentialsEnvironmentOnly:true,noProductionMutation:true,noSecretPersistence:true}};
fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`staging-bootstrap-readiness: ${report.status}`);
if(missing.length) console.log(`- missing environment: ${missing.join(', ')}`);
if(unsafe.length) console.log(`- unsafe defaults: ${unsafe.join(', ')}`);
