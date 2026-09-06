import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const listFilesRecursive = (dir, predicate) =>
  readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      const stats = statSync(path);
      if (stats.isDirectory()) return listFilesRecursive(path, predicate);
      return stats.isFile() && predicate(path) ? [path] : [];
    });

const requiredFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/e2e.yml",
  ".github/workflows/deploy-smoke.yml",
  "PRODUCTION_CHECKLIST.md",
  "docs/STAGING_SMOKE_TEST.md",
  "config/production-env.json",
  "scripts/audit-production.mjs",
  "scripts/smoke-deploy.mjs",
  "supabase/migrations/20260518000000_production_rls_hardening.sql",
  "vercel.json",
];

const packageJson = readJson(join(root, "package.json"));
const envManifest = readJson(join(root, "config", "production-env.json"));
const config = readFileSync(join(root, "supabase", "config.toml"), "utf8");
const migrationFiles = listFilesRecursive(join(root, "supabase", "migrations"), (path) => path.endsWith(".sql"));
const functionNames = readdirSync(join(root, "supabase", "functions"))
  .map((name) => join(root, "supabase", "functions", name))
  .filter((path) => statSync(path).isDirectory())
  .filter((path) => {
    const name = path.split(/[\\/]/).pop();
    return name !== "_shared" && !name.endsWith(".bak");
  })
  .filter((path) => existsSync(join(path, "index.ts")))
  .map((path) => path.split(/[\\/]/).pop())
  .sort();
const configuredFunctions = [...config.matchAll(/\[functions\.([^\]]+)\]/g)].map((match) => match[1]);

const checks = [
  {
    name: "CI workflow",
    passed: existsSync(join(root, ".github", "workflows", "ci.yml")),
    detail: "Pull requests and main branch pushes run npm run verify.",
  },
  {
    name: "Deployment smoke workflow",
    passed: existsSync(join(root, ".github", "workflows", "deploy-smoke.yml")),
    detail: "Manual live URL smoke test is available after deploy.",
  },
  {
    name: "Browser E2E workflow",
    passed: existsSync(join(root, ".github", "workflows", "e2e.yml")) && Boolean(packageJson.scripts?.["test:e2e:ci"]),
    detail: "Scheduled/manual Playwright Chromium smoke covers public pages and optional real-role auth.",
  },
  {
    name: "Production audit",
    passed: Boolean(packageJson.scripts?.["audit:prod"] && packageJson.scripts?.verify?.includes("audit:prod")),
    detail: "npm run verify includes the custom production audit.",
  },
  {
    name: "Live smoke command",
    passed: Boolean(packageJson.scripts?.["smoke:deploy"]),
    detail: "SMOKE_BASE_URL=https://domain npm run smoke:deploy checks the deployed SPA.",
  },
  {
    name: "Environment manifest",
    passed: envManifest.frontend.required.length > 0 && envManifest.supabase.requiredSecrets.length > 0,
    detail: `${envManifest.frontend.required.length} frontend required vars and ${envManifest.supabase.requiredSecrets.length + envManifest.supabase.paymentProviderSecrets.length} Supabase secrets documented.`,
  },
  {
    name: "Supabase function config",
    passed: configuredFunctions.length === functionNames.length,
    detail: `${configuredFunctions.length}/${functionNames.length} deployable Edge Functions have explicit config.toml entries.`,
  },
  {
    name: "RLS hardening migration",
    passed: existsSync(join(root, "supabase", "migrations", "20260518000000_production_rls_hardening.sql")),
    detail: "Critical production tables have an added RLS and policy hardening migration.",
  },
  {
    name: "Release documentation",
    passed: existsSync(join(root, "PRODUCTION_CHECKLIST.md")) && existsSync(join(root, "docs", "STAGING_SMOKE_TEST.md")),
    detail: "Production checklist and staging smoke test script are present.",
  },
  {
    name: "Host configs",
    passed: existsSync(join(root, "vercel.json")),
    detail: "Vercel SPA rewrites and security headers are tracked. Production is Vercel, not Netlify.",
  },
];

const missingFiles = requiredFiles.filter((file) => !existsSync(join(root, file)));
const passed = checks.filter((check) => check.passed).length;

console.log("CALQULUS PMS release readiness report");
console.log(`- Scorecard: ${passed}/${checks.length} repo readiness gates present`);
console.log(`- Migrations: ${migrationFiles.length}`);
console.log(`- Deployable Edge Functions: ${functionNames.length}`);
console.log("");

for (const check of checks) {
  console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
  console.log(`  ${check.detail}`);
}

if (missingFiles.length > 0) {
  console.error("\nMissing release files:");
  for (const file of missingFiles) console.error(`- ${file}`);
  process.exit(1);
}

console.log("\nNext proof required outside the repo:");
console.log("- Apply migrations to a clean Supabase staging project.");
console.log("- Set frontend and Supabase secrets from config/production-env.json.");
console.log("- Run npm run smoke:deploy against the deployed staging URL.");
console.log("- Complete docs/STAGING_SMOKE_TEST.md with real role accounts.");
