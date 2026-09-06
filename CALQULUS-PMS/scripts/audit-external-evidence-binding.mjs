import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const audits = path.join(root, 'docs', 'audits');
const input = path.join(audits, 'EXTERNAL_EVIDENCE_BINDING.json');
const evidencePath = path.join(audits, 'LIVE_RELEASE_EVIDENCE.json');
const manifestPath = path.join(audits, 'SIGNED_RELEASE_MANIFEST.json');
const out = path.join(audits, 'EXTERNAL_EVIDENCE_BINDING_AUDIT.json');
const read = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const binding = read(input);
const evidence = read(evidencePath);
const findings = [];
let status = 'PASS';
if (!binding) { status = 'EXTERNAL_REQUIRED'; findings.push('External evidence binding has not been captured.'); }
else {
  if (binding.status !== 'PASS') status = 'EXTERNAL_REQUIRED';
  if (!binding.release?.commit) findings.push('Release commit is not bound.');
  if (!binding.release?.manifestSha256 || !fs.existsSync(manifestPath)) findings.push('Release manifest hash is unavailable.');
  else if (sha256(manifestPath) !== binding.release.manifestSha256) { status = 'FAIL'; findings.push('Bound release manifest hash does not match the current manifest.'); }
  if (!binding.evidence?.liveReleaseEvidenceSha256 || !fs.existsSync(evidencePath)) findings.push('Live release evidence hash is unavailable.');
  else if (sha256(evidencePath) !== binding.evidence.liveReleaseEvidenceSha256) { status = 'FAIL'; findings.push('Bound live release evidence hash does not match the current evidence.'); }
  const forbidden = /^(password|secret|access[_-]?token|database[_-]?url|supabase[_-]?db[_-]?url|private[_-]?key|api[_-]?key)$/i;
  const walkKeys = value => { if (!value || typeof value !== 'object') return []; return Object.entries(value).flatMap(([k,v]) => [k, ...walkKeys(v)]); };
  if (walkKeys(binding).some(k => forbidden.test(k))) { status = 'FAIL'; findings.push('Binding contains a forbidden credential/secret key.'); }
  if (binding.approval?.approvedAt && Number.isNaN(Date.parse(binding.approval.approvedAt))) { status = 'FAIL'; findings.push('Production approval timestamp is invalid.'); }
  if (evidence?.releaseCommit && binding.release?.commit && evidence.releaseCommit !== binding.release.commit) { status = 'FAIL'; findings.push('Bound release commit differs from LIVE_RELEASE_EVIDENCE.'); }
  if (binding.status === 'PASS' && findings.length === 0) status = 'PASS';
  else if (status !== 'FAIL') status = 'EXTERNAL_REQUIRED';
}
const report = { generatedAt: new Date().toISOString(), status, findings, boundReleaseCommit: binding?.release?.commit || null, manifestHashVerified: Boolean(binding?.release?.manifestSha256 && fs.existsSync(manifestPath) && sha256(manifestPath) === binding.release.manifestSha256), evidenceHashVerified: Boolean(binding?.evidence?.liveReleaseEvidenceSha256 && fs.existsSync(evidencePath) && sha256(evidencePath) === binding.evidence.liveReleaseEvidenceSha256), rule: 'Any tamper or contradiction is a release-blocking FAIL. Missing externally supplied identifiers remain EXTERNAL_REQUIRED.' };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`external-evidence-binding-audit: ${status}`);
if (status === 'FAIL') process.exit(1);
