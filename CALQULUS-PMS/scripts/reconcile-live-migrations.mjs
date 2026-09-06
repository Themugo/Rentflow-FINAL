import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const migrationsDir = path.join(root,'supabase','migrations');
const expected = fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort();
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const outputPath = path.join(root,'docs','audits','LIVE_MIGRATION_RECONCILIATION.json');

if (!databaseUrl) {
  const report = {generatedAt:new Date().toISOString(),status:'EXTERNAL_REQUIRED',expectedMigrationCount:expected.length,appliedMigrationCount:null,missingMigrations:null,unexpectedAppliedMigrations:null,note:'Set DATABASE_URL or SUPABASE_DB_URL and rerun this command against the target Supabase database.'};
  fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
  console.log('live-migration-reconciliation: EXTERNAL_REQUIRED');
  process.exit(0);
}

const sql = `select version || '_' || name || '.sql' as filename from supabase_migrations.schema_migrations order by version;`;
const result = spawnSync('psql',['--no-psqlrc','--tuples-only','--csv',databaseUrl,'-c',sql],{encoding:'utf8'});
if (result.error || result.status !== 0) {
  const detail = String(result.stderr || result.error || 'psql failed').trim();
  const report = {generatedAt:new Date().toISOString(),status:'BLOCKED',expectedMigrationCount:expected.length,error:detail};
  fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
  console.error('live-migration-reconciliation: BLOCKED'); console.error(detail); process.exit(1);
}

const applied = result.stdout.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>s.replace(/^"|"$/g,''));
const expectedVersions = new Set(expected.map(f=>f.replace(/\.sql$/,'')));
const appliedNames = new Set(applied.map(f=>f.replace(/\.sql$/,'')));
const missing = expected.filter(f=>!appliedNames.has(f.replace(/\.sql$/,'')));
const unexpected = applied.filter(f=>!expectedVersions.has(f));
const report = {generatedAt:new Date().toISOString(),status:(missing.length||unexpected.length)?'FAIL':'PASS',expectedMigrationCount:expected.length,appliedMigrationCount:applied.length,missingMigrations:missing,unexpectedAppliedMigrations:unexpected};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(`live-migration-reconciliation: ${report.status}`);
console.log(`- expected: ${expected.length}`); console.log(`- applied: ${applied.length}`); console.log(`- missing: ${missing.length}`); console.log(`- unexpected: ${unexpected.length}`);
if (missing.length || unexpected.length) process.exit(1);
