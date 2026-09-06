# CALQULUS PMS — Production Deployment Control Runbook (Phase 100)

## Purpose
Prevent promotion of an uncommitted, unreconciled, or uncertified release.

## Preflight
1. Build from a clean committed checkout and record the commit SHA.
2. Run `npm run audit:deployment-controls`.
3. Run `npm run audit:release-readiness`.
4. Export the target database migration history from `supabase_migrations.schema_migrations`.
5. Run `npm run reconcile:live-migrations` with `DATABASE_URL` or `SUPABASE_DB_URL` against staging/production as appropriate.
6. Apply migrations to staging before production.
7. Run `SMOKE_BASE_URL=https://staging.example npm run smoke:deploy` and role-isolation smoke tests.

## Promotion rule
A repository PASS is necessary but insufficient. Any migration mismatch, failed staging migration, failed smoke test, missing recovery evidence, or unapproved release blocks production promotion.

## Rollback
- Do not improvise SQL rollback in production.
- Prefer forward corrective migrations for already-applied schema changes.
- For destructive incidents, use the documented recovery/PITR process and record restore evidence.
