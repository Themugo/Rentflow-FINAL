# CALQULUS PMS — Phases 102–103 Deployment & Evidence Runbook

## Phase 102 — Environment and Deployment Preflight

Run before any promotion:

```bash
npm run audit:production-environment
npm run deploy:preflight -- --dry-run
```

The preflight is deliberately non-destructive. It does not deploy, create users, expose secrets, or mutate Supabase.

Production client configuration must be supplied through the hosting platform. Never commit `.env.local`, service keys, database URLs, payment secrets, or E2E credentials.

For a real deployment, use the approved CI/hosting pipeline and controlled Supabase credentials. Migration application must be followed by live reconciliation.

## Phase 103 — Staging Smoke and Release Evidence

Set the staging origin and run:

```bash
set SMOKE_BASE_URL=https://staging.example.com
npm run staging:smoke
npm run audit:production-evidence
```

PowerShell equivalent:

```powershell
$env:SMOKE_BASE_URL='https://staging.example.com'
npm run staging:smoke
npm run audit:production-evidence
```

The smoke script checks public availability, SPA shell integrity, basic content type, latency, and correlation headers where exposed. It does not authenticate as a user or bypass authorization.

### Required external evidence before GO

1. Exact release commit deployed.
2. Staging migration execution and live migration reconciliation.
3. Staging public smoke result.
4. Staging restore/recovery drill result.
5. Authenticated role-isolation/E2E result using dedicated staging accounts.
6. Production deployment approval.
7. Production smoke result.

A repository audit passing is **not** equivalent to production deployment success.
