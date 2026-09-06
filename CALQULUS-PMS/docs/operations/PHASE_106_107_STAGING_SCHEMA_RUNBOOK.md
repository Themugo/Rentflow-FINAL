# Phase 106–107 — Staging Bootstrap & Migration/Schema Verification

## Phase 106
Prepare a dedicated non-production staging origin and role accounts through environment variables only. Required variables are `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SMOKE_BASE_URL`, plus the existing authenticated E2E account variables.

Run:
- `npm run audit:staging-bootstrap`
- `npm run staging:smoke`
- `npm run staging:e2e`

No credentials are committed and no script provisions users automatically.

## Phase 107
Run migration verification with `DATABASE_URL` or `SUPABASE_DB_URL`. The tool compares repository migration filenames with `supabase_migrations.schema_migrations`. Migration file SHA-256 hashes are recorded in `docs/audits/MIGRATION_FILE_INTEGRITY.json` and changes to previously baselined files fail the gate.

Run:
- `npm run verify:migration-integrity`
- `npm run audit:schema-drift`

Schema drift is fail-closed only after a reviewed `config/schema-drift-baseline.json` exists. Without live DB access or a reviewed baseline, the tools report `EXTERNAL_REQUIRED` rather than inventing evidence.

## Safety
These phases never run destructive SQL, never apply migrations, never create credentials, and never store secrets in evidence files. Production deployment remains separately approval-gated.
