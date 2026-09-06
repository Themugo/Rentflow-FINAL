import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const audits = path.join(root, 'docs', 'audits');
const out = path.join(audits, 'RELEASE_EVIDENCE_INTEGRITY.json');
const files = [
  'LIVE_RELEASE_EVIDENCE.json',
  'RELEASE_RECONCILIATION.json',
  'SIGNED_RELEASE_MANIFEST.json',
  'SIGNED_RELEASE_MANIFEST_AUDIT.json',
  'DEPLOYMENT_ATTESTATION.json',
  'DEPLOYMENT_ATTESTATION_AUDIT.json',
  'ROLLBACK_EXECUTION_EVIDENCE.json',
  'RELEASE_ARTIFACT_PROVENANCE.json',
  'DEPLOYMENT_DRIFT.json',
  'ROLLBACK_READINESS.json',
  'RELEASE_PROMOTION_LOCK.json',
  'PRODUCTION_CHANGE_TRACE.json',
  'PRODUCTION_CHANGE_TRACE_AUDIT.json',
  'SECURITY_REGRESSION_MATRIX.json',
  'SECURITY_REGRESSION_DIFF.json',
  'CI_RELEASE_GATE.json',
  'EXTERNAL_EVIDENCE_BINDING.json'
];
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const present = files.filter(f => fs.existsSync(path.join(audits, f)));
const entries = present.map((file) => {
  const p = path.join(audits, file);
  const stat = fs.statSync(p);
  return { file, sha256: sha256(p), bytes: stat.size };
});
const canonical = entries.map(e => `${e.file}|${e.sha256}|${e.bytes}`).join('\n');
const chainHash = crypto.createHash('sha256').update(canonical).digest('hex');
const report = {
  generatedAt: new Date().toISOString(),
  status: entries.length === files.length ? 'PASS' : 'EXTERNAL_REQUIRED',
  algorithm: 'SHA-256',
  entryCount: entries.length,
  expectedEntryCount: files.length,
  entries,
  chainHash,
  rule: 'This ledger detects subsequent changes to recorded release evidence. It is a tamper-evident repository control, not an external immutable archive; final release certification still requires an independently retained copy or signing key.'
};
fs.mkdirSync(audits, { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`release-evidence-integrity: ${report.status} (${entries.length}/${files.length} evidence files)`);
if (report.status === 'EXTERNAL_REQUIRED') process.exit(1);
