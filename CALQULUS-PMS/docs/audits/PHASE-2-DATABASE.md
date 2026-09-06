# Phase 2 — Database Certification Report

**Date:** 2026-08-22
**Phase status:** ✅ CERTIFIED — all 78 migrations replay clean on a fresh database
**Environment:** local Docker `supabase/postgres:15.8.1.085` (matches Supabase PG 15.x), replayed as `supabase_admin` superuser

## Verdict

**78/78 migrations replay successfully on a clean database**, down from 68/78 at
Phase 2 start (10 failing). The remaining duplicate-definition investigations are
closed (see below). Frontend verification still green: `tsc --noEmit` OK,
904 tests passed / 1 skipped (905 total, vitest exit 0).

Post-replay schema sanity (inside the fresh DB):
- 127 tables, 296 RLS policies, 79 functions in `public`
- 6 subscription tiers seeded (`starter, lite, growth, pro, professional, enterprise`)

## Replay harness (new, test-only)

- `supabase/tests/harness/replay-migrations.sh` — drops `public` schema, applies
  shim + every migration via `psql -v ON_ERROR_STOP=1`, logs PASS/FAIL per file.
- `supabase/tests/harness/000_local_replay_shim.sql` — stubs for things that only
  exist on hosted Supabase (`auth.supabase()` family, `storage.buckets` extra
  columns like `file_size_limit` / `allowed_mime_types` / `avif_autodetection`).
  **This is never shipped as a migration** — it exists only so the local replay
  run can execute hosted-only statements.

## Migration fixes applied

### `20230101000000_base_schema.sql`
- Existence guards wrapping later-created tables in `DELETE`/`ALTER` statements
  (`bank_transactions`, `payment_allocations`, `bank_integration_settings`,
  `property_billing_config`) and 4 `payment_allocations` FK blocks guarded by
  `pg_constraint` checks (was already partly patched in Phase 2 session start;
  the remaining unguarded references are now resolved).
- `subscription_tiers`: `is_active` now `DEFAULT true`, `created_at` now
  `DEFAULT now()` so later tier-seed `INSERT`s don't violate NOT NULL.
- `subscription_tiers` `tier_key` index upgraded to **UNIQUE** and
  `manager_profiles.manager_user_id` index upgraded to **UNIQUE** — required by
  `ON CONFLICT` upserts in migration 14 (see duplicate-definition section).
- `physical_invoices` / `physical_receipts` / `payment_payers` policies in
  `20260728000000` rewritten to use the actual direct columns (`manager_id`) or
  `user_roles.tenant_id` instead of phantom `invoice_id` columns.

### `20260506000023_missing_platform_tables.sql`
- `escalate_overdue_manager_invoices()`: this migration re-defined the function
  as `RETURNS void`, but migration `20260506000017` already defines the full
  escalation logic as `RETURNS integer` (UI reads a count). `CREATE OR REPLACE`
  cannot change a return type, so migration 23 now **only creates a guarded
  minimal fallback** if the function does not already exist. Net behavior
  preserved (migration 17's version wins when applied in order).

### `20260529000000_final_production_hardening.sql`
- Invalid `CREATE POLICY IF NOT EXISTS` (×2, on `storage.objects`) converted to
  `DROP POLICY IF EXISTS` + `CREATE POLICY`.
- `landlord_invoices` policy rewritten: it referenced a non-existent
  `manager_id` column. Landlord invoices are webhost→landlord billing, so the
  read policy is now `webhost_user_id = auth.uid()` (renamed "Webhosts can read
  landlord_invoices").

### `20260728000000_security_audit_fixes.sql`
- Invalid `CREATE POLICY IF NOT EXISTS` (×1) converted to DROP+CREATE.
- `physical_invoices`, `physical_receipts`, `payment_payers` policies rewritten
  (see base-schema bullet).
- `COMMENT ON FUNCTION public.log_activity(...)` now uses the full signature —
  required because migration 13 and this migration overload the name.
- `storage.objects` INSERT policy `Users_can_insert_own_objects` previously
  collided with an earlier underscored-name policy; added `DROP IF EXISTS` for
  the underscored name too.

### `20260728000001_comprehensive_security_audit_fixes.sql`
- `CREATE INDEX IF EXISTS` → `CREATE INDEX IF NOT EXISTS` (syntax error).
- `idx_activity_logs_user_action` changed from `user_id` to `actor_id`
  (activity_logs has no `user_id` column).
- `idx_activity_logs_resource` changed from `(resource_type, resource_id)` to
  `(entity_type, entity_id)` (activity_logs has no resource_* columns).
- `idx_rate_limits_window` partial predicate on `now()` removed (index
  predicates must be IMMUTABLE; a plain `window_start` index serves the same
  range cleanup queries).
- `GRANT EXECUTE` lines referencing zero-arg or fewer-arg signatures of
  functions whose optional params have `DEFAULT`s removed (DEFAULTs do not
  create additional identities for GRANT): `can_access_property`,
  `get_tenant_manager_id`, `check_idempotency_key`, `log_security_event`.
- `log_security_event(...)`:
  - Parameter-level `CHECK` constraint removed (not permitted by PostgreSQL);
    severity validated in the body instead.
  - Body rewritten to use real `activity_logs` columns
    (`actor_id` / `actor_role` / `entity_type` / `metadata`) instead of
    `user_id` / `resource_type` / `details` (which belong to `audit_logs`).

### `20260728000002_atomic_payment_processing.sql`
- Duplicate-object DO block that attempted `ALTER TABLE ... ADD CONSTRAINT
  UNIQUE (...) WHERE ...` removed (PostgreSQL has no partial constraints).
  Replaced with `CREATE UNIQUE INDEX IF NOT EXISTS` partial indexes
  (`payment_tx_idempotent_key_unique`, `payment_tx_ref_tenant_unique`).

### `20260811000002_storage_security_hardening.sql` & `20260819000002_phase3_leftover_hardening.sql`
- All `CREATE POLICY ... ON storage.objects` statements now preceded by
  `DROP POLICY IF EXISTS` (16 + 3 guards) — re-running either file no longer
  collides with earlier-created same-name policies.

## Duplicate / conflicting definitions — resolved

- **`subscription_tiers`** was created in the base schema (without UNIQUE
  `tier_key`) and again in migration `20260506000014` (with UNIQUE `tier_key`).
  `CREATE TABLE IF NOT EXISTS` in migration 14 skips when base has created it,
  then the `ON CONFLICT (tier_key)` upsert failed. Fixed by making the base
  index UNIQUE (and giving `is_active` / `created_at` defaults) — both
  definitions now agree.
- **`manager_profiles`** same class of issue on `manager_user_id`; base index
  upgraded to UNIQUE so migration 14's `ON CONFLICT (manager_user_id)` upsert
  succeeds.
- **`unit_payment_summary`** view — investigated; both `leases.monthly_rent`
  and `units.monthly_rent` exist in the base schema, so
  `COALESCE(l.monthly_rent, u.monthly_rent)` is valid as written. No change
  required.
- **`escalate_overdue_manager_invoices()`** — the functional `RETURNS integer`
  version from migration 17 is the keeper; migration 23's void re-definition
  now skipped (see above).
- **`log_activity` overloads** — migration 13 creates a 7-arg version and
  migration `20260728000000` creates a 4-arg version. Both exist
  intentionally; `COMMENT`/`GRANT` statements must (and now do) qualify the
  exact signature. Flagged for Phase 4/5 review in case the API surface should
  be narrowed.

## Not certified / deferred

- **Live database alignment** is out of scope for local replay. The repo's own
  blocked item ("`supabase/sql/apply-live-p1-rls.sql` / `apply-live-p1-rpcs.sql`
  need pasting into live SQL Editor") is still open. This report certifies
  migration replayability, not that live is at the same revision.
- **PITR on live** is still unconfirmed (required before further live DDL).
- Overloaded `log_activity` and the `escalate_overdue_manager_invoices` fallback
  both point at API-surface ambiguity; whether either should be removed is a
  Phase 4 (financial integrity) / Phase 5 (golden path) decision, not a Phase 2
  blocker.

## Verification commands

```bash
sudo docker exec -e PGPASSWORD=postgres calqulus-pg \
  bash /tmp/workspace/tests/harness/replay-migrations.sh   # 78 passed, 0 failed
npx tsc --noEmit                                           # TYPECHECK_OK
npx vitest run                                             # 904 passed / 1 skipped
```
