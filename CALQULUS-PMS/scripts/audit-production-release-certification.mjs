import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const audits = path.join(root, 'docs', 'audits');
const out = path.join(audits, 'PRODUCTION_RELEASE_CERTIFICATION.json');
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(audits, f), 'utf8')); } catch { return null; } };
const checks = [
  ['releaseReconciliation','RELEASE_RECONCILIATION.json'],
  ['externalEvidenceBinding','EXTERNAL_EVIDENCE_BINDING_AUDIT.json'],
  ['migrationAttestation','PRODUCTION_MIGRATION_ATTESTATION.json'],
  ['deploymentAttestation','DEPLOYMENT_ATTESTATION_AUDIT.json'],
  ['artifactProvenance','RELEASE_ARTIFACT_PROVENANCE.json'],
  ['deploymentDrift','DEPLOYMENT_DRIFT.json'],
  ['rollbackReadiness','ROLLBACK_READINESS.json'],
  ['rollbackExecution','ROLLBACK_EXECUTION_EVIDENCE.json'],
  ['releasePromotionLock','RELEASE_PROMOTION_LOCK.json'],
  ['productionChangeTrace','PRODUCTION_CHANGE_TRACE_AUDIT.json'],
  ['signedReleaseManifest','SIGNED_RELEASE_MANIFEST_AUDIT.json'],
  ['securityRegressionDiff','SECURITY_REGRESSION_DIFF.json'],
  ['productionEvidenceIngestion','PRODUCTION_EVIDENCE_INGESTION.json'],
  ['independentReleaseAttestation','INDEPENDENT_RELEASE_ATTESTATION.json'],
  ['attestationSignature','INDEPENDENT_ATTESTATION_SIGNATURE_AUDIT.json']
];
const commandChecks = [
  ['securityBoundary','scripts/security-boundary-audit.mjs'],
  ['crossRole','scripts/cross-role-isolation-audit.mjs'],
  ['finalSecurity','scripts/audit-final-security.mjs'],
  ['migrationChain','scripts/audit-migration-chain.mjs']
];
const commandResults = Object.fromEntries(commandChecks.map(([k, script]) => {
  const r = spawnSync(process.execPath, [path.join(root, script)], { encoding: 'utf8' });
  return [k, r.status === 0 ? 'PASS' : 'FAIL'];
}));
const results = Object.fromEntries(checks.map(([k,f]) => [k, read(f)?.status || 'NOT_RECORDED']));
Object.assign(results, commandResults);
const failures = Object.entries(results).filter(([,v]) => v === 'FAIL').map(([k]) => k);
const missing = Object.entries(results).filter(([,v]) => v === 'NOT_RECORDED').map(([k]) => k);
const external = Object.entries(results).filter(([,v]) => v === 'EXTERNAL_REQUIRED').map(([k]) => k);
const status = failures.length || missing.length ? 'FAIL' : external.length ? 'EXTERNAL_REQUIRED' : 'PASS';
const report = {
  generatedAt: new Date().toISOString(),
  status,
  decision: status === 'PASS' ? 'PRODUCTION_RELEASE_CERTIFIED' : status === 'EXTERNAL_REQUIRED' ? 'PRODUCTION_RELEASE_BLOCKED_EXTERNAL_EVIDENCE_REQUIRED' : 'PRODUCTION_RELEASE_BLOCKED_SECURITY_FAILURE',
  checks: results,
  failures,
  missing,
  externalRequired: external,
  rule: 'Production certification is fail-closed. PASS is allowed only when every repository and external release control is PASS. EXTERNAL_REQUIRED is not a certification.'
};
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`production-release-certification: ${status} (${failures.length} failures, ${external.length} external)`);
if (status === 'FAIL') process.exit(1);
