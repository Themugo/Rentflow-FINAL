# Phase 56–57 — Payout & Dispute Financial Hardening

## Phase 56
- Re-hardened the canonical payout transition RPC.
- Webhost transitions are limited to payouts explicitly routed to `webhost`.
- Manager/submanager transitions remain portfolio-scoped.
- Landlords may only reject their own pending payout.
- Marking a payout paid requires a payment reference.
- Rejection requires a reason.
- Payment destination is snapshotted when a payout becomes paid.
- Net amount and management fee are calculated server-side.
- Direct authenticated payout INSERT/UPDATE/DELETE access is revoked.

## Phase 57
- Re-hardened dispute creation and resolution.
- Tenant authorization is tied to the tenant account/role relationship rather than assuming the tenant row UUID is the auth UUID.
- Managers/submanagers are restricted to their tenant portfolio.
- Invoice/tenant ownership is validated.
- Duplicate open disputes for the same tenant/case are rejected.
- Resolution requires a non-empty resolution note.
- Direct authenticated dispute INSERT/UPDATE/DELETE access is revoked.

## Verification
- SQL syntax/delimiter checks performed on changed migrations.
- Existing production audit and targeted mutation scans should be rerun in the user's fully installed project environment.
- No live Supabase database was available in this environment, so migrations were not executed against production.
