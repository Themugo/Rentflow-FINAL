import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'docs','audits','RUNTIME_UPDATE_POLICY.json');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const direct={...(pkg.dependencies||{}),...(pkg.optionalDependencies||{}),...(pkg.devDependencies||{})};
const entries=[];
const issues=[];
const now=new Date().toISOString();
for(const [name,spec] of Object.entries(direct)){
 const node=lock.packages?.[`node_modules/${name}`];
 const version=node?.version||null;
 const major=(v)=>{const m=String(v||'').match(/^(\d+)/);return m?Number(m[1]):null};
 const declaredMajor=major(spec); const lockedMajor=major(version);
 entries.push({name,spec,lockedVersion:version,majorPinned:declaredMajor!==null&&lockedMajor!==null&&declaredMajor===lockedMajor});
 if(!node) issues.push({name,type:'missing-lock-entry'});
 else if(declaredMajor!==null&&lockedMajor!==null&&declaredMajor!==lockedMajor) issues.push({name,type:'declared-vs-locked-major-mismatch',spec,lockedVersion:version});
}
const report={generatedAt:now,status:issues.length?'FAIL':'PASS',policyVersion:'1.0',directDependencyCount:entries.length,issues,dependencies:entries,controls:{lockfileRequired:'npm lockfileVersion 3',majorUpdate:'requires explicit review and release evidence',minorPatchUpdate:'allowed through normal dependency refresh with CI security checks',unboundedRanges:'review required; major version must not silently advance',lockfileOnly:'package.json and package-lock.json must change together when versions are intentionally updated',networkEvidence:'registry-backed update/vulnerability evidence must be captured in CI, never fabricated offline'},externalChecks:{registryOutdated:'EXTERNAL_REQUIRED',registryVulnerabilities:'EXTERNAL_REQUIRED'},rule:'This audit validates repository-local update policy. It does not claim current registry freshness without a network-backed CI run.'};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`runtime-update-policy: ${report.status} (${entries.length} direct dependencies)`);
if(report.status==='FAIL')process.exit(1);
