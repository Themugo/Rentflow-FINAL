# CALQULUS Golden Path — Phase 2 Audit

## Scope

Atomic lease creation in the Manager → Property → Unit → Tenant → Lease path.

## Changes

- Added `public.create_lease_atomic(...)`.
- Server resolves the authenticated manager; client `manager_id` is not trusted.
- Property, tenant, and unit ownership/relationship are validated inside the transaction.
- Overlapping pending/active leases on the same unit are rejected.
- Same-unit concurrent lease attempts are serialized with a transaction advisory lock.
- Lease insert, tenant denormalized billing/occupancy update, unit update, and tenant payment-detail sync occur in one transaction.
- Lease status is constrained to the supported lifecycle values.
- Authenticated clients can no longer bypass the workflow with direct `INSERT` on `public.leases`.
- `Leases.tsx` now calls the atomic RPC instead of performing independent writes.
- Supabase generated types include the new RPC.
- Added `supabase/tests/rls/golden_path_atomic_lease.sql`.

## Redundancy/dead-path check

- No direct `leases` INSERT remains in `src/`.
- No second client implementation of atomic lease creation was found.
- The existing `sync_tenant_payment_details` call in `AddTenantToPropertyDialog.tsx` belongs to tenant onboarding, not lease creation, so it was retained.
- Historical migration timestamp collisions remain untouched because renaming already-applied migrations is unsafe. They are documented technical debt, not duplicated migrations to be deleted.

## Verification performed

1. Static search confirms the Manager lease page has no direct `leases.insert`.
2. Static search confirms `create_lease_atomic` has one production caller and one database definition plus test/type references.
3. TypeScript compiler was invoked. A clean result could not be obtained because the ZIP has no installed dependencies and offline npm installation is missing `zod-validation-error@4.0.2`; the compiler therefore reports dependency/module errors unrelated to this phase.
4. Docker/Postgres is unavailable in this execution environment, so the SQL replay test could not be executed against PostgreSQL here. The test is included for local execution before deployment.
5. No package was declared release-ready on the basis of an unexecuted database test.

## Required local verification before merge

```bash
npm ci
npm run lint
npm run typecheck
npm run test:critical
npm run build
# Start the local Supabase/replay database used by the repository.
bash supabase/tests/harness/replay-migrations.sh
# Then run:
psql ... -f supabase/tests/rls/golden_path_atomic_lease.sql
```

## Phase 2 exit condition

Phase 2 is considered code-complete but **not production-verified** until the local Supabase migration replay and atomic lease SQL regression test pass.
