# Phases 120–121 — Release Lock & Production Change Traceability

## Purpose

These controls make production promotion explicitly bound to an authorized release commit and preserve a tamper-evident repository-side trace of migrations and deployment artifacts.

## Phase 120 — Release Promotion Lock

Run:

```bash
npm run audit:release-promotion-lock
```

Required external variables for a production authorization:

- `RELEASE_AUTHORIZATION_ID`
- `RELEASE_AUTHORIZED_BY`
- `RELEASE_AUTHORIZED_AT`
- `RELEASE_AUTHORIZATION_SCOPE=production`
- `RELEASE_COMMIT_EXPECTED`

The audit also requires the existing release reconciliation, artifact provenance and deployment-drift gates to pass. Authorization secrets are never written to the evidence file.

## Phase 121 — Production Change Trace

Capture the repository trace:

```bash
npm run capture:production-change-trace
npm run audit:production-change-trace
```

For actual production execution, provide environment-only identifiers:

- `RELEASE_COMMIT`
- `DEPLOYMENT_ID`
- `DEPLOYMENT_TARGET`
- `MIGRATION_RUN_ID`
- `MIGRATION_APPLIED_AT`
- `MIGRATION_OPERATOR`
- `RELEASE_AUTHORIZATION_ID`
- `RELEASE_AUTHORIZED_BY`

The trace records SHA-256 hashes of migrations and release artifacts. It does not record passwords, tokens, database URLs or credentials.

## Promotion rule

Production promotion remains blocked until the exact release commit, authorization, deployment execution, migration execution and recovery evidence are externally established. Repository scripts cannot manufacture those facts.
