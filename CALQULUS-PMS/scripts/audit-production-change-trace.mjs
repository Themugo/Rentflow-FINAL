import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const tracePath=path.join(root,'docs','audits','PRODUCTION_CHANGE_TRACE.json');
const out=path.join(root,'docs','audits','PRODUCTION_CHANGE_TRACE_AUDIT.json');
const read=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return {};}};
const t=read(tracePath); const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const migrationDir=path.join(root,'supabase','migrations');
const current=fs.existsSync(migrationDir)?fs.readdirSync(migrationDir).filter(f=>f.endsWith('.sql')).sort():[];
const mismatches=[];
for(const e of (Array.isArray(t.migrations)?t.migrations:[])){
 const p=path.join(migrationDir,e.name); if(!fs.existsSync(p)){mismatches.push({name:e.name,reason:'missing'});continue;}
 const b=fs.readFileSync(p); if(b.length!==e.bytes||sha(p)!==e.sha256)mismatches.push({name:e.name,reason:'hash-or-size-mismatch'});
}
const requiredExternal=['releaseCommit','deploymentId','migrationRunId','migrationAppliedAt','migrationOperator','authorizationId'];
const missingExternal=requiredExternal.filter(k=>!String(t[k]||'').trim());
const report={generatedAt:new Date().toISOString(),status:'EXTERNAL_REQUIRED',tracePresent:fs.existsSync(tracePath),migrationCount:current.length,traceMigrationCount:Array.isArray(t.migrations)?t.migrations.length:0,artifactHashIntegrity:mismatches.length?'FAIL':'PASS',migrationMismatches:mismatches,missingProductionExecutionFields:missingExternal,secretFieldsPersisted:t.secretFieldsPersisted===false,rule:'Production change traceability is certified only when the recorded release, deployment, migration execution, and authorization identifiers are externally evidenced and all recorded hashes still match.'};
if(mismatches.length||report.secretFieldsPersisted===false&&t.secretFieldsPersisted!==false) report.status='FAIL';
else if(!missingExternal.length&&report.traceMigrationCount===current.length) report.status='PASS';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`production-change-trace-audit: ${report.status}`);if(report.status==='FAIL')process.exit(1);
