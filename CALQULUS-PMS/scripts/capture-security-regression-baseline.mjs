import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(); const src=path.join(root,'docs','audits','SECURITY_REGRESSION_MATRIX.json'); const out=path.join(root,'docs','audits','SECURITY_REGRESSION_BASELINE.json');
if(!fs.existsSync(src)){console.error('security-regression-baseline: matrix report missing');process.exit(1)}
const m=JSON.parse(fs.readFileSync(src,'utf8'));
const baseline={...m,baselineCapturedAt:new Date().toISOString(),baselinePurpose:'Reviewed repository security regression baseline. External-required states are preserved and are not converted to PASS.'};
fs.writeFileSync(out,JSON.stringify(baseline,null,2)+'\n'); console.log('security-regression-baseline: CAPTURED');
