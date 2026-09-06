import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(); const p=path.join(root,'docs','audits','PRODUCTION_EVIDENCE_INGESTION.json');
let r=null; try { r=JSON.parse(fs.readFileSync(p,'utf8')); } catch {}
const status=r?.status||'NOT_RECORDED';
console.log(`production-evidence-ingestion-audit: ${status}`);
if(status==='FAIL'||status==='NOT_RECORDED') process.exit(1);
