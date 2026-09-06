import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'docs', 'audits', 'LIVE_STAGING_CERTIFICATION.json');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
  ['connectivity', 'audit:staging-connectivity'],
  ['bootstrap', 'audit:staging-bootstrap'],
  ['roleCertification', 'staging:certify'],
  ['smoke', 'staging:smoke'],
  ['migrationIntegrity', 'verify:migration-integrity'],
  ['schemaDrift', 'audit:schema-drift'],
  ['liveRls', 'audit:live-rls'],
  ['liveMigrations', 'reconcile:live-migrations'],
  ['liveSecurity', 'capture:live-security']
];
const baseUrl = (process.env.STAGING_BASE_URL || process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');
const report = { generatedAt: new Date().toISOString(), status: 'EXTERNAL_REQUIRED', baseUrl: baseUrl || null, checks: {}, credentialsRecorded: false };
fs.mkdirSync(path.dirname(out), { recursive: true });

for (const [name, script] of steps) {
  const r = spawnSync(npm, ['run', script], { cwd: root, env: process.env, encoding: 'utf8' });
  const output = `${r.stdout || ''}\n${r.stderr || ''}`;
  const status = r.status === 0 ? (output.includes('EXTERNAL_REQUIRED') ? 'EXTERNAL_REQUIRED' : 'PASS') : 'FAIL';
  report.checks[name] = { status };
  if (status === 'FAIL') report.checks[name].exitCode = r.status;
}
const statuses = Object.values(report.checks).map(v => v.status);
report.status = statuses.includes('FAIL') ? 'FAIL' : statuses.every(v => v === 'PASS') ? 'PASS' : 'EXTERNAL_REQUIRED';
report.decision = report.status === 'PASS'
  ? 'All configured live staging certification checks passed.'
  : report.status === 'FAIL'
    ? 'Live staging certification failed; do not promote.'
    : 'External staging/database evidence is still required; no pass is inferred.';
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`live-staging-certification: ${report.status}`);
if (report.status === 'FAIL') process.exit(1);
