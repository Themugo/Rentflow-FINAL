# CALQULUS PMS — Phase 43–44 Tenant & Property Financial Hardening

## Phase 43
Tenant profile and transfer mutations are now server-authorized atomic RPCs. Tenant profile updates lock the tenant row and only permit the tenant's manager/submanager scope. Transfers lock the tenant, destination property and destination unit, reject inactive/occupied units, synchronize manager/property/unit fields, and create the transfer history record atomically.

The move-out flow no longer performs a second client-side `tenant_history` insert after `complete_unit_moveout`; the lifecycle operation remains server-owned and avoids duplicate history writes.

## Phase 44
Property billing configuration, property deductions, and property amenity charges now use atomic RPCs. The RPCs validate property scope, billing modes/dates/penalties, deduction types/amounts, and unit ownership. Direct authenticated INSERT/UPDATE/DELETE access is revoked for these financial configuration tables.

## Verification
- `npm run audit:prod`: PASS.
- Production source mutation scan for Phase 43–44 target tables: PASS; remaining matches are unrelated tenant screening/notices or test code.
- Migration delimiter/function/grant structural checks: PASS.
- Full TypeScript build/test suite: BLOCKED by the current workspace dependency installation; `tsc` reports missing React/React Router/React Query and other package type declarations. No claim of full build/test success is made.
