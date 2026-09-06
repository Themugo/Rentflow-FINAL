import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(); const lockPath=path.join(root,'package-lock.json');
const out=path.join(root,'docs','audits','SBOM.json');
if(!fs.existsSync(lockPath)){console.error('sbom: package-lock.json missing');process.exit(1)}
const lock=JSON.parse(fs.readFileSync(lockPath,'utf8')); const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const components=[];
for(const [key,node] of Object.entries(lock.packages||{})){ if(!key||!key.startsWith('node_modules/')) continue; const name=key.slice('node_modules/'.length); components.push({type:'library',name,version:node.version||'UNKNOWN',scope:node.dev?'development':'required',purl:`pkg:npm/${encodeURIComponent(name)}@${node.version||'UNKNOWN'}`,integrity:node.integrity||null,resolved:node.resolved||null}); }
components.sort((a,b)=>a.purl.localeCompare(b.purl));
const raw=fs.readFileSync(lockPath); const report={bomFormat:'CycloneDX',specVersion:'1.5',serialNumber:`urn:uuid:${crypto.randomUUID()}`,version:1,metadata:{timestamp:new Date().toISOString(),component:{type:'application',name:pkg.name,version:pkg.version}},components,dependencies:[],properties:[{name:'package-lock-sha256',value:crypto.createHash('sha256').update(raw).digest('hex')}],rule:'Repository SBOM is generated deterministically from the committed package-lock.json. Vulnerability status must come from a current npm audit/SCA run in CI or an explicitly recorded external scan.'};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`sbom: PASS (${components.length} components)`);
