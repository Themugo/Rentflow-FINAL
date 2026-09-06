import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const audits = path.join(root, 'docs', 'audits');
const out = path.join(audits, 'RELEASE_SECURITY_GATE.json');
const names = [
  ['securityBoundary','SECURITY_BOUNDARY_AUDIT.json'],
  ['crossRole','CROSS_ROLE_ISOLATION_AUDIT.json'],
  ['finalSecurity','FINAL_SECURITY_AUDIT.json'],
  ['migrationChain','MIGRATION_CHAIN_AUDIT.json'],
  ['dependencyProvenance','DEPENDENCY_PROVENANCE.json'],
  ['runtimeDependencyGovernance','RUNTIME_DEPENDENCY_GOVERNANCE.json'],
  ['runtimeUpdatePolicy','RUNTIME_UPDATE_POLICY.json'],
  ['sbom','SBOM_AUDIT.json'],
  ['secretSupplyChain','SECRET_SUPPLY_CHAIN.json'],
  ['vulnerabilityGovernance','VULNERABILITY_GOVERNANCE.json'],
  ['ciReleaseGate','CI_RELEASE_GATE.json'],
  ['securityRegressionMatrix','SECURITY_REGRESSION_MATRIX.json'],
  ['securityRegressionDiff','SECURITY_REGRESSION_DIFF.json'],
  ['releaseEvidenceIntegrity','RELEASE_EVIDENCE_INTEGRITY_AUDIT.json'],
  ['externalEvidenceBinding','EXTERNAL_EVIDENCE_BINDING_AUDIT.json'],
  ['productionEvidenceIngestion','PRODUCTION_EVIDENCE_INGESTION.json'],
  ['independentReleaseAttestation','INDEPENDENT_RELEASE_ATTESTATION.json'],
  ['attestationSignature','INDEPENDENT_ATTESTATION_SIGNATURE_AUDIT.json'],
  ['productionReleaseCertification','PRODUCTION_RELEASE_CERTIFICATION.json']
];
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(audits, f), 'utf8')); } catch { return null; } };
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
const checks = Object.fromEntries(names.map(([k,f]) => [k, commandResults[k] || read(f)?.status || 'NOT_RECORDED']));
const failures = Object.entries(checks).filter(([,s]) => s === 'FAIL').map(([k]) => k);
const missing = Object.entries(checks).filter(([,s]) => s === 'NOT_RECORDED').map(([k]) => k);
const external = Object.entries(checks).filter(([,s]) => s === 'EXTERNAL_REQUIRED').map(([k]) => k);
const status = failures.length || missing.length ? 'FAIL' : external.length ? 'EXTERNAL_REQUIRED' : 'PASS';
const report = { generatedAt: new Date().toISOString(), status, checkCount: names.length, failures, missing, externalRequired: external, checks, rule: 'The consolidated security gate fails on an actual security regression or missing required repository control. Infrastructure-dependent evidence remains EXTERNAL_REQUIRED and cannot be converted to PASS by local automation.' };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`release-security-gate: ${status} (${failures.length} failures, ${external.length} external)`);
if (status === 'FAIL') process.exit(1);
