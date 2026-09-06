import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'docs', 'audits', 'SECURITY_REGRESSION_MATRIX.json');
const checks = [
  ['securityBoundary','npm run audit:security-boundary'],
  ['crossRoleIsolation','npm run audit:cross-role'],
  ['finalSecurity','npm run audit:final-security'],
  ['migrationChain','npm run audit:migration-chain'],
  ['observability','npm run audit:observability'],
  ['operationsReadiness','npm run audit:operations-readiness'],
  ['edgeReliability','npm run audit:edge-reliability'],
  ['deploymentControls','npm run audit:deployment-controls'],
  ['dependencyProvenance','npm run audit:dependency-provenance'],
  ['sbomAudit','npm run audit:sbom'],
  ['secretSupplyChain','npm run audit:secret-supply-chain'],
  ['vulnerabilityGovernance','npm run audit:vulnerability-governance'],
  ['runtimeDependencyGovernance','npm run audit:runtime-dependency-governance'],
  ['runtimeUpdatePolicy','npm run audit:runtime-update-policy'],
  ['ciReleaseGate','npm run audit:ci-release-gate']
];
const results=[];
function statusFromReport(name, stdout='', stderr='') {
  const files={
    observability:'OBSERVABILITY_AUDIT.json',operationsReadiness:'OPERATIONS_READINESS_CERTIFICATE.json',
    edgeReliability:'EDGE_RELIABILITY_INVENTORY.json',deploymentControls:'DEPLOYMENT_CONTROL_CERTIFICATE.json',
    dependencyProvenance:'DEPENDENCY_PROVENANCE.json',sbomAudit:'SBOM_AUDIT.json',secretSupplyChain:'SECRET_SUPPLY_CHAIN.json',
    vulnerabilityGovernance:'VULNERABILITY_GOVERNANCE.json',runtimeDependencyGovernance:'RUNTIME_DEPENDENCY_GOVERNANCE.json',runtimeUpdatePolicy:'RUNTIME_UPDATE_POLICY.json',
    ciReleaseGate:'CI_RELEASE_GATE.json'
  };
  if (files[name]) { try { return JSON.parse(fs.readFileSync(path.join(root,'docs','audits',files[name]),'utf8')).status || 'UNKNOWN'; } catch {} }
  const text=(stdout+'\n'+stderr);
  if (/\bFAIL\b/i.test(text)) return 'FAIL';
  if (/\bEXTERNAL_REQUIRED\b|LIVE_RECONCILIATION_REQUIRED/i.test(text)) return 'EXTERNAL_REQUIRED';
  if (/\bPASS\b/i.test(text)) return 'PASS';
  return 'UNKNOWN';
}
for (const [name, command] of checks) {
  const [bin,...args]=command.split(' ');
  const r=spawnSync(process.platform==='win32' && bin==='npm' ? 'npm.cmd' : bin,args,{cwd:root,encoding:'utf8',timeout:120000});
  const status=statusFromReport(name, r.stdout||'', r.stderr||'');
  results.push({name,command,exitCode:r.status,reportStatus:status,stdoutTail:(r.stdout||'').slice(-800),stderrTail:(r.stderr||'').slice(-800)});
}
const fail=results.filter(r=>r.reportStatus==='FAIL' || r.reportStatus==='UNKNOWN');
const external=results.filter(r=>r.reportStatus==='EXTERNAL_REQUIRED');
const report={generatedAt:new Date().toISOString(),status:fail.length?'FAIL':(external.length?'EXTERNAL_REQUIRED':'PASS'),checkCount:results.length,failCount:fail.length,externalRequiredCount:external.length,results,rule:'Security regression is PASS only when all repository-local checks pass and every check produces a recognized status. Any FAIL blocks certification. External-dependent checks remain EXTERNAL_REQUIRED until executed against real staging/production infrastructure.'};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`security-regression-matrix: ${report.status} (${fail.length} fail, ${external.length} external)`);
if(report.status==='FAIL')process.exit(1);
