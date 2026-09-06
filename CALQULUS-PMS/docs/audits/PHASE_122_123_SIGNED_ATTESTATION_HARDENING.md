# Phase 122–123 Security Hardening Record

## Phase 122

Introduced a canonical release manifest covering the core deployment artifacts and all SQL migrations. Each entry contains SHA-256 and byte-count identity. Optional Ed25519 signing is performed only with an externally supplied private key and the private key is never persisted.

The audit independently recomputes every recorded hash and verifies the Ed25519 signature when present.

## Phase 123

Introduced deployment attestation capture and audit. The attestation binds the exact manifest hash and release commit to deployment ID, deployment target, migration run ID, execution timestamp, operator, and attestation ID.

The attestation is evidence-only: it does not deploy code, run migrations, or modify production.

## Current packaged-workspace result

- Signed manifest: `EXTERNAL_REQUIRED` because no signing key is present.
- Manifest integrity: verified locally.
- Deployment attestation: `EXTERNAL_REQUIRED` because no external deployment execution identifiers are present.
- Release reconciliation: `BLOCKED` as expected.

This is a deliberate fail-closed design.
