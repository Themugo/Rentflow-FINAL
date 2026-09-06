import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'docs', 'audits', 'RELEASE_PROMOTION_LOCK.json');
const read = p => { try { return JSON.parse(fs.readFileSync(path.join(root,p),'utf8')); } catch { return {}; } };
const env = k => String(process.env[k] || '').trim();
let commit = '';
try { commit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(); } catch {}
const evidence = read('docs/audits/LIVE_RELEASE_EVIDENCE.json');
const reconciliation = read('docs/audits/RELEASE_RECONCILIATION.json');
const provenance = read('docs/audits/RELEASE_ARTIFACT_PROVENANCE.json');
const drift = read('docs/audits/DEPLOYMENT_DRIFT.json');
const rollback = read('docs/audits/ROLLBACK_READINESS.json');
const required = {
  authorizationId: env('RELEASE_AUTHORIZATION_ID'),
  authorizedBy: env('RELEASE_AUTHORIZED_BY'),
  authorizedAt: env('RELEASE_AUTHORIZED_AT'),
  scope: env('RELEASE_AUTHORIZATION_SCOPE'),
};
const validDate = required.authorizedAt ? !Number.isNaN(Date.parse(required.authorizedAt)) : false;
const scopeOk = required.scope.toLowerCase() === 'production';
const expected = env('RELEASE_COMMIT_EXPECTED') || evidence.releaseCommit || '';
const commitOk = Boolean(commit && expected && commit === expected);
const checks = {
  authorizationIdRecorded: Boolean(required.authorizationId),
  authorizedByRecorded: Boolean(required.authorizedBy),
  authorizationTimestampValid: validDate,
  authorizationScopeProduction: scopeOk,
  releaseCommitBound: commitOk,
  artifactProvenancePass: provenance.status === 'PASS',
  deploymentDriftPass: drift.status === 'PASS',
  rollbackReadinessPrepared: ['PASS','EXTERNAL_REQUIRED'].includes(rollback.status),
  reconciliationPass: reconciliation.status === 'PASS',
};
const missing = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k);
const externalRequired = missing.some(k => ['authorizationIdRecorded','authorizedByRecorded','authorizationTimestampValid','authorizationScopeProduction','releaseCommitBound','reconciliationPass'].includes(k));
const report = {
  generatedAt: new Date().toISOString(),
  status: missing.length ? (externalRequired ? 'EXTERNAL_REQUIRED' : 'BLOCKED') : 'PASS',
  authorization: {
    authorizationId: required.authorizationId || null,
    authorizedBy: required.authorizedBy || null,
    authorizedAt: required.authorizedAt || null,
    scope: required.scope || null,
    credentialsPersisted: false,
  },
  candidateReleaseCommit: commit || null,
  expectedReleaseCommit: expected || null,
  checks,
  missing,
  rule: 'Production promotion requires explicit authorization bound to the exact certified release commit. Authorization credentials/secrets are never persisted by this audit.'
};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`release-promotion-lock: ${report.status}`);
if (report.status === 'BLOCKED') process.exit(1);
