-- CALQULUS Phase 26: retire the schema-incompatible commission worker and harden the dormant commission table.
-- The current production billing model records manager platform billing in manager_invoices/platform_payment_transactions;
-- the legacy process-commission worker referenced columns/configuration that do not exist in the canonical schema and has no production callers.

DROP INDEX IF EXISTS public.commissions_invoice_id_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS commissions_invoice_id_unique_idx
  ON public.commissions(invoice_id)
  WHERE invoice_id IS NOT NULL;
