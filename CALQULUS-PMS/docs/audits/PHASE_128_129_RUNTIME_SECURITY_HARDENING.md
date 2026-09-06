# Phases 128–129 — Runtime Dependency Governance + Security Regression Matrix

## Phase 128

Added runtime dependency governance with committed lockfile validation, direct dependency reconciliation, non-registry dependency review, lifecycle-script detection, optional registry-backed outdated checks, and an explicit policy/evidence model.

## Phase 129

Added a consolidated security regression matrix covering repository security, isolation, migration, observability, operations, deployment, supply-chain, dependency and CI release gates. The matrix fails closed on any `FAIL` and preserves `EXTERNAL_REQUIRED` for infrastructure-dependent evidence.

## Safety

No migrations were applied. No production database was modified. Registry credentials and tokens are not persisted.
