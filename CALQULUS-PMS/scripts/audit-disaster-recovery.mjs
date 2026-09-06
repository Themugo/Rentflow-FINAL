import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd();
const requiredDocs=[
 'docs/operations/STAGING_DEPLOYMENT_RUNBOOK.md',
 'docs/operations/DISASTER_RECOVERY_RUNBOOK.md',
 'docs/operations/ROLLBACK_MATRIX.md',
 'docs/audits/STAGING_READINESS_CERTIFICATE.json'
];
const missing=requiredDocs.filter(p=>!fs.existsSync(path.join(root,p)));
const migrations=fs.readdirSync(path.join(root,'supabase','migrations')).filter(f=>f.endsWith('.sql'));
const destructive= migrations.filter(f=>/drop\s+(table|column|policy|function)/i.test(fs.readFileSync(path.join(root,'supabase','migrations',f),'utf8')));
const report={generatedAt:new Date().toISOString(),status:missing.length?'FAIL':'PASS',migrationCount:migrations.length,destructiveMigrationFiles:destructive,externalEvidenceRequired:[
 'verified Supabase backup/PITR configuration',
 'successful staging restore from a known backup',
 'successful migration forward test on disposable database',
 'documented rollback/recovery decision for each production migration'
],missing};
fs.writeFileSync(path.join(root,'docs','audits','DISASTER_RECOVERY_CERTIFICATE.json'),JSON.stringify(report,null,2)+'\n');
console.log(`disaster-recovery: ${report.status}`); console.log(`- destructive migration candidates: ${destructive.length}`);
if(missing.length) process.exit(1);
