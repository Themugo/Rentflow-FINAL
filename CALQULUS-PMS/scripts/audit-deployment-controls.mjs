import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const required = [
  'supabase/config.toml',
  'supabase/migrations',
  'config/migration-history-policy.json',
  'scripts/audit-migration-chain.mjs',
  'scripts/audit-staging-readiness.mjs',
  'scripts/audit-disaster-recovery.mjs',
  'scripts/audit-release-readiness.mjs',
  'scripts/smoke-deploy.mjs',
];
const failures = [];
for (const item of required) if (!fs.existsSync(path.join(root, item))) failures.push(`Missing required release-control artifact: ${item}`);

const git = (() => {
  try { return execFileSync('git', ['status', '--porcelain'], {encoding:'utf8'}); }
  catch { return null; }
})();
const cleanWorkingTree = git === null ? null : git.trim() === '';
if (cleanWorkingTree === false) failures.push('Git working tree is not clean; release must be built from a committed state.');

const migrations = fs.readdirSync(path.join(root,'supabase','migrations')).filter(f=>f.endsWith('.sql'));
const config = fs.readFileSync(path.join(root,'supabase','config.toml'),'utf8');
const publicEndpoints = [...config.matchAll(/\[functions\.([^\]]+)\][\s\S]*?verify_jwt\s*=\s*false/g)].map(m=>m[1]);
const destructive = migrations.filter(f => /(?:drop\s+(?:table|column|policy|function)|truncate\s+|alter\s+table[^;]+drop\s+)/i.test(fs.readFileSync(path.join(root,'supabase','migrations',f),'utf8')));

const report = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? 'FAIL' : 'PASS',
  requiredArtifacts: required,
  migrationCount: migrations.length,
  destructiveMigrationCount: destructive.length,
  verifyJwtFalseFunctions: publicEndpoints,
  gitWorkingTreeClean: cleanWorkingTree,
  externalGates: ['live migration-history reconciliation','staging migration execution','staging smoke test','staging restore evidence','production promotion approval'],
  failures,
};
fs.writeFileSync(path.join(root,'docs','audits','DEPLOYMENT_CONTROL_CERTIFICATE.json'), JSON.stringify(report,null,2)+'\n');
console.log(`deployment-controls: ${report.status}`);
console.log(`- migrations: ${migrations.length}`);
console.log(`- destructive migration candidates: ${destructive.length}`);
console.log(`- verify_jwt=false functions: ${publicEndpoints.length}`);
if (cleanWorkingTree === null) console.log('- git: not available in packaged workspace (external clean-commit gate required)');
if (failures.length) { for (const f of failures) console.error(`FAIL ${f}`); process.exit(1); }
