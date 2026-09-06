# Phases 130–131 — Runtime Update Governance & Security Regression Control

## Phase 130
Introduces a repository-local runtime dependency update policy audit. It reconciles direct runtime/development dependencies against `package-lock.json`, detects declared-versus-locked major-version divergence, and records the controls governing major, minor, and patch updates. Registry freshness remains external evidence.

## Phase 131
Adds a security regression baseline/diff mechanism. A reviewed matrix snapshot can be captured and subsequent matrices are compared. PASS→FAIL and PASS→UNKNOWN transitions are release-blocking; EXTERNAL_REQUIRED remains unresolved rather than being converted into PASS.

## Verification
Repository-local checks pass. Infrastructure-dependent evidence remains explicitly `EXTERNAL_REQUIRED`. No deployment, migration, rollback, or production mutation is performed by these phases.
