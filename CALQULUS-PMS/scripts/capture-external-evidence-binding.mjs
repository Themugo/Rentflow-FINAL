import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const audits = path.join(root, 'docs', 'audits');
const out = path.join(audits, 'EXTERNAL_EVIDENCE_BINDING.json');
const read = (p, fallback = {}) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };
const hash = p => fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null;
const nonEmpty = v => typeof v === 'string' && v.trim().length > 0;
const external = {
  releaseCommit: process.env.RELEASE_COMMIT || '',
  deploymentId: process.env.DEPLOYMENT_ID || '',
  migrationRunId: process.env.MIGRATION_RUN_ID || '',
  stagingMigrationRunId: process.env.STAGING_MIGRATION_RUN_ID || '',
  stagingSmokeRunId: process.env.STAGING_SMOKE_RUN_ID || '',
  stagingRestoreRunId: process.env.STAGING_RESTORE_RUN_ID || '',
  productionApprovalId: process.env.PRODUCTION_APPROVAL_ID || '',
  productionApprover: process.env.PRODUCTION_APPROVER || '',
  productionApprovedAt: process.env.PRODUCTION_APPROVED_AT || '',
  evidenceOperator: process.env.EVIDENCE_OPERATOR || ''
};
const releaseManifest = read(path.join(audits, 'SIGNED_RELEASE_MANIFEST.json'));
const releaseEvidencePath = path.join(audits, 'LIVE_RELEASE_EVIDENCE.json');
const releaseEvidence = read(releaseEvidencePath);
const required = ['releaseCommit','deploymentId','migrationRunId','stagingMigrationRunId','stagingSmokeRunId','stagingRestoreRunId','productionApprovalId','productionApprover','productionApprovedAt','evidenceOperator'];
const missing = required.filter(k => !nonEmpty(external[k]));
const manifestSha = hash(path.join(audits, 'SIGNED_RELEASE_MANIFEST.json'));
const evidenceSha = hash(releaseEvidencePath);
const binding = {
  generatedAt: new Date().toISOString(),
  status: missing.length ? 'EXTERNAL_REQUIRED' : 'PASS',
  release: { commit: external.releaseCommit || releaseEvidence.releaseCommit || null, manifestSha256: manifestSha },
  deployment: { id: external.deploymentId || null },
  migration: { productionRunId: external.migrationRunId || null, stagingRunId: external.stagingMigrationRunId || null },
  staging: { smokeRunId: external.stagingSmokeRunId || null, restoreRunId: external.stagingRestoreRunId || null },
  approval: { id: external.productionApprovalId || null, approverRecorded: Boolean(external.productionApprover), approvedAt: external.productionApprovedAt || null },
  evidence: { operatorRecorded: Boolean(external.evidenceOperator), liveReleaseEvidenceSha256: evidenceSha },
  missingExternalEvidence: missing,
  rule: 'This binding records identifiers and hashes only. It never persists credentials, tokens, passwords, database URLs, or command output. PASS requires explicit externally supplied release, deployment, migration, staging, restore, and production approval identifiers.'
};
fs.writeFileSync(out, JSON.stringify(binding, null, 2) + '\n');
console.log(`external-evidence-binding: ${binding.status} (${missing.length} missing)`);
