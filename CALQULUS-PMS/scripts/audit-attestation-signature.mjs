import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const audits = path.join(root, 'docs', 'audits');
const input = path.join(audits, 'INDEPENDENT_RELEASE_ATTESTATION.json');
const out = path.join(audits, 'INDEPENDENT_ATTESTATION_SIGNATURE_AUDIT.json');
const read = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const a = read(input);
let status = 'EXTERNAL_REQUIRED';
const findings = [];
const canonical = a ? {
  attestationId: a.attestationId,
  attestor: a.attestor,
  attestedAt: a.attestedAt,
  scope: a.scope,
  evidenceSha256: a.evidenceSha256
} : null;
if (!a) findings.push('Independent attestation record is missing.');
const publicKey = process.env.INDEPENDENT_ATTESTATION_PUBLIC_KEY || a?.publicKey || '';
const signature = process.env.INDEPENDENT_ATTESTATION_SIGNATURE || a?.signature || '';
if (!publicKey || !signature) {
  findings.push('External Ed25519 public key and signature are required for independent attestation verification.');
} else if (!canonical?.attestationId || !canonical?.attestor || !canonical?.attestedAt || !canonical?.scope || !canonical?.evidenceSha256) {
  findings.push('Attestation is incomplete; signature cannot certify missing fields.');
} else {
  try {
    const key = crypto.createPublicKey(publicKey);
    const ok = crypto.verify(null, Buffer.from(JSON.stringify(canonical)), key, Buffer.from(signature, 'base64'));
    status = ok ? 'PASS' : 'FAIL';
    if (!ok) findings.push('Ed25519 signature verification failed.');
  } catch (e) {
    status = 'FAIL';
    findings.push(`Invalid attestation public key or signature: ${e.message}`);
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  status,
  algorithm: 'Ed25519',
  attestationPresent: !!a,
  signatureProvided: !!signature,
  publicKeyProvided: !!publicKey,
  canonicalFields: canonical ? Object.keys(canonical) : [],
  findings,
  rule: 'Independent release approval is cryptographically valid only when an external Ed25519 signature verifies the canonical attestation fields. Missing signature evidence remains EXTERNAL_REQUIRED; an invalid signature is a release-blocking FAIL.'
};
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`independent-attestation-signature-audit: ${status}`);
if (status === 'FAIL') process.exit(1);
