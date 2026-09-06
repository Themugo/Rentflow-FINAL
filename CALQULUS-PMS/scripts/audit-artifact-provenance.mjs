import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const out=path.join(root,'docs','audits','RELEASE_ARTIFACT_PROVENANCE.json');
const manifestPath=path.join(root,'docs','audits','DEPLOYMENT_EXECUTION_EVIDENCE.json');
const read=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return {};}};
const manifest=read(manifestPath);
let current=process.env.RELEASE_COMMIT||'';
if(!current){try{current=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}}
const entries=Array.isArray(manifest.artifactManifest)?manifest.artifactManifest:[];
const mismatches=[];
for(const e of entries){const p=path.join(root,e.path);if(!fs.existsSync(p)){mismatches.push({path:e.path,reason:'missing'});continue;}const b=fs.readFileSync(p);const h=crypto.createHash('sha256').update(b).digest('hex');if(h!==e.sha256||b.length!==e.bytes)mismatches.push({path:e.path,reason:'hash-or-size-mismatch'});}
const expected=process.env.RELEASE_COMMIT_EXPECTED||'';
const report={generatedAt:new Date().toISOString(),status:'PASS',currentReleaseCommit:current||null,expectedReleaseCommit:expected||null,manifestPresent:fs.existsSync(manifestPath),artifactCount:entries.length,artifactMismatches:mismatches,immutableIdentityRule:'A release is immutable only when the recorded release commit and artifact SHA-256 manifest match the candidate being promoted.',requiredExternalEvidence:expected?['RELEASE_COMMIT_EXPECTED match']:[],note:'This is a provenance check, not a digital signature. Promotion must use the exact reviewed commit/artifact set.'};
if(!report.manifestPresent||!entries.length||mismatches.length||(expected&&current!==expected)) report.status='BLOCKED';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`artifact-provenance: ${report.status}`);if(report.status!=='PASS')process.exit(1);
