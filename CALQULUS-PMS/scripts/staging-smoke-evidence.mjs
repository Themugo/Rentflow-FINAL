import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const baseUrl=(process.env.SMOKE_BASE_URL||'').replace(/\/$/,'');
const output=path.join(process.cwd(),'docs','audits','STAGING_SMOKE_EVIDENCE.json');
if(!baseUrl){
  const report={generatedAt:new Date().toISOString(),status:'EXTERNAL_REQUIRED',baseUrl:null,routes:[],note:'Set SMOKE_BASE_URL to the staging or production origin and rerun. This command never creates credentials or bypasses authentication.'};
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log('staging-smoke-evidence: EXTERNAL_REQUIRED');
  process.exit(0);
}
const routes=['/','/legal','/install','/pricing','/auth','/health'];
const results=[]; const failures=[];
for(const route of routes){
  const url=`${baseUrl}${route}`; const started=Date.now();
  try{
    const response=await fetch(url,{redirect:'follow'}); const body=await response.text();
    const hash=crypto.createHash('sha256').update(body).digest('hex').slice(0,16);
    const spa=route==='/health' ? true : body.includes('id="root"');
    const ok=response.ok && spa;
    results.push({route,status:response.status,ok,latencyMs:Date.now()-started,bodySha256:hash,contentType:response.headers.get('content-type'),requestId:response.headers.get('x-request-id')||response.headers.get('x-correlation-id')||null});
    if(!ok) failures.push(`${route}: unexpected response (${response.status}) or SPA shell missing`);
  }catch(error){failures.push(`${route}: ${error.message}`);results.push({route,ok:false,error:error.message,latencyMs:Date.now()-started});}
}
const report={generatedAt:new Date().toISOString(),status:failures.length?'FAIL':'PASS',baseUrl,routes:results,failures,notes:['Public smoke only; authenticated role isolation requires dedicated staging credentials and E2E tests.','Hashes are short fingerprints for evidence comparison, not content storage.']};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(`staging-smoke-evidence: ${report.status}`);
if(failures.length){for(const f of failures)console.error(`FAIL ${f}`);process.exit(1)}
