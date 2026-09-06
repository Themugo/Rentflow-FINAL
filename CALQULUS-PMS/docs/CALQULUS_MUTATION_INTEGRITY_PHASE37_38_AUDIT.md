# CALQULUS PMS — Phase 37–38 Mutation Integrity Audit

## Scope

Core portfolio lifecycle integrity: properties, units, unit charge configuration, and tenant-to-unit assignment.

## Phase 37 — Property + Unit lifecycle

- Added `save_property_atomic` for create/update.
- Added `deactivate_property_atomic`.
- Added `save_unit_atomic` for create/update.
- Added `deactivate_unit_atomic`.
- Property tier/category enforcement now occurs inside the property mutation transaction.
- Manager/effective-manager scope is validated server-side.
- Property and unit rows are locked during lifecycle mutations.
- Unit number collisions are rejected under the locked property scope.
- Unit rent charge creation/update is performed inside the same transaction as the unit mutation.
- Direct authenticated INSERT/UPDATE/DELETE privileges were revoked from `properties`, `units`, and `unit_charge_configs`.

## Phase 38 — Assignment + charge configuration

- Added `assign_tenant_to_unit_atomic`.
- Added `unassign_tenant_from_unit_atomic`.
- Assignment validates manager, property, tenant, and unit scope and prevents assignment to an inactive or already-occupied unit.
- Unassignment vacates the unit only when no other active tenant remains.
- Added `save_unit_charge_config_atomic`.
- Added `set_unit_charge_active_atomic`.
- Added `delete_unit_charge_atomic`.
- Charge amounts, types, labels, billing cycles, and ownership are validated server-side.
- Active property-detail tenant assignment now uses the atomic assignment RPC.
- Active unit billing configuration UI now uses atomic charge RPCs.

## Active-source sweep

After these changes, no remaining active feature code was found directly mutating `properties`, `units`, or `unit_charge_configs` through Supabase table INSERT/UPDATE/DELETE calls. Remaining matches involving these table names are reads, tests, or files that also reference unrelated tables.

Legacy contractor-marketplace mutation code remains outside the active route/import graph and was intentionally not resurrected.

## Verification

- `node scripts/audit-production.mjs` — PASSED.
- Targeted source mutation sweep — PASSED.
- RPC/type reference checks — PASSED.
- Full Vitest/ESLint/TypeScript/Vite verification remains dependency-blocked because the workspace does not contain `node_modules` and dependency installation is unavailable in the execution environment.
