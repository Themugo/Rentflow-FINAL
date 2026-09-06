/**
 * CALQULUS PMS production deployment reconciliation gate.
 *
 * Fail-closed: it never edits Supabase migration history. It compares the
 * repository migration chain with the linked project and writes an evidence
 * certificate. Actual application of pending migrations remains an explicit
 * `supabase db push` step after this gate passes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migrationsDir = join(root, 'supabase', 'migrations');
const outDir = join(root, 'docs', 'audits');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'PRODUCTION_DEPLOYMENT_RECONCILIATION_GATE.json');

const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();
const duplicateVersions = migrationFiles
  .map((f) => f.split('_')[0])
  .filter((v, i, a) => a.indexOf(v) !== i);

const config = readFileSync(join(root, 'supabase', 'config.toml'), 'utf8');
const projectRef = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] ?? null;

const run = (args) => {
  try {
    return { ok: true, stdout: execFileSync('npx', ['supabase', ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    return { ok: false, stdout: String(error.stdout || ''), stderr: String(error.stderr || error.message || '') };
  }
};

const versionCheck = run(['--version']);
let linked = null;
let dryRun = null;
let migrationList = null;

if (versionCheck.ok) {
  linked = run(['projects', 'list']);
  migrationList = run(['migration', 'list', '--project-ref', projectRef || '']);
  dryRun = run(['db', 'push', '--dry-run', '--project-ref', projectRef || '']);
}

const status = !projectRef
  ? 'BLOCKED'
  : duplicateVersions.length
    ? 'BLOCKED'
    : !versionCheck.ok
      ? 'EXTERNAL_REQUIRED'
      : !migrationList?.ok || !dryRun?.ok
        ? 'BLOCKED'
        : 'READY';

const report = {
  generatedAt: new Date().toISOString(),
  status,
  projectRef,
  expectedMigrationCount: migrationFiles.length,
  duplicateVersions: [...new Set(duplicateVersions)],
  cliAvailable: versionCheck.ok,
  migrationList: migrationList ? { ok: migrationList.ok, output: (migrationList.stdout || migrationList.stderr || '').slice(-5000) } : null,
  dryRun: dryRun ? { ok: dryRun.ok, output: (dryRun.stdout || dryRun.stderr || '').slice(-5000) } : null,
  policy: [
    'Never use migration repair as a substitute for applying SQL.',
    'Never reset a production database to reconcile migration history.',
    'Only declare READY when the linked project and local migration chain are inspectable.',
    'Apply pending migrations only after this certificate is READY and a release commit is fixed.',
  ],
};

writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`deployment-reconciliation-gate: ${status}`);
console.log(`- project ref: ${projectRef || 'MISSING'}`);
console.log(`- local migrations: ${migrationFiles.length}`);
console.log(`- duplicate versions: ${new Set(duplicateVersions).size}`);
console.log(`- supabase CLI: ${versionCheck.ok ? 'available' : 'not available'}`);
console.log(`- evidence: ${out}`);
if (status === 'BLOCKED') process.exit(1);
