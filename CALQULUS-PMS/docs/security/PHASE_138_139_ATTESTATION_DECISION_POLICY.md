# Phases 138–139 — Attestation Signature & Final Production Decision Policy

## Phase 138 — Evidence signature verification

Independent release attestation is considered cryptographically valid only when an external Ed25519 signature verifies the canonical attestation fields:

- attestationId
- attestor
- attestedAt
- scope
- evidenceSha256

The public key and signature are supplied through the deployment environment or an externally produced attestation record. Private keys are never persisted by the repository.

Missing signature material is `EXTERNAL_REQUIRED`. An invalid signature is `FAIL` and blocks release.

## Phase 139 — Final production decision

The final decision engine aggregates the release certification, security gate, evidence binding, attestation, signature verification, provenance, deployment, migration, rollback, traceability and regression controls.

Decision states:

- `PRODUCTION_RELEASE_CERTIFIED`
- `PRODUCTION_RELEASE_BLOCKED_EXTERNAL_EVIDENCE_REQUIRED`
- `PRODUCTION_RELEASE_BLOCKED_SECURITY_FAILURE`

The engine is fail-closed. It does not execute deployment, migration, rollback or restore operations and never converts missing external evidence into approval.
