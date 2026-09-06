# Phases 41–42 — Direct-Mutation Convergence

## Scope

These phases continue the mutation-hardening program by moving two high-risk multi-table client workflows behind server-side atomic RPCs:

- **Phase 41:** landlord management-team membership and submanager bridge synchronization.
- **Phase 42:** tenant payment-payer lifecycle.

The goal is to prevent partial writes, client-controlled ownership fields, and authorization gaps created by sequences of direct table mutations.

## Phase 41

`save_landlord_team_member_atomic` now performs, in one transaction:

- landlord ownership verification through `property_landlords`;
- validation that assigned properties belong to the landlord;
- landlord team upsert;
- manager/submanager bridge synchronization;
- submanager permissions synchronization;
- assigned-property replacement;
- submanager role approval.

`remove_landlord_team_member_atomic` locks and removes the team member and cleans the corresponding submanager bridge, permissions, assignments, and role.

The UI no longer directly mutates `landlord_team_members`, `manager_submanagers`, `submanager_permissions`, `submanager_property_assignments`, or `user_roles` for this workflow.

## Phase 42

Payment-payer creation/update is handled by `save_payment_payer_atomic`; active-state changes and deletion use dedicated transition/delete RPCs.

Authorization is resolved server-side from the tenant's manager relationship or a landlord relationship to the tenant's property. The client cannot choose an arbitrary `manager_id` and obtain access to an unrelated tenant.

The UI no longer directly mutates `payment_payers`.

## Verification

- Production audit: **PASS** (`npm run audit:prod`).
- Changed TypeScript delimiter balance: **PASS**.
- Migration delimiter/function structure: **PASS**.
- Target-table direct mutation scan excluding tests: **PASS** — no direct client `.insert/.update/.delete/.upsert` remains for the hardened target tables.
- Full Vitest/typecheck/build: **BLOCKED** because workspace dependencies are not installed; prior `npm ci --ignore-scripts` did not complete within the available execution window. No dependency-dependent test suite is claimed as passing.

Historical migration files remain append-only and may contain the original policy definitions. The new migration changes the active grants/policies rather than rewriting migration history.
