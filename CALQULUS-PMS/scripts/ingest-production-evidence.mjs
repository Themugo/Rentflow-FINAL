import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const audits = path.join(root, 'docs', 'audits');
const source = process.env.PRODUCTION_EVIDENCE_FILE || '';
const out = path.join(audits, 'PRODUCTION_EVIDENCE_INGESTION.json');
const allowed = new Set(['releaseCommit','deploymentId','deploymentTarget','deploymentAt','deploymentOperator','migrationRunId','migrationAppliedAt','migrationOperator','stagingMigrationRun','stagingSmokeRun','stagingRestoreRun','productionApproval','productionApprovalId','productionApprover','productionApprovedAt','rollbackExecutionId','rollbackExecutedAt','rollbackOperator','rollbackRestoreRunId','rollbackVerified']);
const forbidden = /(password|secret|access[_-]?token|database[_-]?url|supabase[_-]?db[_-]?url|private[_-]?key|api[_-]?key|credential)/i;
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const findings=[];
if (!source) { /* external evidence is optional locally; status remains EXTERNAL_REQUIRED */ }
else if (!fs.existsSync(source)) findings.push('Supplied production evidence file does not exist.');
let raw=null, data=null;
if (source && !findings.length) { try { raw=fs.readFileSync(source); data=JSON.parse(raw.toString('utf8')); } catch { findings.push('Supplied production evidence is not valid JSON.'); } }
const walk=(v, keys=[])=>{ if(!v||typeof v!=='object') return keys; return Object.entries(v).reduce((a,[k,x])=>a.concat(k,walk(x)),keys); };
if (data) {
  const keys=walk(data);
  if (keys.some(k=>forbidden.test(k))) findings.push('Evidence contains a forbidden credential/secret field name.');
  const unknown=keys.filter(k=>typeof k==='string' && !allowed.has(k) && !['status','generatedAt','source','evidenceVersion','notes'].includes(k));
  if (unknown.length) findings.push(`Evidence contains unsupported field(s): ${[...new Set(unknown)].slice(0,10).join(', ')}`);
  for (const k of ['releaseCommit','deploymentId','migrationRunId','productionApprovalId']) if (data[k] !== undefined && typeof data[k] !== 'string') findings.push(`${k} must be a string.`);
  for (const k of ['deploymentAt','migrationAppliedAt','productionApprovedAt','rollbackExecutedAt']) if (data[k] && Number.isNaN(Date.parse(data[k]))) findings.push(`${k} is not a valid timestamp.`);
}
const status = findings.length ? 'FAIL' : data ? 'PASS' : 'EXTERNAL_REQUIRED';
const report={generatedAt:new Date().toISOString(),status,evidenceVersion:'1.0',sourceFileProvided:Boolean(source),sourceSha256:raw?sha256(raw):null,acceptedFields:[...allowed].sort(),findings,rule:'Production evidence ingestion accepts identifiers and timestamps only; secrets and unsupported fields are rejected. Raw external evidence is never copied into repository evidence.'};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`production-evidence-ingestion: ${status}`);
if(status==='FAIL') process.exit(1);
