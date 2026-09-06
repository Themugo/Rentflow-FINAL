/**
 * apply-pending-migrations.mjs
 *
 * Applies Phase 2 + 20260812 RLS migrations to the linked Supabase project.
 *
 * Usage:
 *   node scripts/apply-pending-migrations.mjs --dry-run
 *   npx supabase db push
 *
 * Requires the Supabase CLI, a linked project (supabase/config.toml project_id),
 * and database access (login or SUPABASE_DB_PASSWORD).
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv.includes("--dry-run");
const migrationsDir = join(process.cwd(), "supabase", "migrations");
const pendingPrefixes = [
  "20260812000000",
  "20260812000001",
  "20260812000002",
  "20260819000000",
  "20260819000001",
  "20260819000002",
  "20260819000003",
  "20260819000004",
  "20260819000005",
];

const files = readdirSync(migrationsDir)
  .filter((name) => pendingPrefixes.some((p) => name.startsWith(p)))
  .sort();

console.log("Pending CALQULUS PMS migrations to confirm on live DB:");
for (const file of files) {
  console.log(`  - ${file}`);
}

if (dryRun) {
  console.log("\nDry run only. Apply with: npx supabase db push");
  process.exit(0);
}

if (!existsSync(join(process.cwd(), "supabase", "config.toml"))) {
  console.error("supabase/config.toml missing");
  process.exit(1);
}

try {
  execSync("npx supabase db push", { stdio: "inherit" });
} catch {
  console.error("\nCould not push via CLI. Apply the SQL files above in the Supabase SQL editor.");
  process.exit(1);
}
