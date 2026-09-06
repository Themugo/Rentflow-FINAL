import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const evidencePath=path.join(root,'docs','audits','LIVE_RELEASE_EVIDENCE.json');
const smokePath=path.join(root,'docs','audits','STAGING_SMOKE_EVIDENCE.json');
let evidence={}; if(fs.existsSync(evidencePath)){try{evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));}catch{}}
let smoke={}; if(fs.existsSync(smokePath)){try{smoke=JSON.parse(fs.readFileSync(smokePath,'utf8'));}catch{}}
const required=['releaseCommit','stagingMigrationRun','stagingSmokeRun','stagingRestoreRun','productionApproval'];
const missing=required.filter(k=>!evidence[k]);
const report={generatedAt:new Date().toISOString(),status:missing.length?'BLOCKED':'PASS',requiredEvidence:required,missingEvidence:missing,smokeEvidenceStatus:smoke.status||'NOT_RECORDED',goLiveRule:'Never infer live deployment success from repository audits alone.'};
fs.writeFileSync(path.join(root,'docs','audits','PRODUCTION_EVIDENCE_GATE.json'),JSON.stringify(report,null,2)+'\n');
console.log(`production-evidence-gate: ${report.status}`);
if(missing.length)console.log(`- missing: ${missing.join(', ')}`);
if(report.status!=='PASS')process.exit(1);
