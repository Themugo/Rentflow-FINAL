# Phase 39–40 — Property/Unit + Landlord Relationship Hardening

## Phase 39

The manager-facing property/unit lifecycle now uses SECURITY DEFINER PostgreSQL RPCs for:

- property creation
- property editing
- property activation/deactivation
- unit creation/editing
- unit activation/deactivation
- tenant → property/unit assignment
- tenant unassignment

Authorization is enforced inside the RPCs. Property/unit operations use row locking for mutation-sensitive records and reject duplicate unit numbers within a property. Occupancy is not manually maintained by the client; existing tenant/unit/property triggers remain the source of truth.

Authenticated direct INSERT/UPDATE/DELETE privileges were revoked from `properties` and `units`; SELECT access remains policy-controlled.

## Phase 40

Landlord relationship mutations now use atomic RPCs for:

- linking an existing landlord to a property
- creating a landlord invitation
- unlinking a landlord
- operating-model changes
- revenue-share configuration
- management-fee configuration
- delegated-manager configuration
- property operator synchronization

Manager/property/landlord authorization is enforced server-side. Authenticated direct INSERT/UPDATE/DELETE privileges were revoked from `property_landlords` and `landlord_invitations`.

## Verification

Passed in the recovery workspace:

- production audit (`npm run audit:prod`)
- changed-file delimiter/bracket checks
- migration dollar-quote/function-count checks
- repository-wide client mutation scan for the Phase 39–40 target tables

Blocked:

- Vitest execution: workspace dependencies are not installed; the attempted `npm ci --ignore-scripts` did not complete in the available execution window.
- Full TypeScript/build verification was therefore not claimed as passed.

## Migration

`supabase/migrations/20260903000018_property_landlord_relationship_atomic.sql`

## Notes

The repository's historical migration files still contain the older policy definitions because migrations are append-only. The Phase 40 migration explicitly drops the authenticated manager mutation policies before recreating SELECT-only manager policies. Legacy textual audit findings should therefore be interpreted against the final migration state, not as proof that the dropped policies remain active.
