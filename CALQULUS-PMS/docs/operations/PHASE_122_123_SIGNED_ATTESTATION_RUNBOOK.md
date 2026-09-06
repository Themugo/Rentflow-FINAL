# Phases 122–123 — Signed Release Manifest & Deployment Attestation Runbook

## Phase 122 — Signed release manifest

Run `npm run create:signed-release-manifest` from the real Git checkout. For cryptographic signing, provide `RELEASE_SIGNING_PRIVATE_KEY` as an external Ed25519 private key. The key is used in memory only and is never written to the repository or evidence files.

Then run `npm run audit:release-manifest`.

A manifest hash is always generated. The audit remains `EXTERNAL_REQUIRED` until a valid signature is supplied; it becomes `PASS` only after the Ed25519 signature verifies against the canonical manifest payload and all artifact/migration hashes still match.

## Phase 123 — Deployment attestation

Run `npm run capture:deployment-attestation` in the deployment environment with externally supplied identifiers:

- `RELEASE_COMMIT`
- `DEPLOYMENT_ID`
- `DEPLOYMENT_TARGET`
- `MIGRATION_RUN_ID`
- `DEPLOYED_AT`
- `DEPLOYED_BY`
- `DEPLOYMENT_ATTESTATION_ID`

Then run `npm run audit:deployment-attestation`.

The attestation must bind the exact manifest SHA-256 and release commit to the deployment and migration execution identities. No credentials, tokens, private keys, or database URLs are persisted.

## Release gate

The release reconciliation gate now requires both the signed-release-manifest audit and deployment-attestation audit to pass, in addition to the existing migration, security, provenance, drift, rollback, authorization, and change-trace controls.

`EXTERNAL_REQUIRED` is intentional when real signing/deployment evidence is absent. It must never be converted to `PASS` by editing evidence manually.
