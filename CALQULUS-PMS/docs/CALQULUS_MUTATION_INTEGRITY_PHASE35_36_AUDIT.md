# CALQULUS PMS — Phase 35–36 Mutation Integrity Audit

## Phase 35 — Contract + lease lifecycle enforcement

Authenticated contract mutations are routed through `create_contract_atomic` and `transition_contract_atomic`. The contract RPC derives manager scope from the caller's effective manager and the linked lease, locks the contract row, validates role and terminal-state rules, and controls creation, approval submission, approval, manager signing, tenant signing, document attachment, status transitions, and soft termination.

Lease status changes, document attachment, and tenant assignment now use `transition_lease_atomic`, `attach_lease_document_atomic`, and `assign_lease_tenant_atomic`. Direct authenticated `UPDATE` on leases and direct authenticated `INSERT/UPDATE/DELETE` on contracts are revoked.

## Phase 36 — Water + utility lifecycle enforcement

Water configuration, manager meter readings, tenant meter submissions, disputes, and invoice linkage now use database-controlled RPCs with manager/tenant scope checks, row locks, meter monotonicity checks, duplicate-date protection, and invoice ownership validation.

Unit-level utility meter creation/update, readings, activation, and deletion are also routed through atomic RPCs. Direct authenticated writes to `water_billing_config`, `water_meter_readings`, and `unit_utility_meters` are revoked.

## Repository sweep findings

The active property-management mutation paths for contracts, leases, water billing, expenditures, and unit utility meters no longer perform direct table mutations from the client. Contract templates remain direct CRUD because they are configuration records rather than contract lifecycle records. The legacy contractor marketplace service contains direct work-order/bid mutations but has no active route/import and was not resurrected or expanded.

## Verification

- `npm run audit:prod` — PASSED.
- Static active-source mutation sweep — PASSED for target lifecycle tables.
- RPC/type reference audit — PASSED.
- Migration structure/enforcement audit — PASSED.
- Dependency-dependent Vitest/ESLint/Vite/TypeScript checks — BLOCKED because the uploaded workspace has no usable installed dependency binaries; `npm ci` timed out in the execution environment.
