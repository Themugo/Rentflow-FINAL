import fs from 'node:fs';
import path from 'node:path';
const root='supabase/functions';
const policy=JSON.parse(fs.readFileSync('config/observability-policy.json','utf8'));
const dirs=fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.name.startsWith('_'));
const failures=[]; const forbiddenLiteral=/(authorization|apikey|service[_-]?role[_-]?key|access[_-]?token|refresh[_-]?token|secret)\s*[:=]/i; let instrumented=0;
for(const d of dirs){const f=path.join(root,d.name,'index.ts'); if(!fs.existsSync(f)) continue; const s=fs.readFileSync(f,'utf8');
  if(/startTelemetry\(/.test(s)){instrumented++; if(!/finishTelemetry\(/.test(s)) failures.push(`${d.name}: incomplete request correlation`);}
  for(const line of s.split(/\r?\n/)){ if(/console\.(log|error|warn)\s*\(/.test(line) && forbiddenLiteral.test(line)) failures.push(`${d.name}: possible secret-bearing log key: ${line.trim().slice(0,180)}`); }
}
for(const required of (policy.requiredFunctions||[])){ const f=path.join(root,required,'index.ts'); const text=fs.existsSync(f)?fs.readFileSync(f,'utf8'):''; if(!/startTelemetry\(/.test(text)||!/finishTelemetry\(/.test(text)) failures.push(`${required}: required instrumentation missing`); }
const report={generatedAt:new Date().toISOString(),functions:dirs.length,instrumented,requiredMinimum:'health-check',failures,status:failures.length?'FAIL':'PASS'};
fs.writeFileSync('docs/audits/OBSERVABILITY_AUDIT.json',JSON.stringify(report,null,2)+'\n');
console.log(`observability-audit: ${report.status} (${instrumented}/${dirs.length} instrumented)`); if(failures.length){console.error(failures.join('\n'));process.exit(1)}
