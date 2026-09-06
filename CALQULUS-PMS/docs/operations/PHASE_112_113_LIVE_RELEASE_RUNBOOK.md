# Phases 112–113 — Live Staging Certification and Release Reconciliation

## Phase 112
Run `npm run staging:live-certify` from a staging runner with a dedicated staging URL and the required environment-only credentials/database access. The orchestrator runs connectivity, bootstrap, authenticated role certification, smoke, migration integrity, schema drift, live RLS, live migration reconciliation, and the live security aggregate.

A missing external environment produces `EXTERNAL_REQUIRED`; it is never converted to PASS.

## Phase 113
Run `npm run audit:release-reconciliation` after `LIVE_RELEASE_EVIDENCE.json` has been populated by the approved release process. The gate verifies required external evidence, live migration/security status, and scans the evidence file for credential/token/database-URL leakage.

Required external evidence:
- releaseCommit
- stagingMigrationRun
- stagingSmokeRun
- stagingRestoreRun
- productionApproval

Do not place passwords, tokens, database URLs, or command output in release evidence.

## Promotion rule
A repository audit PASS is not deployment proof. Production promotion requires explicit staging execution, restore/recovery evidence, migration reconciliation, and production approval.
