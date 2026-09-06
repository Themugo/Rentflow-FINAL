import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'supabase', 'migrations');
const policyPath = path.join(root, 'config', 'migration-history-policy.json');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const versionMap = new Map();
for (const file of files) {
  const m = file.match(/^(\d+)(?:[a-z])?_/);
  if (!m) continue;
  const version = m[1];
  if (!versionMap.has(version)) versionMap.set(version, []);
  versionMap.get(version).push(file);
}
const duplicateVersions = [...versionMap.entries()].filter(([, names]) => names.length > 1);
const malformed = files.filter(f => !/^\d+_[^/]+\.sql$/.test(f));
const known = new Set(policy.knownDuplicateVersions);
const unexpectedDuplicates = duplicateVersions.filter(([version]) => !known.has(version));
const knownMissing = policy.knownDuplicateVersions.filter(v => !versionMap.has(v));
const failures = [];
if (unexpectedDuplicates.length) {
  for (const [version, names] of unexpectedDuplicates) failures.push(`New duplicate migration version ${version}: ${names.join(' | ')}`);
}
if (knownMissing.length) failures.push(`Policy lists duplicate version(s) no longer present: ${knownMissing.join(', ')}`);
const unexpectedMalformed = malformed.filter(f => !policy.knownMalformedVersions.some(v => f.startsWith(`${v}_`)));
if (unexpectedMalformed.length) failures.push(`Unexpected malformed migration filename(s): ${unexpectedMalformed.join(', ')}`);

const phaseEntries = files.map(file => {
  const v = file.match(/^(\d+)_/)?.[1];
  const p = file.match(/phase(\d+)(?:[-_](\d+))?/i);
  return v && p ? { file, version: BigInt(v), phase: Number(p[1]) } : null;
}).filter(Boolean);
const orderingWarnings = [];
for (let i = 1; i < phaseEntries.length; i++) {
  const a = phaseEntries[i - 1], b = phaseEntries[i];
  if (b.phase > a.phase && b.version < a.version) orderingWarnings.push(`${b.file} has migration version ${b.version} earlier than ${a.file} (${a.version})`);
}
console.log(`migration-chain-audit: ${files.length} SQL migrations inspected`);
console.log(`- Known historical duplicate versions: ${duplicateVersions.filter(([v]) => known.has(v)).length}`);
console.log(`- Unexpected duplicate versions: ${unexpectedDuplicates.length}`);
console.log(`- Known historical malformed filenames: ${malformed.length - unexpectedMalformed.length}`);
console.log(`- Ordering warnings: ${orderingWarnings.length}`);
if (orderingWarnings.length) for (const w of orderingWarnings) console.warn(`  WARNING ${w}`);
if (policy.liveReconciliationRequired) console.warn('migration-chain-audit: LIVE_RECONCILIATION_REQUIRED — verify supabase_migrations.schema_migrations before deployment');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('migration-chain-audit: PASS (historical exceptions acknowledged; no new chain violations)');
