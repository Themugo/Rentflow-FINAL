import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const file=path.join(root,'docs','audits','LIVE_RELEASE_EVIDENCE.json');
let evidence={}; try{evidence=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
const required=['releaseCommit','stagingMigrationRun','stagingSmokeRun','stagingRestoreRun','productionApproval'];
const missing=[];
for(const key of required){const v=evidence[key]; if(!v || (typeof v==='string' && !v.trim()) || (typeof v==='object' && Object.values(v).some(x=>!String(x||'').trim()))) missing.push(key);}
const auto=evidence.automatedEvidence||{};
const autoChecks={migrationReconciliation:auto.migrationReconciliation?.status||'NOT_RECORDED',stagingSmoke:auto.stagingSmoke?.status||'NOT_RECORDED',stagingE2E:auto.stagingE2E?.status||'NOT_RECORDED',stagingRoleCertification:auto.stagingRoleCertification?.status||'NOT_RECORDED',liveSecurity:auto.liveSecurity?.status||'NOT_RECORDED'};
const forbiddenKeys=/(^|\")((?:[^\"]*password[^\"]*)|(?:[^\"]*secret[^\"]*)|(?:[^\"]*access_token[^\"]*)|(?:database_url|supabase_db_url))(\"|\s*:)/i;
const raw=fs.readFileSync(file,'utf8');
const secretLeak=forbiddenKeys.test(raw);
const report={generatedAt:new Date().toISOString(),status:missing.length||secretLeak?'BLOCKED':'PASS',requiredEvidence:required,missingEvidence:missing,automatedChecks:autoChecks,secretLeakDetected:secretLeak,rule:'External evidence must be explicitly recorded; repository automation never invents staging, recovery, or production approval evidence.'};
fs.writeFileSync(path.join(root,'docs','audits','RELEASE_EVIDENCE_GATE.json'),JSON.stringify(report,null,2)+'\n');
console.log(`release-evidence-audit: ${report.status}`);
if(missing.length) console.log(`- missing: ${missing.join(', ')}`);
if(secretLeak) console.log('- possible credential/token field detected in evidence');
if(report.status!=='PASS') process.exit(1);
