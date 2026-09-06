import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const audits = path.join(root, 'docs', 'audits');
const ledgerPath = path.join(audits, 'RELEASE_EVIDENCE_INTEGRITY.json');
const out = path.join(audits, 'RELEASE_EVIDENCE_INTEGRITY_AUDIT.json');
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const ledger = read(ledgerPath);
let status = 'PASS';
const findings = [];
if (!ledger) { status = 'EXTERNAL_REQUIRED'; findings.push('Integrity ledger is not present.'); }
else {
  for (const entry of ledger.entries || []) {
    const p = path.join(audits, entry.file);
    if (!fs.existsSync(p)) { status = 'FAIL'; findings.push(`Missing evidence file: ${entry.file}`); continue; }
    const actual = sha256(p);
    if (actual !== entry.sha256) { status = 'FAIL'; findings.push(`Hash mismatch: ${entry.file}`); }
    const bytes = fs.statSync(p).size;
    if (bytes !== entry.bytes) { status = 'FAIL'; findings.push(`Byte-count mismatch: ${entry.file}`); }
  }
  const canonical = (ledger.entries || []).map(e => `${e.file}|${e.sha256}|${e.bytes}`).join('\n');
  const actualChain = crypto.createHash('sha256').update(canonical).digest('hex');
  if (actualChain !== ledger.chainHash) { status = 'FAIL'; findings.push('Ledger chain hash mismatch.'); }
  if (ledger.status === 'EXTERNAL_REQUIRED' && status === 'PASS') status = 'EXTERNAL_REQUIRED';
}
const report = { generatedAt: new Date().toISOString(), status, ledgerPresent: Boolean(ledger), findings, rule: 'Any recorded evidence mutation is a release-blocking FAIL. Missing externally generated evidence remains EXTERNAL_REQUIRED.' };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`release-evidence-integrity-audit: ${status}`);
if (status === 'FAIL') process.exit(1);
