# Phase 88–89 Privileged Edge / Role Boundary Hardening

## Phase 88
- Added fail-closed rate limiting to the unauthenticated account-activation endpoint.
- Hardened `create-tenant` so authenticated managers/submanagers cannot combine a valid property with a unit outside that portfolio.
- Restricted internal SECURITY DEFINER trigger/background helpers from `anon`/`authenticated` execution.
- Restricted activation-token consumption to `service_role`; validation remains available for the bearer-token activation flow.
- Removed anonymous execution from sensitive payment/reconciliation helpers.

## Phase 89
- Added a deterministic static authorization regression audit.
- Audit checks edge functions for authentication/service-role gates, protected direct writes, and dangerous public function grants.
- Audit is designed to run without a live Supabase database.

## Verification limitations
TypeScript/Vitest/Vite require the project's missing dependencies and cannot be treated as passing in this isolated package. SQL is structurally checked; no live Supabase database is available in this session.

## Static verification
- `npm run audit:security-boundary`: PASS
- `npm run audit:prod`: PASS
- Changed Edge Function brace/parenthesis/bracket balance: PASS
- Sensitive anonymous EXECUTE scan: PASS
- No live database was available; migration execution is not claimed.
