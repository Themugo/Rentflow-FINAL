# Phases 110–111 — Live Certification Runbook

## Phase 110 — Authenticated staging role certification

Provide a dedicated staging origin and four non-production accounts through environment variables only:

- `STAGING_BASE_URL` (or `BASE_URL`)
- `E2E_MANAGER_EMAIL` / `E2E_MANAGER_PASSWORD`
- `E2E_LANDLORD_EMAIL` / `E2E_LANDLORD_PASSWORD`
- `E2E_TENANT_EMAIL` / `E2E_TENANT_PASSWORD`
- `E2E_WEBHOST_EMAIL` / `E2E_WEBHOST_PASSWORD`

Run `npm run staging:certify`.

The runner executes the existing authenticated portal and cross-role isolation suite. Credentials are never written to evidence. A missing staging origin, missing role credential, or missing local Playwright executable is reported as `EXTERNAL_REQUIRED`, not a fabricated pass.

## Phase 111 — Live schema/RLS evidence aggregation

Provide `DATABASE_URL` or `SUPABASE_DB_URL` for a read-only PostgreSQL connection to the staging database.

Run `npm run capture:live-security`.

The command aggregates:
- migration file integrity vs live migration history;
- live schema drift inventory;
- RLS/policy/direct-write-grant checks;
- live migration reconciliation.

No migrations are applied and no destructive SQL is executed by this phase. Only status-level evidence is persisted by the aggregator.

## Certification rule

`PASS` requires every live check to pass. Missing external access remains `EXTERNAL_REQUIRED`. Any observed failure is `FAIL` and blocks certification.
