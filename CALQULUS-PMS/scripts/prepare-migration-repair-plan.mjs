import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'supabase', 'migrations');
const out = path.join(root, 'docs', 'audits', 'MIGRATION_REPAIR_PLAN.json');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const groups = new Map();
for (const file of files) {
  const m = file.match(/^(\d+)([a-z])?_(.+\.sql)$/);
  if (!m) continue;
  const [, version, suffix = '', rest] = m;
  if (!groups.has(version)) groups.set(version, []);
  groups.get(version).push({ file, suffix, rest });
}
const duplicates = [...groups.entries()].filter(([, items]) => items.length > 1);
const numericVersions = files.map(f => f.match(/^(\d+)_/)?.[1]).filter(Boolean).map(BigInt);
const maxVersion = numericVersions.length ? numericVersions.reduce((a,b) => a > b ? a : b) : 0n;
const plan = {
  generatedAt: new Date().toISOString(),
  status: duplicates.length ? 'REQUIRES_LIVE_HISTORY_RECONCILIATION' : 'CLEAN',
  maxRepositoryVersion: maxVersion.toString(),
  duplicateGroups: duplicates.map(([version, items]) => ({
    version,
    files: items.map(i => i.file),
    proposedRepair: 'DO_NOT_RENAME_UNTIL_LIVE_SCHEMA_MIGRATIONS_IS_CONFIRMED',
    reason: 'Supabase migration versions are part of deployment history; renaming an applied migration can create drift.'
  })),
  operatorSteps: [
    'Export the live supabase_migrations.schema_migrations version list from the target project.',
    'Compare applied versions with this repository duplicate groups.',
    'If a duplicate file is unapplied, assign it a new monotonic timestamp greater than the current live maximum and preserve its SQL body.',
    'If both files are already applied, preserve repository history and document the live ordering instead of renaming retroactively.',
    'Run npm run audit:migration-chain after reconciliation.'
  ]
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(plan, null, 2) + '\n');
console.log(`migration-repair-plan: wrote ${path.relative(root, out)}`);
console.log(`migration-repair-plan: ${duplicates.length} duplicate groups require live reconciliation`);
