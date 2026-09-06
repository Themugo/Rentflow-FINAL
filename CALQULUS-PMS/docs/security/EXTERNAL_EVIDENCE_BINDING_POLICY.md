# External Evidence Binding Policy

Release evidence supplied from staging, deployment, restore, migration, and production approval systems must be bound to the certified release without persisting credentials.

## Required identifiers

- release commit
- deployment identifier
- production and staging migration run identifiers
- staging smoke and restore run identifiers
- production approval identifier, approver, and timestamp
- evidence operator

The binding also records SHA-256 hashes for the signed release manifest and `LIVE_RELEASE_EVIDENCE.json`.

## Fail-closed rules

- Hash mismatch or contradictory release identity is `FAIL`.
- Missing external identifiers are `EXTERNAL_REQUIRED`.
- Credentials, tokens, passwords, database URLs, and private keys must never be persisted in the binding.
- A repository-only binding is not proof that a deployment, migration, restore, or approval actually occurred.
