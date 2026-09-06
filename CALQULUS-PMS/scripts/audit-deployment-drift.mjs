import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const out=path.join(root,'docs','audits','DEPLOYMENT_DRIFT.json');
const manifestPath=path.join(root,'docs','audits','DEPLOYMENT_EXECUTION_EVIDENCE.json');
const read=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return {};}};
const manifest=read(manifestPath);
let currentCommit='';
try{currentCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}
const expected=process.env.RELEASE_COMMIT_EXPECTED||manifest.releaseCommit||'';
const entries=Array.isArray(manifest.artifactManifest)?manifest.artifactManifest:[];
const mismatches=[];
for(const e of entries){const p=path.join(root,e.path);if(!fs.existsSync(p)){mismatches.push({path:e.path,reason:'missing'});continue;}const b=fs.readFileSync(p);const h=crypto.createHash('sha256').update(b).digest('hex');if(h!==e.sha256||b.length!==e.bytes)mismatches.push({path:e.path,reason:'hash-or-size-mismatch'});}
let gitDirty=null;try{gitDirty=execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();}catch{}
const report={generatedAt:new Date().toISOString(),status:'EXTERNAL_REQUIRED',releaseCommit:currentCommit||null,expectedReleaseCommit:expected||null,gitCheckoutAvailable:Boolean(currentCommit),gitDirty:gitDirty===null?null:Boolean(gitDirty),manifestPresent:fs.existsSync(manifestPath),artifactCount:entries.length,artifactMismatches:mismatches,driftDetected:mismatches.length>0||(expected&&currentCommit&&expected!==currentCommit),requiredExternalEvidence:['RELEASE_COMMIT_EXPECTED and a real git checkout for commit identity when promoting','deployment artifact manifest must match candidate files'],rule:'Promotion is blocked when the candidate differs from the certified release commit or recorded artifact hashes.'};
if(report.driftDetected) report.status='FAIL';
else if(report.manifestPresent&&entries.length&&currentCommit) report.status='PASS';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`deployment-drift: ${report.status}`);if(report.status==='FAIL')process.exit(1);
