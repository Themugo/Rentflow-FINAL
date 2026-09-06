# Phases 104–105 — Authenticated Staging E2E + Live Release Evidence Hardening

## Phase 104
- Added `e2e/phase104-authenticated-isolation.spec.ts` for dedicated staging credentials.
- Covers manager, landlord, tenant and webhost authenticated portal smoke checks.
- Adds cross-role denial probes for privileged/foreign portals.
- Added `scripts/staging-e2e-evidence.mjs` and `staging:e2e`.
- No credentials are committed or written to evidence.
- Without a staging URL and dedicated test credentials, the command reports `EXTERNAL_REQUIRED`.

## Phase 105
- Added `scripts/capture-release-evidence.mjs` and `capture:release-evidence`.
- Automatically records the current Git commit and sanitized automated evidence.
- Added `scripts/audit-release-evidence.mjs` and `audit:release-evidence`.
- Release evidence fails closed until explicit staging migration, smoke, restore and production approval evidence is recorded.
- Go-live/release readiness now include authenticated E2E and release-evidence gates.
- No deployment, migration, destructive database, or approval action is performed automatically.

## Verification
- New JavaScript scripts pass `node --check` syntax validation.
- Existing production, security-boundary, cross-role, final-security, migration-chain, observability, edge-reliability, operations, deployment-control, staging-readiness and disaster-recovery audits pass.
- Authenticated E2E evidence is `EXTERNAL_REQUIRED` without dedicated staging credentials and `BASE_URL`/`SMOKE_BASE_URL`.
- Release-evidence gate is intentionally `BLOCKED` until external release commit, staging migration, authenticated smoke/E2E, restore and production approval evidence are recorded.
- `npm test`: blocked because `vitest` is not installed in the packaged workspace.
- `npm run typecheck:app`: blocked by missing project dependencies/types (React, React Query, router, Capacitor, etc.).
- `npm run build`: blocked because `vite` is not installed in the packaged workspace.
- No live Supabase database migration or production deployment was executed.
