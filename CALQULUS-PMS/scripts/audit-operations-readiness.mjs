import fs from 'node:fs';
import path from 'node:path';
const required=['config/observability-policy.json','config/operations-slo.json','docs/operations/OBSERVABILITY_RUNBOOK.md','docs/operations/DISASTER_RECOVERY_RUNBOOK.md','docs/operations/ROLLBACK_MATRIX.md'];
const failures=required.filter(f=>!fs.existsSync(f));
const funcs=fs.readdirSync('supabase/functions',{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.name.startsWith('_')).map(x=>x.name);
const config=fs.readFileSync('supabase/config.toml','utf8');
const publicFns=[...config.matchAll(/\[functions\.([^\]]+)\]\s*\nverify_jwt\s*=\s*false/g)].map(m=>m[1]);
const critical=['mpesa-callback','stripe-webhook','bank-webhook','process-payment','reconcile-bank','execute-payout','send-invoice-email','send-payment-confirmation'];
const missing=critical.filter(f=>!funcs.includes(f)); if(missing.length) failures.push(`missing critical function directories: ${missing.join(',')}`);
const report={generatedAt:new Date().toISOString(),functionCount:funcs.length,publicJwtDisabledFunctions:publicFns,criticalFunctions:critical,requiredArtifacts:required,failures,status:failures.length?'FAIL':'PASS',externalGates:['staging synthetic monitoring','production alert delivery test','Supabase log retention verification']};
fs.writeFileSync('docs/audits/OPERATIONS_READINESS_CERTIFICATE.json',JSON.stringify(report,null,2)+'\n'); console.log(`operations-readiness: ${report.status}`); if(failures.length){console.error(failures.join('\n'));process.exit(1)}
