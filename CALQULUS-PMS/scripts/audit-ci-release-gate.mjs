import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const out=path.join(root,'docs','audits','CI_RELEASE_GATE.json');
const read=(name)=>{try{return JSON.parse(fs.readFileSync(path.join(root,'docs','audits',name),'utf8'));}catch{return null;}};
const reports={
 dependency:read('DEPENDENCY_PROVENANCE.json'),
 sbom:read('SBOM_AUDIT.json'),
 secrets:read('SECRET_SUPPLY_CHAIN.json'),
 vulnerability:read('VULNERABILITY_GOVERNANCE.json'),
 manifest:read('SIGNED_RELEASE_MANIFEST_AUDIT.json')
};
const requiredFiles=['scripts/audit-dependency-provenance.mjs','scripts/generate-sbom.mjs','scripts/audit-sbom.mjs','scripts/scan-secret-supply-chain.mjs','scripts/audit-vulnerability-governance.mjs','scripts/audit-release-manifest.mjs','.github/workflows/release-integrity-gate.yml'];
const missingFiles=requiredFiles.filter(f=>!fs.existsSync(path.join(root,f)));
let status='PASS';
if(missingFiles.length||[reports.dependency,reports.sbom,reports.secrets,reports.manifest].some(r=>r?.status==='FAIL'))status='FAIL';
else if(reports.dependency?.status==='REVIEW_REQUIRED')status='REVIEW_REQUIRED';
const checks={dependencyProvenance:reports.dependency?.status||'NOT_RECORDED',sbomIntegrity:reports.sbom?.status||'NOT_RECORDED',secretSupplyChain:reports.secrets?.status||'NOT_RECORDED',vulnerabilityGovernance:reports.vulnerability?.status||'NOT_RECORDED',vulnerabilityScan:reports.vulnerability?.scannerStatus||'EXTERNAL_REQUIRED',releaseManifest:reports.manifest?.status||'NOT_RECORDED',workflowPresent:!missingFiles.length};
const report={generatedAt:new Date().toISOString(),status,checks,missingFiles,externalReleaseEvidenceRequired:true,rule:'Repository CI may certify dependency, SBOM, secret and manifest integrity. Production promotion still requires external deployment, migration, rollback and authorization evidence; npm audit --audit-level=high is authoritative for vulnerability blocking in CI.'};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`ci-release-gate: ${status}`);if(status==='FAIL')process.exit(1);
