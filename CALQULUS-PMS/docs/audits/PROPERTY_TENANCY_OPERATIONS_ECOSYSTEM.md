# CALQULUS PMS — Property & Tenancy Operations Ecosystem

**Initiative date:** 2026-09-04

## Objective

Make the operational chain authoritative and transactional across:

**Property → Unit → Tenant → Lease → Tenancy History → Occupancy/Revenue**

The initiative reuses the existing property, unit, tenant, lease and move-out UI rather than creating parallel data-fetching or CRUD architecture.

## Implemented

- Added a shared manager/submanager property-scope check for lifecycle operations.
- Added an authoritative property projection refresh that derives unit count, occupied count and active-lease monthly revenue from live records.
- Hardened `transition_lease_atomic` so activating a lease atomically opens tenancy history, activates the tenant, occupies the unit and refreshes property totals.
- Hardened lease termination/expiry so tenancy history is archived, the tenant becomes inactive when no other active lease remains, the unit becomes vacant when no active lease remains, and property totals are refreshed.
- Preserved idempotent lease status transitions.
- Prevented a tenant from having two active leases and a unit from having two active leases/tenancies.
- Changed tenant/unit assignment to be explicitly **pre-lease**: assignment no longer falsely marks a unit occupied.
- Hardened move-out authorization for manager scope and preserved historical tenancy records.
- Added data-safe unique-index creation: legacy duplicate data produces a migration notice instead of making the migration fail. The lifecycle RPCs still enforce the invariant for new operations.
- Revoked direct authenticated writes to lease, tenancy-history and activity-log lifecycle tables.
- Added regression coverage for lifecycle RPCs, occupancy semantics, uniqueness protections, counter reconciliation, history preservation and move-out scope wiring.

## Golden path

1. Create property.
2. Create/maintain units.
3. Assign a tenant to a unit if desired before leasing; assignment does not create occupancy.
4. Create a pending lease.
5. Activate the lease.
6. Activation creates/updates the active tenancy-history record, activates the tenant, marks the unit occupied and recalculates property occupancy/revenue.
7. Billing continues to use the existing lease/invoice architecture.
8. Tenant, manager and landlord portals continue to consume the existing scoped records.
9. Expiry/termination archives the lease and tenancy history and frees the unit when no replacement active lease exists.
10. Move-out preserves history and grants the configured post-move-out portal window.

## Verification

### Passed

- `node scripts/audit-property-tenancy-operations.mjs`
- SQL structural balance checks: parentheses and single-quote counts balanced.
- Touched-file brace balance checks.

### Environment limitation

The package does not contain a usable dependency installation. `npm ci --ignore-scripts --no-audit --no-fund` timed out while attempting installation. The global TypeScript compiler was available, but the project's dependency tree was incomplete; `tsc --noEmit -p tsconfig.app.json` therefore failed on missing type definitions (`react`, `node`, `chai`, `aria-query`, etc.). Vitest/ESLint binaries were not available.

Therefore **automated Vitest/typecheck/lint/build are not represented as passing**. The static initiative audit is the verified gate for this package.

## Changed files

- `supabase/migrations/20260904000001_property_tenancy_operations_ecosystem.sql`
- `src/features/tenants/components/MoveOutDialog.tsx`
- `src/test/propertyTenancyOperationsIntegrity.test.ts`
- `scripts/audit-property-tenancy-operations.mjs`
- `package.json`
- `CHANGELOG.md`
- `docs/audits/PROPERTY_TENANCY_OPERATIONS_ECOSYSTEM.md`
