import fs from 'node:fs';
import path from 'node:path';
const root='supabase/functions';
const dirs=fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.name.startsWith('_'));
const inventory=[];
for(const d of dirs){const f=path.join(root,d.name,'index.ts');if(!fs.existsSync(f))continue;const s=fs.readFileSync(f,'utf8');inventory.push({function:d.name,webhook:/webhook|callback/i.test(d.name),retrySignals:/retry|attempt|dead.?letter/i.test(s),idempotencySignals:/idempot|reference_id|dedup|already processed|on conflict/i.test(s),authGate:/getUser\(|Authorization|verify_jwt|service_role/i.test(s)});}
const critical=['mpesa-callback','stripe-webhook','bank-webhook','process-payment','reconcile-bank','execute-payout'];
const failures=inventory.filter(x=>critical.includes(x.function)&&!x.authGate).map(x=>`${x.function}: no detectable auth/service gate`);
const report={generatedAt:new Date().toISOString(),functionCount:inventory.length,critical,functions:inventory,failures,status:failures.length?'FAIL':'PASS'};
fs.writeFileSync('docs/audits/EDGE_RELIABILITY_INVENTORY.json',JSON.stringify(report,null,2)+'\n');console.log(`edge-reliability-audit: ${report.status} (${inventory.length} functions)`);if(failures.length){console.error(failures.join('\n'));process.exit(1)}
