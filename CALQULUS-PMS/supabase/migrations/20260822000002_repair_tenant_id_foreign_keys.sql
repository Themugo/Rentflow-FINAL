-- ============================================================
-- Phase 4: Financial integrity — repair tenant_id foreign keys
--
-- Defect: four columns semantically named `tenant_id` (holding a
-- public.tenants.id) were declared REFERENCES auth.users(id). Since
-- tenants.id is not an auth.users id for manager-onboarded tenants (who
-- never sign up), inserting into these tables for such tenants raises an
-- FK violation and rolls back the transaction — breaking payment
-- allocation, overpayment credit, bank reconciliation matching, and the
-- arrears schedule in production.
--
-- Root cause: schema predates the dedicated `tenants` table; these FKs
-- were never re-pointed when `tenants` became its own entity.
--
-- Fix: drop each wrong FK and recreate it referencing public.tenants(id).
-- Data stored is already tenants.id, so re-pointing (not just VALIDATE)
-- is required. Done with NOT VALID + VALIDATE for safe application.
-- ============================================================

-- ── payment_allocations.tenant_id ────────────────────────────────────
ALTER TABLE public.payment_allocations
  DROP CONSTRAINT IF EXISTS payment_allocations_tenant_id_fkey;
ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL
  NOT VALID;
ALTER TABLE public.payment_allocations
  VALIDATE CONSTRAINT payment_allocations_tenant_id_fkey;

-- ── tenant_credit_ledger.tenant_id ───────────────────────────────────
ALTER TABLE public.tenant_credit_ledger
  DROP CONSTRAINT IF EXISTS tenant_credit_ledger_tenant_id_fkey;
ALTER TABLE public.tenant_credit_ledger
  ADD CONSTRAINT tenant_credit_ledger_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.tenant_credit_ledger
  VALIDATE CONSTRAINT tenant_credit_ledger_tenant_id_fkey;

-- ── bank_transactions.matched_tenant_id ──────────────────────────────
ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_matched_tenant_id_fkey;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_matched_tenant_id_fkey
  FOREIGN KEY (matched_tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL
  NOT VALID;
ALTER TABLE public.bank_transactions
  VALIDATE CONSTRAINT bank_transactions_matched_tenant_id_fkey;

-- ── arrears_schedule.tenant_id ───────────────────────────────────────
ALTER TABLE public.arrears_schedule
  DROP CONSTRAINT IF EXISTS arrears_schedule_tenant_id_fkey;
ALTER TABLE public.arrears_schedule
  ADD CONSTRAINT arrears_schedule_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
  NOT VALID;
ALTER TABLE public.arrears_schedule
  VALIDATE CONSTRAINT arrears_schedule_tenant_id_fkey;
