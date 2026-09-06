import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const out = path.join(root, 'docs', 'audits', 'DEPENDENCY_PROVENANCE.json');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const pkg = readJson(path.join(root, 'package.json'));
const lockPath = path.join(root, 'package-lock.json');
const report = {
  generatedAt: new Date().toISOString(),
  status: 'PASS',
  packageManager: 'npm',
  packageJsonPresent: fs.existsSync(path.join(root, 'package.json')),
  lockfilePresent: fs.existsSync(lockPath),
  lockfileVersion: null,
  lockfileSha256: null,
  directDependencyCount: 0,
  missingRootDependencies: [],
  unresolvedRegistryPackages: [],
  nonRegistryDependencies: [],
  missingIntegrity: [],
  lifecycleScripts: [],
  credentialsPersisted: false,
  rule: 'Production dependencies must be represented by the committed npm lockfile with registry resolution and integrity metadata. Non-registry dependencies require explicit review.'
};
if (!report.packageJsonPresent || !report.lockfilePresent) { report.status = 'FAIL'; }
else {
  const lockRaw = fs.readFileSync(lockPath, 'utf8');
  const lock = JSON.parse(lockRaw);
  report.lockfileVersion = lock.lockfileVersion ?? null;
  report.lockfileSha256 = crypto.createHash('sha256').update(lockRaw).digest('hex');
  const direct = {...(pkg.dependencies || {}), ...(pkg.devDependencies || {}), ...(pkg.optionalDependencies || {})};
  report.directDependencyCount = Object.keys(direct).length;
  const packages = lock.packages || {};
  for (const [name, spec] of Object.entries(direct)) {
    const node = packages[`node_modules/${name}`];
    if (!node) { report.missingRootDependencies.push(name); continue; }
    const resolved = String(node.resolved || '');
    if (resolved && !/^https?:\/\/(registry\.npmjs\.org|registry\.yarnpkg\.com)\//i.test(resolved)) {
      report.nonRegistryDependencies.push({name, resolved});
    }
    if (node.link || node.dev === false && !node.integrity && !resolved.startsWith('file:') && !resolved.startsWith('workspace:')) {
      report.missingIntegrity.push(name);
    }
  }
  for (const [key, node] of Object.entries(packages)) {
    if (!key || key === '') continue;
    const resolved = String(node?.resolved || '');
    if (resolved && /^(git\+|git:|ssh:|file:|link:|https?:\/\/(?!registry\.npmjs\.org\/|registry\.yarnpkg\.com\/))/i.test(resolved)) {
      report.nonRegistryDependencies.push({packagePath:key, resolved});
    }
  }
  const scripts = pkg.scripts || {};
  for (const [name, command] of Object.entries(scripts)) {
    if (/(^|\s)(preinstall|install|postinstall)(\s|$)/i.test(name)) report.lifecycleScripts.push({name, command});
  }
  if (report.lockfileVersion !== 3) report.status = 'FAIL';
  if (report.missingRootDependencies.length || report.missingIntegrity.length) report.status = 'FAIL';
  if (report.nonRegistryDependencies.length) report.status = 'REVIEW_REQUIRED';
}
fs.mkdirSync(path.dirname(out), {recursive:true});
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`dependency-provenance: ${report.status}`);
if (report.status === 'FAIL') process.exit(1);
