import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root=process.cwd(), out=path.join(root,'docs','audits','SECRET_SUPPLY_CHAIN.json');
const ignoredDirs=new Set(['node_modules','.git','dist','build','coverage','.vite']); const allowedFiles=new Set(['docs/audits/SECRET_SUPPLY_CHAIN.json']);
const patterns=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
 ['github-token',/\bgh[pousr]_[A-Za-z0-9_\-]{20,}\b/],
 ['aws-access-key',/\bAKIA[0-9A-Z]{16}\b/],
 ['google-api-key',/\bAIza[0-9A-Za-z_-]{35}\b/],
 ['supabase-service-role',/\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
 ['jwt-like',/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/]
];
const hits=[]; const textExt=/\.(mjs|js|cjs|ts|tsx|json|yml|yaml|toml|sql|md|env|sh|html|css)$/i;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(ignoredDirs.has(e.name))continue; const p=path.join(dir,e.name); if(e.isDirectory())walk(p); else if(textExt.test(e.name)&&!allowedFiles.has(path.relative(root,p).replaceAll('\\','/'))){let t;try{t=fs.readFileSync(p,'utf8')}catch{continue} for(const [type,re] of patterns){if(re.test(t))hits.push({type,file:path.relative(root,p).replaceAll('\\','/')})}}}}
walk(root); const report={generatedAt:new Date().toISOString(),status:hits.length?'FAIL':'PASS',scan:'repository text files excluding generated/build/dependency directories',hits,credentialPersistenceDetected:hits.length>0,rule:'No live credentials, private keys, provider tokens or JWT secrets may be committed. Variable names, placeholders and documented secret names are not themselves findings.'}; fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n'); console.log(`secret-supply-chain: ${report.status}`); if(hits.length)process.exit(1);
