import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['production', 'npm', ['run', 'audit:prod']],
  ['security-boundary', 'npm', ['run', 'audit:security-boundary']],
  ['cross-role', 'npm', ['run', 'audit:cross-role']],
  ['final-security', 'npm', ['run', 'audit:final-security']],
  ['migration-chain', 'npm', ['run', 'audit:migration-chain']],
];
const results = [];
for (const [name, cmd, args] of checks) {
  try {
    execFileSync(cmd, args, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', output: String(error.stdout || error.stderr || '').slice(-1500) });
  }
}
const planPath = path.join(root, 'docs', 'audits', 'MIGRATION_REPAIR_PLAN.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const externalGates = [
  'Live Supabase migration history reconciled against MIGRATION_REPAIR_PLAN.json',
  'Clean staging migration applied successfully',
  'Staging role-isolation smoke test completed',
  'Production deployment smoke test completed against the real URL',
];
const report = {
  generatedAt: new Date().toISOString(),
  repositoryCertification: results,
  migrationHistory: { status: plan.status, duplicateGroups: plan.duplicateGroups.length },
  externalGates,
  releaseDecision: results.every(r => r.status === 'PASS') ? 'REPO_CERTIFIED_EXTERNAL_PROOF_REQUIRED' : 'BLOCKED',
};
const out = path.join(root, 'docs', 'audits', 'RELEASE_SECURITY_CERTIFICATE.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
for (const result of results) console.log(`${result.status} ${result.name}`);
console.log(`RELEASE DECISION: ${report.releaseDecision}`);
if (report.releaseDecision === 'BLOCKED') process.exit(1);
