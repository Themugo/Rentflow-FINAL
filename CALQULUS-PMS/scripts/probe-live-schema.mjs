/**
 * Live schema probe (anon key).
 *
 * Compares PostgREST-exposed tables/RPCs on the linked project with the
 * migration files in this repo. This is not a dump of schema_migrations
 * (that table is not granted to anon); it is the live API surface.
 *
 * Usage:
 *   SUPABASE_URL=https://….supabase.co SUPABASE_ANON_KEY=eyJ… node scripts/probe-live-schema.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY (publishable).");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
};

const restRoot = await fetch(`${url}/rest/v1/`, { headers: { ...headers, Accept: "application/json" } });
const restHead = await fetch(`${url}/rest/v1/`, { method: "HEAD", headers });

let spec = { paths: {} };
const openApiRes = await fetch(`${url}/rest/v1/`, {
  headers: { ...headers, Accept: "application/openapi+json" },
});
if (openApiRes.ok) {
  spec = await openApiRes.json();
}
const livePaths = Object.keys(spec.paths || {});
const tableProbes = [];
for (const table of ["properties", "invoices", "leases", "tenants", "user_roles", "platform_admins"]) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, { headers });
  const raw = (await res.text()).slice(0, 180);
  tableProbes.push({
    table,
    status: res.status,
    body: raw.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>"),
  });
}
const liveTables = livePaths
  .filter((p) => p.startsWith("/") && !p.slice(1).includes("/"))
  .map((p) => p.slice(1))
  .filter((name) => name && name !== "rpc")
  .sort();
const liveRpcs = livePaths
  .filter((p) => p.startsWith("/rpc/"))
  .map((p) => p.slice("/rpc/".length))
  .sort();

const sql = readdirSync(join(process.cwd(), "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const sqlText = sql
  .map((name) => readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8"))
  .join("\n");
const repoTables = [
  ...new Set(
    [...sqlText.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)].map(
      (m) => m[1],
    ),
  ),
].sort();

const recentPrefixes = ["20260812", "20260819", "20260811", "20260803"];
const recentFiles = sql.filter((name) => recentPrefixes.some((p) => name.startsWith(p)));

const probeRpc = async (name, body) => {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { name, status: res.status, body: (await res.text()).slice(0, 180) };
};

const criticalRpcs = [
  { name: "get_manager_dashboard_stats", body: { p_manager_id: "00000000-0000-0000-0000-000000000000" } },
  { name: "get_landlord_portfolio_stats", body: {} },
  { name: "log_activity", body: { p_action: "phase12_probe", p_entity_type: "probe" } },
  { name: "validate_activation_token", body: { token_value: "phase12-probe" } },
  { name: "validate_invitation_token", body: { token_value: "phase12-probe" } },
];
const rpcProbes = [];
for (const item of criticalRpcs) {
  rpcProbes.push(await probeRpc(item.name, item.body));
}

const functionNames = [
  "health-check",
  "process-payment",
  "stripe-webhook",
  "send-tenant-invitation",
  "create-tenant-account",
];
const functionProbes = [];
for (const name of functionNames) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "GET",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  functionProbes.push({
    name,
    status: res.status,
    body: (await res.text()).slice(0, 160),
  });
}

const report = {
  project: url,
  generatedAt: new Date().toISOString(),
  note: "Anon-key live probe. 404 on /rpc/name means the function is not in the PostgREST schema cache. 401/400/403 means it exists. schema_migrations is not granted to anon.",
  restRoot: { json: restRoot.status, head: restHead.status, openApi: openApiRes.status },
  tableProbes,
  liveTables: liveTables.length,
  repoCreateTable: repoTables.length,
  liveRpcs: liveRpcs.length,
  recentMigrationFiles: recentFiles,
  missingFromLive: repoTables.filter((t) => !liveTables.includes(t)).slice(0, 80),
  liveNotInRepoCreate: liveTables.filter((t) => !repoTables.includes(t)).slice(0, 80),
  rpcProbes,
  functionProbes,
  healthCheckDeployed: functionProbes.find((f) => f.name === "health-check")?.status !== 404,
};

const outDir = join(process.cwd(), "docs", "audits");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "LIVE_SCHEMA_PROBE.json"), JSON.stringify(report, null, 2));

console.log(`REST root JSON=${restRoot.status} HEAD=${restHead.status} OpenAPI=${openApiRes.status}`);
console.log("Table probes (anon):");
for (const p of tableProbes) console.log(`  ${p.table} → HTTP ${p.status}`);
console.log(`Live tables (OpenAPI): ${liveTables.length}`);
console.log(`Repo CREATE TABLE: ${repoTables.length}`);
console.log(`Live RPCs: ${liveRpcs.length}`);
console.log("Recent migration files in repo:");
for (const f of recentFiles) console.log(`  ${f}`);
console.log("Critical RPC probes:");
for (const p of rpcProbes) console.log(`  ${p.name} → HTTP ${p.status}`);
console.log("Edge function probes:");
for (const p of functionProbes) console.log(`  ${p.name} → HTTP ${p.status}`);
console.log(`Wrote docs/audits/LIVE_SCHEMA_PROBE.json`);
if (!report.healthCheckDeployed) {
  console.log("health-check is NOT deployed (404).");
}
