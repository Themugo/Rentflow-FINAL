# Phases 114–115 — Deployment Execution Evidence & Production Migration Attestation

## Phase 114
Capture the immutable release identity and deployment artifact manifest. A deployment is not considered observed unless the external deployment system supplies a deployment ID/target and explicit frontend and Edge Function deployment evidence.

Run:
`npm run capture:deployment-evidence`

## Phase 115
Attest production migration execution only after the live migration reconciliation and migration integrity checks return PASS. Supply `RELEASE_COMMIT`, `MIGRATION_RUN_ID`, `MIGRATION_APPLIED_AT`, and `MIGRATION_OPERATOR` from the external deployment/migration record.

Run:
`npm run audit:migration-attestation`

No migration is executed by these scripts. No credentials are persisted. Missing external proof remains `EXTERNAL_REQUIRED`.
