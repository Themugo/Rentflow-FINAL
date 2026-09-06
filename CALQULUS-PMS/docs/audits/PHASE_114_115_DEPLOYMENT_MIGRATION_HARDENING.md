# Phase 114–115 Hardening

- Deployment execution evidence is separated from repository readiness.
- Release identity is captured by commit hash when available, without inventing a deployment ID.
- Artifact hashes are recorded for key release-control files.
- Production migration attestation is fail-closed and depends on live migration reconciliation plus migration integrity.
- Operator/run identifiers are required as external evidence and are not sourced from arbitrary repository metadata.
- No migration, deployment, rollback, or production mutation is performed by the certification scripts.
