# Phase 5 — Property → Unit → Tenant → Lease Golden Path Certification

**Date:** 2026-08-22
**Method:** Walked the full onboarding chain (Property → Unit → Tenant → Lease) against the replayed 83-migration schema as the service role (mirroring `create-tenant-account`), asserting occupancy auto-sync, referential integrity, and ledger preservation at each hop.
**Scope:** Onboarding chain integrity, occupancy triggers, delete semantics, financial-ledger orphaning.

## Verdict: PASS (local certification) — 2 data-integrity defect classes fixed

The onboarding chain and its occupancy auto-sync work correctly. Two classes of
**silent data-orphaning defects** (everything was `ON DELETE SET NULL`) were found
and fixed.

---

## 1. Golden path — all hops verified

| Gate | Behavior | Result |
|------|----------|--------|
| G1 | Manager creates property (`units` capacity, `occupied=0`, `status=active`) | ✅ |
| G2 | Unit added `vacant`; property `occupied` still 0 | ✅ |
| G3 | Tenant assigned to unit → trigger auto-marks unit `occupied`, property `occupied=1` | ✅ |
| G4 | Lease links tenant+unit+property; all FK references resolve (JOIN returns 1 row) | ✅ |
| G5 | Lease's `unit_id` belongs to its `property_id` (cross-entity consistency) | ✅ |
| G6 | Tenant `vacated` → unit auto-freed, property `occupied` back to 0 | ✅ |

Occupancy is **fully trigger-driven** and correct: `trg_sync_unit_on_tenant` (tenants→units)
handles insert/move-out/transfer; `trg_sync_property_occupied` (units→properties) recalculates
the property `occupied` count from live units. Both verified firing and idempotent.

## 2. DEFECT FIXED — golden-path deletes silently orphaned dependents

All core onboarding FKs were `ON DELETE SET NULL`. Deleting a unit/property/tenant
**silently NULLed** the link on dependent tenants/leases instead of erroring. Verified
in test G7 (before fix): deleting a unit with an active tenant **succeeded**, leaving the
tenant unitless — no error.

**Fix (`20260822000003`):** RESTRICT on `tenants.unit_id`, `tenants.property_id`,
`leases.tenant_id`, `leases.unit_id`, `leases.property_id`. Deleting a unit/property/tenant
that still has dependents now raises an FK violation, forcing dependents to be resolved
first (vacate/terminate) — correct behavior for an audit-sensitive property ledger.

`seed-demo-data` cleanup already deletes in dependency order (leases → tenants → units),
so it is unaffected.

## 3. DEFECT FIXED — financial ledger orphaned by tenant delete

`invoices`, `payment_transactions`, and `payment_allocations` all referenced tenants with
`ON DELETE SET NULL`. Deleting a tenant orphaned its financial ledger — payments and
invoices with no payer, silently.

**Fix (`20260822000004`):** RESTRICT on those three `tenant_id` FKs. A tenant with any
invoice / payment transaction / allocation cannot be deleted until the records are
resolved — the ledger can no longer be silently lost. Verified by test G8.

(Reference tables with deliberate `ON DELETE CASCADE` — `payment_receipts`,
`tenant_credit_ledger`, `arrears_schedule` — intentionally follow the tenant and were
left unchanged.)

## 4. Legacy `payments` table

`payments` is a legacy table with **no foreign keys** (fully decoupled). It is written only
by `create-manager-invoice-checkout` (platform billing, manager-scoped, no tenant link).
The authoritative tenant ledger is `payment_transactions` + `payment_allocations` (now
RESTRICT-protected). No change needed; `payments` intentionally left decoupled.

## 5. Manager onboarding flow (`create-tenant-account`)

Reviewed the 571-line edge function. It correctly:
- Creates/links the auth user with an activation-token flow (random password, email_confirm).
- Looks up or auto-creates the unit, marks it occupied, recalculates `properties.occupied`.
- Inserts the tenant linked to manager + unit.
- Upserts `user_roles` with `role=tenant, tenant_id`.
- Syncs payment details via `sync_tenant_payment_details` RPC (paybill from manager's M-Pesa settings).

Caveat (noted, not a blocker): the function performs sequential inserts without an
enclosing DB transaction, so a mid-way failure can leave partial rows (auth user,
activation, unit) orphaned. It does attempt auth-user cleanup on tenant-insert failure,
but unit/occupancy rollback is not guaranteed. Recommend wrapping in a single
transactional RPC in a future phase (Phase 6 error-handling / Phase 8 edge functions).

## 6. Gate check

| Gate | Result |
|------|--------|
| `replay-migrations.sh` | 83/83 pass |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 904 passed / 1 skipped (905) |
| Golden-path invariants (G1–G8) | all pass against real schema |
| Silent-orphan defect (G7, before) | reproduced → fixed → re-verified |
| Ledger-orphan defect (G8, before) | reproduced → fixed → re-verified |

Evidence: `supabase/tests/rls/golden_path_property_unit_tenant_lease.sql` (8 gates).

## 7. Not certified (out of scope / pending)

- **Live application**: `20260822000003` and `20260822000004` exist only as migrations;
  the live Supabase project must receive them. Both are `ALTER TABLE ... DROP/ADD CONSTRAINT`
  — safe, but should run in a low-traffic window as they briefly lock the tables.
- **End-to-end UI onboarding**: golden path verified at the DB/RPC layer; the full
  manager-clicks-invite → tenant-signs-up → lease-active browser flow is Phase 24 E2E.
- **Onboarding atomicity**: see §5 caveat; `create-tenant-account` not yet wrapped in a
  single transaction.
