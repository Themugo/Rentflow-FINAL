import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const out=path.join(root,'docs','audits','ROLLBACK_EXECUTION_EVIDENCE.json');
const sha=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
let commit=process.env.RELEASE_COMMIT||'';
if(!commit){try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}}
const rollbackId=process.env.ROLLBACK_EXECUTION_ID||'';
const rollbackAt=process.env.ROLLBACK_EXECUTED_AT||'';
const rollbackOperator=process.env.ROLLBACK_OPERATOR||'';
const restoreRunId=process.env.ROLLBACK_RESTORE_RUN_ID||'';
const verified=process.env.ROLLBACK_VERIFIED==='true';
const plan=path.join(root,'docs','operations','PHASE_114_115_DEPLOYMENT_MIGRATION_RUNBOOK.md');
const report={generatedAt:new Date().toISOString(),status:'EXTERNAL_REQUIRED',releaseCommit:commit||null,rollbackExecutionId:rollbackId||null,rollbackExecutedAt:rollbackAt||null,rollbackOperatorRecorded:Boolean(rollbackOperator),restoreRunId:restoreRunId||null,rollbackVerified:verified,runbookPresent:fs.existsSync(plan),runbookSha256:sha(plan),requiredExternalEvidence:['rollbackExecutionId','rollbackExecutedAt','rollbackOperator','rollbackRestoreRunId','rollbackVerified=true'],note:'Rollback evidence is attestation-only. This script never executes rollback SQL, deletes data, or claims recovery without explicit external evidence.'};
if(rollbackId&&rollbackAt&&rollbackOperator&&restoreRunId&&verified&&report.runbookPresent) report.status='PASS';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`rollback-execution-evidence: ${report.status}`);
