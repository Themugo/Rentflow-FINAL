import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dryRun=process.argv.includes('--dry-run');
const steps=[
  ['environment-gate','npm',['run','gate:environment']],
  ['deployment-controls','npm',['run','audit:deployment-controls']],
  ['migration-reconciliation-gate','npm',['run','gate:reconciliation']],
  ['release-readiness','npm',['run','audit:release-readiness']],
  ['observability','npm',['run','audit:observability']],
  ['operations','npm',['run','audit:operations-readiness']],
];
const results=[];
for(const [name,cmd,args] of steps){
  try{const out=execFileSync(cmd,args,{cwd:root,encoding:'utf8',stdio:'pipe'});results.push({name,status:'PASS',output:out.slice(-1000)});}
  catch(e){results.push({name,status:'FAIL',output:String(e.stdout||e.stderr||'').slice(-1500)});}
}
const deploymentMode=dryRun?'DRY_RUN':'PREFLIGHT_ONLY';
const report={generatedAt:new Date().toISOString(),deploymentMode,status:results.every(r=>r.status==='PASS')?'READY':'BLOCKED',steps:results,actions:['Build from a clean committed release','Apply/reconcile Supabase migrations using controlled credentials','Deploy Edge Functions','Deploy frontend through the approved hosting pipeline','Run staging/production smoke tests','Record live release evidence before declaring GO']};
fs.writeFileSync(path.join(root,'docs','audits','DEPLOYMENT_PREFLIGHT_CERTIFICATE.json'),JSON.stringify(report,null,2)+'\n');
console.log(`deploy-preflight: ${report.status} (${deploymentMode})`);
for(const r of results) console.log(`${r.status} ${r.name}`);
if(report.status!=='READY')process.exit(1);
