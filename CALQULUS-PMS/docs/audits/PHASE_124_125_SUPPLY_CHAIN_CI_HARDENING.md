# Phases 124–125 — Supply-Chain Integrity & CI Release Gate

## Phase 124 — Dependency provenance

`audit-dependency-provenance.mjs` verifies that direct npm dependencies are represented in the committed npm lockfile, that the lockfile is npm lockfile v3, and that registry packages carry integrity metadata. Git, file, SSH and non-standard registries are surfaced for review rather than silently trusted. No credentials are persisted.

The audit is intentionally repository-local. `npm audit` remains an external network/package-registry control and is not represented as PASS when the environment cannot reach the registry.

## Phase 125 — CI release integrity gate

`.github/workflows/release-integrity-gate.yml` runs on pull requests, pushes to `main`, and manual dispatch. It installs from the committed lockfile and executes dependency provenance, release-manifest integrity and the CI release gate.

The CI gate certifies repository integrity only. It does **not** manufacture production deployment, migration, restore, authorization or rollback evidence. Those remain external release gates.

## Verification policy

- PASS means the check actually ran and satisfied its repository-local assertions.
- EXTERNAL_REQUIRED means evidence depends on Git, staging, production, signing keys, deployment systems or other external state unavailable in the packaged workspace.
- FAIL means a concrete integrity violation was detected.
