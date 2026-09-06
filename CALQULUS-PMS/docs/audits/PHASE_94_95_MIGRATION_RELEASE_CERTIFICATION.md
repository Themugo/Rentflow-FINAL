# CALQULUS PMS — Phases 94–95 Migration Governance & Release Certification

## Phase 94 — Migration history governance

The repository contains historical duplicate Supabase migration versions. Rather than renaming them blindly, this phase adds:

- `config/migration-history-policy.json` — explicit, reviewable historical exceptions.
- `scripts/prepare-migration-repair-plan.mjs` — deterministic repair plan generator.
- `npm run audit:migration-repair-plan` — regenerates the plan.
- `audit:migration-chain` now fails only for **new/unacknowledged** duplicate or malformed versions while continuing to flag live reconciliation as an external deployment gate.

No historical migration was renamed or deleted.

## Phase 95 — Release security certificate

Added `scripts/audit-release-certificate.mjs` and `npm run audit:release-certificate`.

The certificate executes the production, security-boundary, cross-role, final-security and migration-chain audits together and writes `docs/audits/RELEASE_SECURITY_CERTIFICATE.json`.

The repository can now be certified as structurally ready while correctly distinguishing that certification from live-environment proof.

## Mandatory external proof before production

1. Compare the live `supabase_migrations.schema_migrations` history with `MIGRATION_REPAIR_PLAN.json`.
2. Resolve any unapplied duplicate migration by assigning a new monotonic migration version; do not rename an already-applied migration.
3. Apply the complete chain to a clean staging Supabase project.
4. Run role-isolation and security smoke tests using real staging roles.
5. Run the deployed application smoke test against the actual staging URL.

This separation prevents a repository-only audit from being represented as proof of live database correctness.
