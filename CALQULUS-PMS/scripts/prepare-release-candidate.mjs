import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const outDir=path.join(root,'docs','audits');
fs.mkdirSync(outDir,{recursive:true});
const hashFile=(file)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel=(p)=>path.relative(root,p).replaceAll('\\','/');
const critical=[
 'package.json','package-lock.json','vite.config.ts','tsconfig.app.json','tsconfig.node.json',
 'supabase/config.toml',
 'src','supabase/functions','supabase/migrations','scripts'
];
const files=[];
for(const item of critical){
 const p=path.join(root,item); if(!fs.existsSync(p)) continue;
 const stat=fs.statSync(p);
 if(stat.isFile()) files.push(p);
 else {
  const walk=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const q=path.join(d,e.name);if(e.name==='node_modules'||e.name==='.git')continue;if(e.isDirectory())walk(q);else if(e.isFile())files.push(q);}};
  walk(p);
 }
}
files.sort();
const artifactManifest=files.map(p=>({path:rel(p),bytes:fs.statSync(p).size,sha256:hashFile(p)}));
let commit=''; try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}
let branch=''; try{branch=execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim();}catch{}
const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
const duplicateMap=new Map(); for(const f of migrations){const v=f.split('_')[0];const arr=duplicateMap.get(v)||[];arr.push(f);duplicateMap.set(v,arr);}
const duplicates=[...duplicateMap.entries()].filter(([,v])=>v.length>1).map(([version,files])=>({version,files}));
const releaseCommit=process.env.RELEASE_COMMIT_EXPECTED||commit||null;
const report={generatedAt:new Date().toISOString(),status:commit?'CANDIDATE_READY':'EXTERNAL_GIT_ID_REQUIRED',releaseCommit,gitBranch:branch||null,migrationCount:migrations.length,duplicateMigrationVersions:duplicates,artifactCount:artifactManifest.length,artifactManifest,externalPromotionGates:['clean git checkout on the candidate commit','live supabase_migrations.schema_migrations reconciliation','staging migration execution','staging smoke and restore evidence','production approval'],immutableRule:'Do not modify any artifact after this manifest is certified. Regenerate the manifest for every changed candidate.'};
fs.writeFileSync(path.join(outDir,'RELEASE_CANDIDATE_MANIFEST.json'),JSON.stringify(report,null,2)+'\n');
console.log(`release-candidate: ${report.status}`);
console.log(`- artifacts: ${artifactManifest.length}`);
console.log(`- migrations: ${migrations.length}`);
console.log(`- duplicate migration versions: ${duplicates.length}`);
