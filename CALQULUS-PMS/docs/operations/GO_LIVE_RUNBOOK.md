# CALQULUS PMS — Go-Live Runbook (Phase 101)

## Required automated gates
- `npm run audit:deployment-controls`
- `npm run audit:release-readiness`
- `npm run reconcile:live-migrations`
- `npm run audit:go-live`

## Required external evidence
Create `docs/audits/LIVE_RELEASE_EVIDENCE.json` from the release template and record:
- `releaseCommit`: exact Git commit SHA promoted;
- `stagingMigrationRun`: timestamp, target, operator, and outcome;
- `stagingSmokeRun`: timestamp, target, operator, and outcome;
- `stagingRestoreRun`: timestamp, recovery point, restore target, and outcome;
- `productionApproval`: timestamp, approver, and decision.

Do not place secrets, database URLs, access tokens, or credentials in the evidence file.

## Decision
`GO` is permitted only when automated checks pass and all external evidence fields are populated. Otherwise the release remains `BLOCKED`.
