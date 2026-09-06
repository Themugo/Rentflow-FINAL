import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const audits = path.join(root, 'docs', 'audits');
const out = path.join(audits, 'FINAL_PRODUCTION_RELEASE_DECISION.json');
const files = [
  ['productionReleaseCertification','PRODUCTION_RELEASE_CERTIFICATION.json'],
  ['releaseSecurityGate','RELEASE_SECURITY_GATE.json'],
  ['externalEvidenceBinding','EXTERNAL_EVIDENCE_BINDING_AUDIT.json'],
  ['productionEvidenceIngestion','PRODUCTION_EVIDENCE_INGESTION.json'],
  ['independentAttestation','INDEPENDENT_RELEASE_ATTESTATION.json'],
  ['attestationSignature','INDEPENDENT_ATTESTATION_SIGNATURE_AUDIT.json'],
  ['releaseEvidenceIntegrity','RELEASE_EVIDENCE_INTEGRITY_AUDIT.json'],
  ['signedReleaseManifest','SIGNED_RELEASE_MANIFEST_AUDIT.json'],
  ['deploymentAttestation','DEPLOYMENT_ATTESTATION_AUDIT.json'],
  ['migrationAttestation','PRODUCTION_MIGRATION_ATTESTATION.json'],
  ['rollbackReadiness','ROLLBACK_READINESS.json'],
  ['deploymentDrift','DEPLOYMENT_DRIFT.json'],
  ['releasePromotionLock','RELEASE_PROMOTION_LOCK.json'],
  ['productionChangeTrace','PRODUCTION_CHANGE_TRACE_AUDIT.json'],
  ['securityRegressionDiff','SECURITY_REGRESSION_DIFF.json']
];
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(audits, f), 'utf8')); } catch { return null; } };
const checks = Object.fromEntries(files.map(([k,f]) => [k, read(f)?.status || 'NOT_RECORDED']));
const fail = Object.entries(checks).filter(([,v]) => v === 'FAIL').map(([k]) => k);
const missing = Object.entries(checks).filter(([,v]) => v === 'NOT_RECORDED').map(([k]) => k);
const external = Object.entries(checks).filter(([,v]) => v === 'EXTERNAL_REQUIRED').map(([k]) => k);
let status = fail.length || missing.length ? 'BLOCKED_SECURITY_FAILURE' : external.length ? 'BLOCKED_EXTERNAL_EVIDENCE_REQUIRED' : 'CERTIFIED';
const decision = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status,
  decision: status === 'CERTIFIED' ? 'PRODUCTION_RELEASE_CERTIFIED' : status === 'BLOCKED_SECURITY_FAILURE' ? 'PRODUCTION_RELEASE_BLOCKED_SECURITY_FAILURE' : 'PRODUCTION_RELEASE_BLOCKED_EXTERNAL_EVIDENCE_REQUIRED',
  checks,
  failures: fail,
  missing,
  externalRequired: external,
  failClosed: true,
  rule: 'The final production decision is certified only when every required release control is PASS. Any FAIL blocks for security; any unresolved external control blocks for evidence. EXTERNAL_REQUIRED is never treated as approval.'
};
const canonical = JSON.stringify(decision);
decision.decisionHashSha256 = crypto.createHash('sha256').update(canonical).digest('hex');
fs.writeFileSync(out, JSON.stringify(decision, null, 2) + '\n');
console.log(`final-production-release-decision: ${status} (${fail.length} failures, ${external.length} external)`);
if (status === 'BLOCKED_SECURITY_FAILURE') process.exit(1);
