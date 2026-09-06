import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const output = path.join(root, 'docs', 'audits', 'STAGING_E2E_EVIDENCE.json');
const required = ['E2E_MANAGER_EMAIL','E2E_MANAGER_PASSWORD','E2E_LANDLORD_EMAIL','E2E_LANDLORD_PASSWORD','E2E_TENANT_EMAIL','E2E_TENANT_PASSWORD','E2E_WEBHOST_EMAIL','E2E_WEBHOST_PASSWORD'];
const missing = required.filter(k => !process.env[k]);
const baseUrl = process.env.BASE_URL || process.env.SMOKE_BASE_URL || '';
if (!baseUrl || missing.length) {
  const report = { generatedAt:new Date().toISOString(), status:'EXTERNAL_REQUIRED', baseUrl:baseUrl||null, missingEnvironment:missing, testFile:'e2e/phase104-authenticated-isolation.spec.ts', note:'Provide a dedicated staging origin and non-production role accounts. Credentials are environment variables only and are never written to evidence.' };
  fs.writeFileSync(output, JSON.stringify(report,null,2)+'\n');
  console.log('staging-e2e-evidence: EXTERNAL_REQUIRED');
  if (missing.length) console.log(`- missing environment: ${missing.join(', ')}`);
  process.exit(0);
}
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['playwright','test','e2e/phase104-authenticated-isolation.spec.ts','--project=chromium','--reporter=line'], { stdio:'pipe', encoding:'utf8', env:{...process.env, BASE_URL:baseUrl} });
const outputText = `${result.stdout||''}\n${result.stderr||''}`.slice(-8000);
const passed = result.status === 0;
const report = { generatedAt:new Date().toISOString(), status:passed?'PASS':'FAIL', baseUrl, testFile:'e2e/phase104-authenticated-isolation.spec.ts', exitCode:result.status, outputTail:outputText, credentialsRecorded:false, note:'Role credentials are used only by the test process and are never persisted.' };
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(`staging-e2e-evidence: ${report.status}`);
if (!passed) process.exit(1);
