# Phase 45–46 — Operational Mutation Hardening

## Phase 45
Tenant screening and manager-to-tenant notices are now routed through server-authorized RPCs:
- tenant blacklist create/remove
- tenant notice create/draft/send record
- tenant notice acknowledgement

The RPCs validate authenticated identity, tenant/property ownership, valid status/severity values, and lock the target rows where state changes occur.

## Phase 46
Unit operational records are now routed through atomic RPCs:
- key issue/return
- unit amenity create/update/delete
- utility meter create/update/toggle/delete
- utility meter reading
- unit inspection create/update
- water billing configuration

Authenticated direct INSERT/UPDATE/DELETE privileges were revoked for the hardened operational tables. Existing water meter reading lifecycle RPCs remain in use.

## Verification
- `npm run audit:prod`: PASS
- Changed TS/TSX delimiter balance: PASS
- Migration function/dollar-quote structure: PASS
- Targeted production direct-mutation scan: PASS
- ZIP integrity: PASS
- Vitest/typecheck/build: BLOCKED because workspace dependencies are not installed in the recovered package; `npm ci --ignore-scripts` previously timed out.

Historical migrations may still contain older policy definitions because Supabase migrations are append-only. The final hardening migration changes the active privilege boundary with explicit REVOKE statements.
