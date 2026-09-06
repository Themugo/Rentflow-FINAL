import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=process.cwd();
const evidencePath=path.join(root,'docs','audits','LIVE_RELEASE_EVIDENCE.json');
const readJson=(file, fallback={})=>{try{return JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));}catch{return fallback;}};
let evidence=readJson('docs/audits/LIVE_RELEASE_EVIDENCE.json',{});
let commit=process.env.RELEASE_COMMIT||''; try { if(!commit) commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(); } catch {}
if(commit) evidence.releaseCommit=commit;
const statusOnly=(file)=>{const v=readJson(file,{}); return {status:v.status||'NOT_RECORDED',generatedAt:v.generatedAt||null};};
evidence.automatedEvidence={
  capturedAt:new Date().toISOString(),
  migrationReconciliation:statusOnly('docs/audits/LIVE_MIGRATION_RECONCILIATION.json'),
  stagingSmoke:statusOnly('docs/audits/STAGING_SMOKE_EVIDENCE.json'),
  stagingE2E:statusOnly('docs/audits/STAGING_E2E_EVIDENCE.json'),
  stagingRoleCertification:statusOnly('docs/audits/STAGING_ROLE_CERTIFICATION.json'),
  liveSecurity:statusOnly('docs/audits/LIVE_SECURITY_EVIDENCE.json'),
  disasterRecovery:statusOnly('docs/audits/DISASTER_RECOVERY_CERTIFICATE.json'),
  rollbackExecution:statusOnly('docs/audits/ROLLBACK_EXECUTION_EVIDENCE.json'),
  artifactProvenance:statusOnly('docs/audits/RELEASE_ARTIFACT_PROVENANCE.json'),
  deploymentDrift:statusOnly('docs/audits/DEPLOYMENT_DRIFT.json'),
  rollbackReadiness:statusOnly('docs/audits/ROLLBACK_READINESS.json'),
  releasePromotionLock:statusOnly('docs/audits/RELEASE_PROMOTION_LOCK.json'),
  productionChangeTrace:statusOnly('docs/audits/PRODUCTION_CHANGE_TRACE_AUDIT.json'),
  signedReleaseManifest:statusOnly('docs/audits/SIGNED_RELEASE_MANIFEST_AUDIT.json'),
  deploymentAttestation:statusOnly('docs/audits/DEPLOYMENT_ATTESTATION_AUDIT.json'),
  productionEvidenceIngestion:statusOnly('docs/audits/PRODUCTION_EVIDENCE_INGESTION.json'),
  independentReleaseAttestation:statusOnly('docs/audits/INDEPENDENT_RELEASE_ATTESTATION.json')
};
// Never copy credentials, tokens, database URLs, or full command output into the release evidence file.
delete evidence.automatedEvidence.migrationReconciliation.databaseUrl;
fs.writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');
console.log(`release-evidence-captured: ${commit?'PASS':'EXTERNAL_REQUIRED'}`);
