import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=process.cwd();
const out=path.join(root,'docs','audits','SIGNED_RELEASE_MANIFEST.json');
const files=['package.json','package-lock.json','vite.config.ts','supabase/config.toml'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
let commit=process.env.RELEASE_COMMIT||''; try{if(!commit)commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{}
const artifacts=files.filter(f=>fs.existsSync(path.join(root,f))).map(f=>({path:f,sha256:sha(f),bytes:fs.statSync(path.join(root,f)).size}));
const migrations=fs.readdirSync(path.join(root,'supabase','migrations')).filter(f=>f.endsWith('.sql')).sort().map(f=>({path:`supabase/migrations/${f}`,sha256:sha(`supabase/migrations/${f}`),bytes:fs.statSync(path.join(root,'supabase','migrations',f)).size}));
const canonical={schemaVersion:1,generatedAt:new Date().toISOString(),releaseCommit:commit||null,artifacts,migrations,credentialsPersisted:false};
const canonicalBytes=Buffer.from(JSON.stringify(canonical));
const manifestHash=crypto.createHash('sha256').update(canonicalBytes).digest('hex');
let signature=null,algorithm=null,publicKey=null;
if(process.env.RELEASE_SIGNING_PRIVATE_KEY){try{const key=crypto.createPrivateKey(process.env.RELEASE_SIGNING_PRIVATE_KEY);signature=crypto.sign(null,canonicalBytes,key).toString('base64');algorithm='Ed25519';publicKey=crypto.createPublicKey(key).export({type:'spki',format:'pem'}).toString().trim();}catch(e){console.error(`signing-error: ${e.message}`);process.exit(2)}}
const report={...canonical,manifestSha256:manifestHash,signature,signatureAlgorithm:algorithm,publicKey,signatureStatus:signature?'PASS':'EXTERNAL_REQUIRED',rule:'The canonical manifest is hash-bound to the release artifacts and migrations. A cryptographic signature is recorded only when an external Ed25519 private key is supplied; private keys are never persisted.'};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n'); console.log(`signed-release-manifest: ${report.signatureStatus}`); if(!signature)process.exitCode=1;
