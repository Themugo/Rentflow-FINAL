# CALQULUS PMS — Final Release Candidate Preparation

## Purpose

This pass freezes the current commercial product into a reproducible release candidate without inventing live-environment evidence.

## Completed

- Generated `docs/audits/RELEASE_CANDIDATE_MANIFEST.json` with SHA-256 and byte counts for critical application, Edge Function, migration and deployment-control files.
- Captured repository migration inventory and duplicate-version groups.
- Added `npm run release:prepare` so the manifest can be regenerated whenever the candidate changes.
- Preserved the rule that release artifacts are immutable after certification.

## External gates before production

1. Use a clean Git checkout and record the exact release commit.
2. Query the target Supabase `supabase_migrations.schema_migrations` table.
3. Reconcile all duplicate migration versions before applying pending migrations.
4. Execute pending migrations in staging first.
5. Run staging smoke, role-isolation and payment-flow tests.
6. Execute and record a staging restore drill.
7. Promote the exact certified commit/artifact set to production.
8. Capture production migration, smoke-test and approval evidence.
9. Run the final release certificate against the recorded evidence.

## Safety rule

No migration is renamed, deleted, reordered or marked applied merely to make the repository audit green. Supabase migration history is deployment state and must be reconciled against the actual target database.

## Current status

The source candidate is prepared, but production promotion remains **EXTERNAL_REQUIRED** until the target environment supplies the live migration history and release evidence.
