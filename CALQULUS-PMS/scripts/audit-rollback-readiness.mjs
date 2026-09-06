import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'docs','audits','ROLLBACK_READINESS.json');
const read=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return {};}};
const exists=p=>fs.existsSync(path.join(root,p));
const rollbackEvidence=read('docs/audits/ROLLBACK_EXECUTION_EVIDENCE.json');
const provenance=read('docs/audits/RELEASE_ARTIFACT_PROVENANCE.json');
const deployment=read('docs/audits/DEPLOYMENT_EXECUTION_EVIDENCE.json');
const checks={
  rollbackRunbook:exists('docs/operations/PHASE_116_117_ROLLBACK_PROVENANCE_RUNBOOK.md'),
  restoreDrillScript:exists('scripts/restore-migrations-drill.sh'),
  migrationRepairPlan:exists('docs/audits/MIGRATION_REPAIR_PLAN.json')||exists('docs/operations/MIGRATION_REPAIR_PLAN.md'),
  deploymentRunbook:exists('docs/operations/PHASE_114_115_DEPLOYMENT_MIGRATION_RUNBOOK.md'),
  rollbackEvidenceRecorded:rollbackEvidence.status==='PASS',
  artifactProvenance:provenance.status==='PASS',
  deploymentManifestPresent:deployment.status==='EXTERNAL_REQUIRED'||deployment.status==='PASS'
};
const external=['approved backup/PITR restore point','tested rollback execution or restore evidence','release operator and execution IDs'];
const missing=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
const report={generatedAt:new Date().toISOString(),status:missing.length?'EXTERNAL_REQUIRED':'EXTERNAL_REQUIRED',checks,missingRepositoryPrerequisites:missing,requiredExternalEvidence:external,rollbackEvidenceStatus:rollbackEvidence.status||'NOT_RECORDED',artifactProvenanceStatus:provenance.status||'NOT_RECORDED',rule:'Rollback readiness may be prepared in-repository, but production recovery is never certified without external backup/restore and approved execution evidence.'};
if(missing.includes('artifactProvenance')) report.status='BLOCKED';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`rollback-readiness: ${report.status}`);if(report.status==='BLOCKED')process.exit(1);
