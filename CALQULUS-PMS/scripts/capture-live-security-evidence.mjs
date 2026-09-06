import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const out=path.join(root,'docs','audits','LIVE_SECURITY_EVIDENCE.json');
const db=process.env.DATABASE_URL||process.env.SUPABASE_DB_URL||'';
const run=(script, env={})=>{
  try { execFileSync(process.platform==='win32'?'npm.cmd':'npm',['run',script],{cwd:root,stdio:'pipe',encoding:'utf8',env:{...process.env,...env}}); return 'PASS'; }
  catch(e) { const stdout=String(e.stdout||''); const stderr=String(e.stderr||''); if((stdout+stderr).includes('EXTERNAL_REQUIRED')) return 'EXTERNAL_REQUIRED'; return 'FAIL'; }
};
const report={generatedAt:new Date().toISOString(),status:'EXTERNAL_REQUIRED',databaseAccessed:false,checks:{}};
if(!db){ report.reason='DATABASE_URL or SUPABASE_DB_URL is required for live schema/RLS evidence; no database is accessed implicitly.'; fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n'); console.log('live-security-evidence: EXTERNAL_REQUIRED'); process.exit(0); }
report.databaseAccessed=true;
report.checks={migrationIntegrity:run('verify:migration-integrity'),schemaDrift:run('audit:schema-drift'),liveRls:run('audit:live-rls'),liveMigrations:run('reconcile:live-migrations')};
report.status=Object.values(report.checks).every(v=>v==='PASS')?'PASS':'FAIL';
report.note='Status-only aggregation. Credentials, database URLs and query output are never persisted.';
fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`live-security-evidence: ${report.status}`);
if(report.status==='FAIL') process.exit(1);
