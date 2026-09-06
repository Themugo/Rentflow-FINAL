# CALQULUS PMS — Phases 82–83 Mutation Hardening

## Scope

Phase 82 converges broadcast campaign/message/in-app notification creation and campaign completion behind SECURITY DEFINER RPCs. Phase 83 converges tenant invitation acceptance/deletion, rent report scheduling, manager vacation-notice transitions, lease tenant assignment, and manager platform-contract signing.

## Security controls

- Authenticated identity is derived with `auth.uid()`; clients cannot supply a different manager identity.
- Broadcast recipients are checked against the manager/submanager portfolio before rows are created.
- Broadcast campaign and per-tenant message rows are created in one database transaction, with in-app notifications created through the existing notification RPC.
- Campaign completion locks the campaign row and is owner-scoped.
- Tenant invitation acceptance validates pending/expiry state and authenticated account email.
- Invitation deletion is manager/property scoped.
- Report schedules are manager-owned, one-row-per-manager, and recipient emails are validated server-side.
- Vacation notice transitions are manager-owned and server-stamp acknowledgement actor/time.
- Lease tenant assignment validates manager, property and unit alignment and blocks replacement of an active lease tenant.
- Manager contract signing derives signer identity from the authenticated manager and records server-side signing time.
- Direct authenticated INSERT/UPDATE/DELETE access is revoked from all hardened tables.

## Verification

- Production audit: PASS (`npm run audit:prod`).
- SQL dollar-quote balance: PASS.
- Changed TS/TSX brace/parenthesis balance: PASS.
- Targeted residual direct mutation scan: PASS (no remaining direct DML in the hardened source surfaces).
- Live Supabase migration application: NOT RUN — no live database connection is available in this session.
- Vitest/typecheck/build: environment-blocked where project dependencies are unavailable; no blocked command is reported as passing.

## Known architectural note

External Auth user creation remains outside a Postgres transaction when tenant registration is performed through `supabase.auth.signUp()`. The invitation acceptance mutation itself is atomic after authentication exists.
