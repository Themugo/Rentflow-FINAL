import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'docs', 'audits', 'STAGING_ROLE_CERTIFICATION.json');
const baseUrl = (process.env.STAGING_BASE_URL || process.env.BASE_URL || process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');
const roles = ['MANAGER','LANDLORD','TENANT','WEBHOST'];
const required = roles.flatMap(r => [`E2E_${r}_EMAIL`, `E2E_${r}_PASSWORD`]);
const missing = required.filter(k => !process.env[k]);
const playwrightBin = process.platform === 'win32' ? path.join(root,'node_modules','.bin','playwright.cmd') : path.join(root,'node_modules','.bin','playwright');
const report = { generatedAt:new Date().toISOString(), status:'EXTERNAL_REQUIRED', baseUrl:baseUrl||null, testFile:'e2e/phase104-authenticated-isolation.spec.ts', roles:roles.map(r=>({role:r.toLowerCase(),credentialsProvided:!!process.env[`E2E_${r}_EMAIL`] && !!process.env[`E2E_${r}_PASSWORD`]})), credentialsRecorded:false };
fs.mkdirSync(path.dirname(out), {recursive:true});
if (!baseUrl || missing.length) {
  report.reason = !baseUrl ? 'Dedicated staging origin is required.' : 'All four non-production role credentials are required.';
  report.missingEnvironment = missing;
  fs.writeFileSync(out, JSON.stringify(report,null,2)+'\n');
  console.log('staging-certification: EXTERNAL_REQUIRED');
  process.exit(0);
}
if (!fs.existsSync(playwrightBin)) {
  report.status='EXTERNAL_REQUIRED'; report.reason='Playwright executable is not installed in node_modules; install dependencies in the staging runner before executing authenticated E2E.';
  fs.writeFileSync(out, JSON.stringify(report,null,2)+'\n');
  console.log('staging-certification: EXTERNAL_REQUIRED');
  process.exit(0);
}
const r = spawnSync(playwrightBin,['test','e2e/phase104-authenticated-isolation.spec.ts','--project=chromium','--reporter=line'],{cwd:root,env:{...process.env,BASE_URL:baseUrl},encoding:'utf8'});
const outputTail = `${r.stdout||''}\n${r.stderr||''}`.slice(-6000);
report.status = r.status===0 ? 'PASS' : 'FAIL';
report.exitCode = r.status;
report.outputTail = outputTail;
fs.writeFileSync(out, JSON.stringify(report,null,2)+'\n');
console.log(`staging-certification: ${report.status}`);
if(report.status==='FAIL') process.exit(1);
