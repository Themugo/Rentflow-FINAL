# Phases 108–109 — Live Staging & Database Security Validation

## Phase 108 — staging connectivity

Run with dedicated staging values only:

```text
STAGING_BASE_URL=https://staging.example
STAGING_SUPABASE_URL=https://project.supabase.co
STAGING_SUPABASE_ANON_KEY=<publishable-key>
npm run audit:staging-connectivity
```

The audit records status codes and latency only. Secrets are never written to evidence.

## Phase 109 — live RLS verification

Run from a controlled operator environment with a read-only PostgreSQL connection:

```text
DATABASE_URL=<read-only-staging-db-url>
npm run audit:live-rls
```

The query checks RLS, policy presence and anonymous/authenticated direct write grants across the hardened application surface.

### Safety

- No destructive SQL is executed.
- No migration is applied automatically.
- No credentials are created.
- Production promotion remains approval-gated.
- A missing external connection produces `EXTERNAL_REQUIRED`, not fabricated evidence.
