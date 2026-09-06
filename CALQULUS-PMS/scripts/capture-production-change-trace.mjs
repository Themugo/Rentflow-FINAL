import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root,'docs','audits','PRODUCTION_CHANGE_TRACE.json');
const env = k => String(process.env[k] || '').trim();
const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let releaseCommit = env('RELEASE_COMMIT');
try { if (!releaseCommit) releaseCommit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(); } catch {}
const migrationsDir = path.join(root,'supabase','migrations');
const migrations = fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort().map(name => {
  const p=path.join(migrationsDir,name); const b=fs.readFileSync(p); return {name,bytes:b.length,sha256:sha256(p)};
}) : [];
const artifacts = ['package.json','package-lock.json','vite.config.ts','supabase/config.toml'].filter(f=>fs.existsSync(path.join(root,f))).map(file=>({path:file,bytes:fs.statSync(path.join(root,file)).size,sha256:sha256(path.join(root,file))}));
const trace = {
  generatedAt:new Date().toISOString(),
  status: releaseCommit && migrations.length ? 'PASS' : 'EXTERNAL_REQUIRED',
  releaseCommit: releaseCommit || null,
  deploymentId: env('DEPLOYMENT_ID') || null,
  deploymentTarget: env('DEPLOYMENT_TARGET') || null,
  migrationRunId: env('MIGRATION_RUN_ID') || null,
  migrationAppliedAt: env('MIGRATION_APPLIED_AT') || null,
  migrationOperator: env('MIGRATION_OPERATOR') || null,
  releaseOperator: env('RELEASE_AUTHORIZED_BY') || null,
  authorizationId: env('RELEASE_AUTHORIZATION_ID') || null,
  migrations,
  deploymentArtifacts:artifacts,
  secretFieldsPersisted:false,
  rule:'This trace records hashes and execution identifiers, not credentials. Production execution fields remain null until supplied by the deployment environment.'
};
fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(trace,null,2)+'\n');
console.log(`production-change-trace: ${trace.status}`);
