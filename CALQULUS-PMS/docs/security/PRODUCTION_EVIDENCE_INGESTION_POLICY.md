# Production Evidence Ingestion Policy

Production evidence may be ingested only from an operator-supplied JSON file referenced by `PRODUCTION_EVIDENCE_FILE`.

## Rules

- Only release, deployment, migration, staging, approval and rollback identifiers/timestamps are accepted.
- Unsupported fields are rejected.
- Credential/secret field names are rejected.
- Raw evidence, command output, passwords, tokens, private keys and database URLs are never copied into repository evidence.
- The source file is represented only by its SHA-256 hash.
- Missing external evidence produces `EXTERNAL_REQUIRED`, never `PASS`.
- A malformed or unsafe supplied evidence file produces `FAIL`.

The ingestion layer is validation and evidence binding only. It does not execute deployments, migrations, restores or rollbacks.
