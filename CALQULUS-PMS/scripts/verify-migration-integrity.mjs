import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=process.cwd();
const dir=path.join(root,'supabase','migrations');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
const manifestPath=path.join(root,'docs','audits','MIGRATION_FILE_INTEGRITY.json');
const databaseUrl=process.env.DATABASE_URL||process.env.SUPABASE_DB_URL;
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex');
const current=Object.fromEntries(files.map(f=>[f,sha(f)]));
let baseline={}; try{baseline=JSON.parse(fs.readFileSync(manifestPath,'utf8'));}catch{}
const baselineMap=baseline.files||{};
const changed=Object.keys(baselineMap).filter(f=>current[f]&&baselineMap[f]!==current[f]);
const removed=Object.keys(baselineMap).filter(f=>!current[f]);
const added=files.filter(f=>!Object.prototype.hasOwnProperty.call(baselineMap,f));
const report={generatedAt:new Date().toISOString(),status:'EXTERNAL_REQUIRED',migrationCount:files.length,changedSinceManifest:changed,removedSinceManifest:removed,newSinceManifest:added,live:null,note:'The committed migration manifest records immutable file hashes. Generate/update it only when the migration content is intentionally versioned.'};
if(!baseline.files){ report.manifestStatus='NOT_INITIALIZED'; }
else if(changed.length||removed.length){report.status='FAIL';}
else if(!databaseUrl){report.status='EXTERNAL_REQUIRED';}
if(databaseUrl){
 const sql=`select version || '_' || name || '.sql' as filename from supabase_migrations.schema_migrations order by version;`;
 const r=spawnSync('psql',['--no-psqlrc','--tuples-only','--csv',databaseUrl,'-c',sql],{encoding:'utf8'});
 if(r.status!==0){report.live={status:'BLOCKED',error:String(r.stderr||r.error||'psql failed').trim()};report.status='BLOCKED';}
 else {const applied=r.stdout.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>x.replace(/^"|"$/g,''));const expectedSet=new Set(files);const appliedSet=new Set(applied);report.live={status:(files.some(f=>!appliedSet.has(f))||applied.some(f=>!expectedSet.has(f)))?'FAIL':'PASS',appliedCount:applied.length,missing:files.filter(f=>!appliedSet.has(f)),unexpected:applied.filter(f=>!expectedSet.has(f))};if(report.live.status==='FAIL')report.status='FAIL';else if(!changed.length&&!removed.length)report.status='PASS';}
}
fs.mkdirSync(path.dirname(manifestPath),{recursive:true});
if(!baseline.files && !databaseUrl){fs.writeFileSync(manifestPath,JSON.stringify({generatedAt:new Date().toISOString(),files:current,note:'Generated automatically. Review in source control before accepting as the canonical migration integrity baseline.'},null,2)+'\n');report.manifestGenerated=true;}
fs.writeFileSync(path.join(root,'docs','audits','MIGRATION_INTEGRITY_REPORT.json'),JSON.stringify(report,null,2)+'\n');
console.log(`migration-integrity: ${report.status}`); if(report.status==='FAIL'||report.status==='BLOCKED')process.exit(1);
