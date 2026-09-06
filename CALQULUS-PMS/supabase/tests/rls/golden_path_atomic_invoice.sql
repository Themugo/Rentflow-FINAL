-- CALQULUS Phase 3 regression specification.
-- Run against a disposable/staging database after migrations are applied.
-- Verifies the canonical invoice RPC is service-only and idempotent by generation_key.

DO $$
DECLARE
  fn_acl text;
  idx_count integer;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO fn_acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'create_invoice_atomic';
  IF fn_acl IS NULL THEN RAISE EXCEPTION 'create_invoice_atomic is missing'; END IF;

  SELECT count(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = 'invoices_generation_key_unique';
  IF idx_count <> 1 THEN RAISE EXCEPTION 'generation-key uniqueness index missing'; END IF;

  IF fn_acl NOT LIKE '%Only the invoice service may create invoices%' THEN
    RAISE EXCEPTION 'invoice RPC authorization guard missing';
  END IF;
END $$;

-- Application regression checks (to be run with a service-role harness):
-- 1. Call create_invoice_atomic twice with the same generation key.
-- 2. Assert both responses return the same invoice id and second has created=false.
-- 3. Assert exactly one invoice exists for that generation key.
-- 4. Assert line items were committed with the invoice.
-- 5. Force an invalid line-item insert and assert the entire invoice transaction rolls back.
