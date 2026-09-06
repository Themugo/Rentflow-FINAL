# Phases 118–119 — Deployment Drift & Rollback Readiness

## Phase 118 — Deployment drift detection

Run `npm run audit:deployment-drift` before promotion. The audit re-hashes the certified deployment artifact manifest and, when a git checkout is available, compares the candidate `HEAD` to `RELEASE_COMMIT_EXPECTED` or the recorded release commit. Any artifact mismatch is a hard failure. A missing external release identity remains `EXTERNAL_REQUIRED` rather than being fabricated.

## Phase 119 — Rollback readiness

Run `npm run audit:rollback-readiness`. The audit verifies that repository-side rollback prerequisites exist: rollback/deployment runbooks, restore-drill tooling, migration repair planning, deployment evidence structure, and artifact provenance. It deliberately does not claim that backups, PITR, restore execution, or an approved production rollback occurred. Those require external evidence.

### Promotion rule

Do not promote an artifact when Phase 118 reports `FAIL`. Do not treat `EXTERNAL_REQUIRED` as `PASS`. Production rollback certification requires an approved restore point, execution evidence, and verification from the actual deployment/backup platform.
