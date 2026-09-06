# Agency Operations Desk — Full Reconciliation

Date: 2026-09-06

## Finding

The Agency portal had a strong landlord-first UX and financial-control foundation, but its portfolio and activity surfaces still inherited a Manager-owned data access assumption.

The Agency shell permits an Agency role and the configuration layer already understands active `agency_members`, yet the portfolio hook queried `properties`, `property_landlords`, `invoices`, `leases`, and `tenants` directly with `manager_id = auth.uid()`. That works for the Agency head when the head is the property manager, but it does not provide a correct Agency-wide read path for an active Agency member.

The dashboard also reused `ManagerActivityLog`, which explicitly filters `activity_logs.manager_id` to the signed-in user. That is Manager semantics inside the Agency portal.

## Implementation

1. Added `get_agency_portfolio_snapshot()` as a membership-validated, read-only server-side snapshot.
2. The snapshot resolves the Agency through `agency_id_for_user(auth.uid())`, validates the current Agency head/member relationship, then reads the Agency head's property book and associated landlord, tenant, invoice and lease data.
3. Reworked `useAgencyPortfolio()` to consume the canonical Agency snapshot rather than five Manager-scoped table queries.
4. Added `get_agency_activity_log()` with Agency-level permission checks and optional landlord/property scoping.
5. Replaced the Manager activity component on the Agency dashboard and client workspace with `AgencyActivityLog`.
6. Replaced Manager-only relationship/profile and invoice/property lookups in Agency controls and payment evidence setup with canonical Agency RPC/snapshot paths.
7. Added regression coverage for the Agency-wide scope, activity, controls and financial option boundaries.

## Security posture

The snapshot functions use a pinned `search_path`, require authentication, validate Agency membership before reading, and are not callable by `anon`/`PUBLIC`.

No production migration was applied. The existing production reconciliation gate remains the release blocker until the migration chain is reconciled in the controlled deployment process.

## Verification

Static source verification was added in `src/test/agencyOperationsDeskScopeReconciliation.test.ts`.

Full Windows Vitest/typecheck/build execution remains required before commit/push.
