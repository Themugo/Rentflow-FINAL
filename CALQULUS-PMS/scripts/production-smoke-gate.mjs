/**
 * Production smoke gate for the deployed frontend and live Supabase API.
 * Requires SMOKE_BASE_URL, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
 */
const baseUrl = process.env.SMOKE_BASE_URL?.replace(/\/$/, '');
const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
if (!baseUrl || !supabaseUrl || !anonKey) {
  console.error('production-smoke-gate: BLOCKED — set SMOKE_BASE_URL, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const failures = [];
const get = async (url, headers = {}) => fetch(url, { redirect: 'follow', headers });
const routes = ['/', '/legal', '/pricing', '/auth', '/health'];
for (const route of routes) {
  const response = await get(`${baseUrl}${route}`);
  const body = await response.text();
  if (!response.ok) failures.push(`${route}: HTTP ${response.status}`);
  if (!body.includes('id="root"')) failures.push(`${route}: SPA root missing`);
}

const root = await get(baseUrl);
for (const header of ['content-security-policy', 'x-content-type-options', 'referrer-policy']) {
  if (!root.headers.get(header)) failures.push(`frontend: missing ${header}`);
}

const apiHeaders = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
const openApi = await get(`${supabaseUrl}/rest/v1/`, { ...apiHeaders, Accept: 'application/openapi+json' });
if (!openApi.ok) failures.push(`supabase REST root: HTTP ${openApi.status}`);
else {
  const spec = await openApi.json();
  const paths = Object.keys(spec.paths || {});
  for (const required of ['/properties', '/invoices', '/leases', '/tenants']) {
    if (!paths.includes(required)) failures.push(`supabase schema: missing ${required}`);
  }
}

console.log(`production-smoke-gate: ${failures.length ? 'FAIL' : 'PASS'}`);
for (const failure of failures) console.log(`- ${failure}`);
if (failures.length) process.exit(1);
