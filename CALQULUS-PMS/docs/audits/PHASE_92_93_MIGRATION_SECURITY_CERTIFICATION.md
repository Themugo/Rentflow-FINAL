# CALQULUS PMS — Phases 92–93 Migration & Final Security Certification

## Phase 92 — Migration-chain integrity

Added `scripts/audit-migration-chain.mjs` and `npm run audit:migration-chain`.
The audit validates migration filename shape, detects duplicate migration versions, and reports phase/version ordering ambiguities.

### Important release finding
The repository contains historical duplicate migration versions, including `20260903000029` used by both the Phase 58 wallet migration and Phase 70/71 platform-admin/tier migration. Other duplicate version groups remain in the historical chain.

These are **not automatically renamed** because changing an already-applied Supabase migration version can make the local migration history diverge from `supabase_migrations.schema_migrations`. Reconciliation must be performed against the actual production migration history before a fresh or production migration run.

Phase 92 therefore treats duplicate versions as a **deployment gate**, not something to silently rewrite.

## Phase 93 — final residual security regression guard

Added `scripts/audit-final-security.mjs` and `npm run audit:final-security`.
It scans non-test application source for direct mutations against hardened protected tables, checks sensitive RPC grants against `anon`, and rejects broad public storage writes / unexpected broad authenticated storage reads.

The latest self-registration RPC is also explicitly hardened with `search_path = public, pg_temp`.

## Verification contract

Run from the repository root:

```cmd
npm run audit:prod
npm run audit:cross-role
npm run audit:security-boundary
npm run audit:final-security
npm run audit:migration-chain
npm test
npm run typecheck:app
npm run build
```

`npm test`, TypeScript and Vite build remain environment-dependent if project dependencies are not installed.
No live Supabase database was available during this phase, so migration execution and production schema parity remain unverified.
