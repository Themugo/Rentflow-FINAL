# CALQULUS PMS — Production Schema Reconciliation & Release Guard

## Initiative
Fail closed when the production Supabase schema is not reconciled with the repository migration chain before a production deployment can proceed.

## Live finding — 2026-09-06
The linked Supabase project `hmgpltrjlsescfquqxeg` currently reports **3 applied migrations**, while the packaged repository contains **243 SQL migration files**. The remote migration history is therefore materially behind the repository and must not be treated as production-ready.

Applied remotely:
- `20260904064824_calqulus_bootstrap_baseline`
- `20260904065349_remove_bootstrap_marker`
- `20260904090738_verify_next_batch_control_center_schema`

Latest repository migration: `20260906000013`.

## Implementation
- Production GitHub deployment workflow now runs `npm run gate:reconciliation` before typecheck, tests and build.
- The workflow requires `SUPABASE_ACCESS_TOKEN` through GitHub Actions secrets for the linked Supabase project.
- Added `audit:deployment-workflow` static guard.
- Added regression coverage proving the live migration gate precedes the production build pipeline.
- Existing reconciliation logic remains non-destructive: it never edits migration history or resets production.

## Safety policy
No production migrations were applied by this initiative. Applying the pending chain is a separate controlled deployment action requiring explicit production credentials, review of the dry-run, and a fixed release commit.

## Release state
**BLOCKED until live migration reconciliation is resolved.**
