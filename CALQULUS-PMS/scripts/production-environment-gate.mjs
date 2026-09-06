/** Fail-closed production environment/configuration gate. */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'docs', 'audits');
mkdirSync(outDir, { recursive: true });
const envPath = join(root, '.env.local');
const configPath = join(root, 'supabase', 'config.toml');
const config = readFileSync(configPath, 'utf8');
const projectRef = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] ?? '';

const env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const value = (name) => process.env[name]?.trim() || env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '') || '';
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
const checks = required.map((name) => ({ name, present: Boolean(value(name)) }));
const url = value('VITE_SUPABASE_URL');
const urlProjectRef = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i)?.[1] || '';
const productionFlags = ['VITE_ENABLE_PUBLIC_DEMO', 'VITE_ENABLE_DEMO_SEED', 'VITE_ENABLE_DEV_ACCESS']
  .map((name) => ({ name, value: value(name) || 'false', safe: !['true', '1', 'yes'].includes((value(name) || 'false').toLowerCase()) }));

const report = {
  generatedAt: new Date().toISOString(),
  status: checks.every((c) => c.present) && projectRef && (!urlProjectRef || urlProjectRef === projectRef) && productionFlags.every((f) => f.safe) ? 'PASS' : 'FAIL',
  projectRef,
  urlProjectRef,
  required: checks,
  productionFlags,
  note: 'Secrets are never written to the evidence file.',
};
writeFileSync(join(outDir, 'PRODUCTION_ENVIRONMENT_GATE.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`production-environment-gate: ${report.status}`);
console.log(`- project ref: ${projectRef || 'MISSING'}`);
console.log(`- Supabase URL ref: ${urlProjectRef || 'MISSING'}`);
for (const c of checks) console.log(`- ${c.name}: ${c.present ? 'set' : 'MISSING'}`);
if (report.status !== 'PASS') process.exit(1);
