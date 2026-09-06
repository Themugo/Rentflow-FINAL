import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const commands=[
 ['environment','npm',['run','audit:production-environment']],
 ['deployment','npm',['run','audit:deployment-controls']],
 ['release','npm',['run','audit:release-readiness']],
 ['live-migrations','npm',['run','reconcile:live-migrations']],
 ['staging-e2e','npm',['run','staging:e2e']],
 ['staging-certification','npm',['run','staging:certify']],
 ['live-security','npm',['run','capture:live-security']],
 ['release-evidence','npm',['run','capture:release-evidence']],
 ['production-evidence','npm',['run','audit:production-evidence']],
 ['release-evidence-gate','npm',['run','audit:release-evidence']],
];
const results=[];
for(const [name,cmd,args] of commands){
  try{const out=execFileSync(cmd,args,{stdio:'pipe',encoding:'utf8'});results.push({name,status:'PASS',output:out.slice(-1500)});}
  catch(e){results.push({name,status:'FAIL',output:String(e.stdout||e.stderr||'').slice(-1500)});}
}
const evidencePath=path.join(root,'docs','audits','LIVE_RELEASE_EVIDENCE.json');
let evidence={};
if(fs.existsSync(evidencePath)){try{evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));}catch{}}
const requiredEvidence=['releaseCommit','stagingMigrationRun','stagingSmokeRun','stagingRestoreRun','productionApproval'];
const missingEvidence=requiredEvidence.filter(k=>!evidence[k]);
const hardFailures=results.filter(r=>r.status==='FAIL');
const report={generatedAt:new Date().toISOString(),status:hardFailures.length||missingEvidence.length?'BLOCKED':'GO',checks:results,missingEvidence,decision:hardFailures.length?'Fix failed automated release checks.':missingEvidence.length?'Record external staging/recovery/approval evidence before production promotion.':'All repository and external evidence gates recorded.'};
fs.writeFileSync(path.join(root,'docs','audits','GO_LIVE_CERTIFICATE.json'),JSON.stringify(report,null,2)+'\n');
console.log(`go-live: ${report.status}`);
for(const r of results) console.log(`${r.status} ${r.name}`);
if(missingEvidence.length) console.log(`- missing external evidence: ${missingEvidence.join(', ')}`);
if(report.status!=='GO') process.exit(1);
