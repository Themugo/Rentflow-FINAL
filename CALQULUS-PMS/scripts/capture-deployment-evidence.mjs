import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const out=path.join(root,'docs','audits','DEPLOYMENT_EXECUTION_EVIDENCE.json');
const files=[];
const add=(rel)=>{const p=path.join(root,rel);if(fs.existsSync(p)){const b=fs.readFileSync(p);files.push({path:rel,sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length});}};
['package.json','package-lock.json','vite.config.ts','supabase/config.toml'].forEach(add);
let commit=process.env.RELEASE_COMMIT||''; if(!commit){try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}}
const deploymentId=process.env.DEPLOYMENT_ID||'';
const target=process.env.DEPLOYMENT_TARGET||'';
const report={generatedAt:new Date().toISOString(),status:'EXTERNAL_REQUIRED',releaseCommit:commit||null,deploymentId:deploymentId||null,deploymentTarget:target||null,artifactManifest:files,productionDeploymentObserved:false,edgeFunctionsDeploymentObserved:false,frontendDeploymentObserved:false,requiredExternalEvidence:['deploymentId','deploymentTarget','frontendDeploymentObserved','edgeFunctionsDeploymentObserved'],note:'This report records repository identity and deployment evidence fields only. It never claims a deployment occurred without explicit external evidence.'};
if(deploymentId&&target&&process.env.FRONTEND_DEPLOYMENT_OBSERVED==='true'&&process.env.EDGE_FUNCTIONS_DEPLOYMENT_OBSERVED==='true')report.status='PASS';
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`deployment-execution-evidence: ${report.status}`);
