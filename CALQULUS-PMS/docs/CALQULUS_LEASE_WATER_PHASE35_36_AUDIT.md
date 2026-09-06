# CALQULUS PMS — Phase 35–36 Audit

## Phase 35 — Lease lifecycle
- Added `transition_lease_atomic` with row locking, manager/submanager scope, active-unit conflict protection and synchronized unit occupancy state.
- Added `attach_lease_document_atomic` so document uploads remain functional after direct lease UPDATE is revoked.
- Authenticated direct INSERT/UPDATE/DELETE on `leases` is revoked.
- Existing atomic lease creation remains the sole lease creation path.

## Phase 36 — Water reading lifecycle
- Added `create_water_meter_reading_atomic` for manager and tenant reading submission.
- Server calculates consumption and total amount rather than trusting client totals.
- Tenant submissions are bound to the authenticated tenant and assigned unit.
- Added `transition_water_meter_reading_atomic` for manager verification, invoice linking, paid state and tenant disputes.
- Authenticated direct INSERT/UPDATE/DELETE on `water_meter_readings` is revoked.
- Water invoice creation continues through the canonical `create-invoice` path; reading-to-invoice linking is then performed atomically through the lifecycle RPC.

## Verification
- Direct lease mutation scan: PASS.
- Direct water reading mutation scan: PASS.
- Migration/RPC references: PASS.
- `npm run audit:prod`: PASS.
- Vitest/lint/typecheck/build: environment-blocked because workspace dependencies are not installed (`vitest`, `eslint`, `vite`, React/type packages unavailable).
