import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'docs', 'audits', 'RUNTIME_DEPENDENCY_GOVERNANCE.json');
const policyPath = path.join(root, 'docs', 'security', 'RUNTIME_DEPENDENCY_POLICY.md');
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');
const now = new Date().toISOString();

const report = {
  generatedAt: now,
  status: 'PASS',
  policyPresent: fs.existsSync(policyPath),
  packageJsonPresent: fs.existsSync(pkgPath),
  lockfilePresent: fs.existsSync(lockPath),
  lockfileVersion: null,
  packageJsonSha256: null,
  lockfileSha256: null,
  directDependencyCount: 0,
  missingLockedDependencies: [],
  specVersionMismatches: [],
  gitOrFileDependencies: [],
  lifecycleScripts: [],
  outdated: { status: 'EXTERNAL_REQUIRED', packages: [], reason: 'Network-backed npm registry query is not authoritative in an offline packaged workspace.' },
  vulnerabilityGate: 'CI_REQUIRED',
  rules: {
    lockfile: 'npm lockfileVersion 3 is required and every direct dependency must have a matching lock entry.',
    registry: 'Git/file/link dependencies require explicit review and are never silently accepted as runtime dependencies.',
    lifecycle: 'Install lifecycle scripts require review because they execute code during dependency installation.',
    updates: 'Major runtime updates require review before promotion; minor/patch updates should be refreshed routinely.',
    vulnerabilities: 'High/critical npm audit findings must block CI unless formally remediated or waived with owner and expiry.'
  }
};

function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function isRegistry(url) { return /^https?:\/\/(registry\.npmjs\.org|registry\.yarnpkg\.com)\//i.test(url); }
function majorOf(spec) {
  const m = String(spec).match(/(?:\^|~|>=|>|=)?(\d+)/);
  return m ? Number(m[1]) : null;
}
function versionTuple(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? m.slice(1).map(Number) : null;
}
function satisfiesSimpleRange(spec, version) {
  const v = versionTuple(version); if (!v) return false;
  const raw = String(spec).trim();
  if (/^\d+\.\d+\.\d+$/.test(raw)) return raw === version;
  const m = raw.match(/^([~^]?)(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return true;
  const op=m[1], base=[Number(m[2]),Number(m[3]),Number(m[4]||0)];
  if (op==='~') return v[0]===base[0] && v[1]===base[1] && v[2]>=base[2];
  if (op==='^') {
    if (base[0]>0) return v[0]===base[0] && (v[1]>base[1] || (v[1]===base[1] && v[2]>=base[2]));
    if (base[1]>0) return v[0]===0 && v[1]===base[1] && v[2]>=base[2];
    return v[0]===0 && v[1]===0 && v[2]===base[2];
  }
  if (!op && m[4]===undefined) return v[0]===base[0] && v[1]===base[1];
  return v[0]===base[0] && v[1]===base[1] && v[2]>=base[2];
}

if (!report.packageJsonPresent || !report.lockfilePresent || !report.policyPresent) {
  report.status = 'FAIL';
} else {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const lockRaw = fs.readFileSync(lockPath, 'utf8');
  const lock = JSON.parse(lockRaw);
  report.lockfileVersion = lock.lockfileVersion ?? null;
  report.packageJsonSha256 = sha256(pkgPath);
  report.lockfileSha256 = crypto.createHash('sha256').update(lockRaw).digest('hex');
  const direct = {...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {})};
  report.directDependencyCount = Object.keys(direct).length;
  const packages = lock.packages || {};

  for (const [name, spec] of Object.entries(direct)) {
    const node = packages[`node_modules/${name}`];
    if (!node) {
      report.missingLockedDependencies.push(name);
      continue;
    }
    const resolved = String(node.resolved || '');
    if (resolved && !isRegistry(resolved)) report.gitOrFileDependencies.push({name, resolved});
    if (node.version && !satisfiesSimpleRange(spec, node.version)) {
      report.specVersionMismatches.push({name, spec, lockedVersion: node.version});
    }
  }

  for (const [name, command] of Object.entries(pkg.scripts || {})) {
    if (/^(pre|post)?install$/i.test(name)) report.lifecycleScripts.push({name, command});
  }

  if (report.lockfileVersion !== 3 || report.missingLockedDependencies.length || report.specVersionMismatches.length) report.status = 'FAIL';
  else if (report.gitOrFileDependencies.length) report.status = 'REVIEW_REQUIRED';

  // Only perform registry-backed npm outdated when explicitly requested or in CI.
  if (process.env.RUN_NETWORK_AUDITS === 'true') {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const r = spawnSync(npm, ['outdated', '--json'], {encoding:'utf8', timeout: 30000, cwd: root});
    if (r.status === 0 || r.status === 1) {
      try {
        const data = r.stdout ? JSON.parse(r.stdout) : {};
        report.outdated = {status:'PASS', packages:Object.entries(data).map(([name, info]) => ({name, current:info.current, wanted:info.wanted, latest:info.latest, major:info.major, minor:info.minor, patch:info.patch}))};
      } catch {
        report.outdated = {status:'EXTERNAL_REQUIRED', packages:[], reason:'npm outdated returned non-JSON output.'};
      }
    } else {
      report.outdated = {status:'EXTERNAL_REQUIRED', packages:[], reason:(r.error?.message || r.stderr || 'Registry query unavailable').trim()};
    }
  }
}

fs.mkdirSync(path.dirname(out), {recursive:true});
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`runtime-dependency-governance: ${report.status} (outdated=${report.outdated.status})`);
if (report.status === 'FAIL') process.exit(1);
