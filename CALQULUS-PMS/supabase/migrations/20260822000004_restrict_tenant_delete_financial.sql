-- ============================================================
-- Phase 5 (financial hardening): RESTRICT tenant delete on financial records
--
-- Defect: financial ledger tables referenced tenants with
-- ON DELETE SET NULL:
--   invoices.tenant_id, payment_transactions.tenant_id,
--   payment_allocations.tenant_id
--
-- Deleting a tenant therefore silently orphaned its invoices, payment
-- transactions, and allocation records — money received with no payer,
-- and no error. For a property ledger this is unacceptable: financial
-- rows must be preserved or the delete must be blocked.
--
-- Fix: RESTRICT. A tenant with any invoice / payment transaction /
-- allocation cannot be deleted until those records are resolved
-- (e.g. archived / settled), preventing silent ledger loss.
-- ============================================================

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_tenant_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_tenant_id_fkey;
ALTER TABLE public.payment_transactions ADD CONSTRAINT payment_transactions_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_tenant_id_fkey;
ALTER TABLE public.payment_allocations ADD CONSTRAINT payment_allocations_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
