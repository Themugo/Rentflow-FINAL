# Phases 116–117 — Rollback Execution & Artifact Provenance Runbook

## Phase 116 — Rollback execution evidence

Capture external evidence only after an approved rollback/restore has actually run. Set `ROLLBACK_EXECUTION_ID`, `ROLLBACK_EXECUTED_AT`, `ROLLBACK_OPERATOR`, `ROLLBACK_RESTORE_RUN_ID`, and `ROLLBACK_VERIFIED=true`, then run `npm run capture:rollback-evidence`.

The script is non-destructive and never executes rollback SQL.

## Phase 117 — Release artifact provenance

Run `npm run audit:artifact-provenance`. The deployment manifest is re-hashed locally. A promotion candidate must match the recorded SHA-256 values and, when supplied, `RELEASE_COMMIT_EXPECTED`.

This is provenance, not a digital signature. For production promotion, retain the CI/CD artifact and release-system identity alongside the repository evidence.
