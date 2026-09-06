# CALQULUS PMS — Staging Deployment Runbook (Phases 96–97)

## Gate 0 — Freeze
- Create a release tag from the certified commit.
- Record the SHA256 of the release ZIP.
- Confirm no uncommitted application or migration changes.

## Gate 1 — Database safety
1. Verify Supabase backup/PITR retention and latest recoverable point.
2. Export the current migration history (`supabase_migrations.schema_migrations`).
3. Compare it with `config/migration-history-policy.json`.
4. Apply migrations to a disposable/staging database first.
5. Stop immediately on any migration failure; do not manually skip a failed migration.

## Gate 2 — Security certification
Run:
- `npm run audit:prod`
- `npm run audit:security-boundary`
- `npm run audit:cross-role`
- `npm run audit:final-security`
- `npm run audit:migration-chain`
- `npm run audit:staging-readiness`
- `npm run audit:disaster-recovery`

## Gate 3 — Smoke tests
Test one account for each role: webhost, manager, submanager, landlord, tenant.
Verify portfolio isolation, financial mutation authorization, storage namespace access, notification ownership, and tenant self-registration.

## Gate 4 — Release decision
A repository PASS is not proof of live safety. Production promotion requires recorded staging execution evidence and a verified recovery point.
