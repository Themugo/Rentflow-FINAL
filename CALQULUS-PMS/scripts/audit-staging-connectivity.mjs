import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'docs', 'audits', 'STAGING_CONNECTIVITY.json');
const url = (process.env.STAGING_BASE_URL || process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');
const supabaseUrl = (process.env.STAGING_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.STAGING_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const started = Date.now();
const report = { generatedAt: new Date().toISOString(), status: 'EXTERNAL_REQUIRED', checks: [], secretsExposed: false };
const add = (name, status, details = {}) => report.checks.push({ name, status, ...details });

if (!url && !supabaseUrl) {
  report.reason = 'STAGING_BASE_URL/SMOKE_BASE_URL or STAGING_SUPABASE_URL is required.';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log('staging-connectivity: EXTERNAL_REQUIRED');
  process.exit(0);
}

try {
  if (url) {
    const res = await fetch(url, { redirect: 'manual' });
    add('application-root', res.ok || res.status >= 300 && res.status < 400 ? 'PASS' : 'FAIL', { statusCode: res.status, latencyMs: Date.now() - started });
  }
  if (supabaseUrl) {
    const t = Date.now();
    const res = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: key || '', Accept: 'application/json' } });
    add('supabase-rest', res.status < 500 ? 'PASS' : 'FAIL', { statusCode: res.status, latencyMs: Date.now() - t });
    const health = await fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: key || '' } });
    add('supabase-auth', health.status < 500 ? 'PASS' : 'FAIL', { statusCode: health.status });
  }
  report.status = report.checks.every(x => x.status === 'PASS') ? 'PASS' : 'FAIL';
} catch (error) {
  report.status = 'BLOCKED';
  report.error = String(error?.message || error).slice(0, 300);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`staging-connectivity: ${report.status}`);
if (report.status === 'FAIL' || report.status === 'BLOCKED') process.exit(1);
