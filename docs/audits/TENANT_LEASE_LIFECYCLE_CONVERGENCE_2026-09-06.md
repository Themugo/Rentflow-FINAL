# CALQULUS PMS — Tenant & Lease Lifecycle Convergence

## Initiative
Converge the tenant-to-lease operational experience around the existing transactional lifecycle instead of introducing another business-logic engine.

## Audit outcome
The repository already contains authoritative lifecycle RPCs for lease transitions, tenant/unit assignment and terminal move-out. The property-tenancy ecosystem migration also reconciles unit occupancy, tenant state, tenancy history and property projections transactionally.

## Implementation
- Added `TenantLifecycleCommandBar` to the manager tenant detail surface.
- Presents tenant location, lease end, rent, move-in date, collection balance and lifecycle state together.
- Highlights renewal/collection attention without inventing alerts or changing source data.
- Reuses the existing manager move-out permission and existing `MoveOutDialog` transaction.
- Contains no direct Supabase mutations, preventing a parallel lifecycle engine.

## Verification contract
The initiative must pass:
1. Tenant lifecycle component contract tests.
2. Existing manager operations, dashboard and auth tests.
3. TypeScript typecheck.
4. Production build.

## Source of truth
Business-state mutations remain in the established atomic Supabase lifecycle functions. UI components only orchestrate existing actions and display their resulting state.
