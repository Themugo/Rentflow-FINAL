import fs from 'node:fs'; import path from 'node:path';
const p=path.join(process.cwd(),'docs','audits','INDEPENDENT_RELEASE_ATTESTATION.json'); let r=null; try{r=JSON.parse(fs.readFileSync(p,'utf8'));}catch{}
let status=r?.status||'NOT_RECORDED'; if(status==='PASS' && r.hashMatches!==true) status='FAIL';
console.log(`independent-release-attestation-audit: ${status}`); if(status==='FAIL'||status==='NOT_RECORDED') process.exit(1);
