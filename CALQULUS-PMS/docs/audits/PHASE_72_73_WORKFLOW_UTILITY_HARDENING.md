# CALQULUS PMS — Phases 72–73 Hardening Audit

## Phase 72 — Workflow orchestration
- Added SECURITY DEFINER RPCs for template, instance, step and automation mutations.
- Platform-admin authorization is evaluated server-side; clients no longer mutate workflow tables directly.
- Create/update and pause/resume/cancel/activate paths in `workflowOrchestration.ts` converge on the RPC layer.
- Authenticated/anonymous direct INSERT/UPDATE/DELETE privileges are revoked.

## Phase 73 — Utility connection and billing
- Added SECURITY DEFINER RPCs for utility connection and utility bill creation/update/status changes.
- Platform-admin authorization is evaluated server-side.
- `utilityProviders.ts` no longer performs direct utility connection/bill mutations.
- Authenticated/anonymous direct INSERT/UPDATE/DELETE privileges are revoked.

## Verification
- Static direct-mutation scan: required protected workflow/utility API surfaces contain zero direct writes.
- SQL function/grant/quote checks: pending local execution.
- `npm run audit:prod`: pending local execution.
- Vitest/typecheck/build depend on project dependencies being installed; do not infer success if unavailable.
- No live Supabase database was used.
