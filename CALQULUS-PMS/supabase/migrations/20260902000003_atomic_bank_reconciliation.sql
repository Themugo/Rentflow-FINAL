-- ============================================================
-- CALQULUS: Atomic bank reconciliation
--
-- Keeps bank statement matching and financial payment state in one
-- database transaction. A bank row cannot be marked matched unless
-- the corresponding atomic payment operation succeeds.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reconcile_bank_transaction_atomic(
  p_bank_transaction_id uuid,
  p_invoice_id uuid,
  p_manager_id uuid,
  p_recorded_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank record;
  v_invoice record;
  v_payment jsonb;
BEGIN
  SELECT id, manager_id, amount, transaction_date, reference, matched
  INTO v_bank
  FROM public.bank_transactions
  WHERE id = p_bank_transaction_id
  FOR UPDATE;

  IF v_bank.id IS NULL THEN
    RAISE EXCEPTION 'Bank transaction not found';
  END IF;

  IF v_bank.manager_id <> p_manager_id THEN
    RAISE EXCEPTION 'Bank transaction is outside manager portfolio';
  END IF;

  IF v_bank.matched THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'bank_transaction_id', v_bank.id);
  END IF;

  SELECT id, tenant_id, manager_id, status, amount
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.manager_id <> p_manager_id THEN
    RAISE EXCEPTION 'Invoice is outside manager portfolio';
  END IF;

  IF v_invoice.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Invoice is not payable';
  END IF;

  v_payment := public.process_payment_atomic(
    v_invoice.tenant_id,
    p_manager_id,
    v_bank.amount,
    'bank_transfer',
    v_bank.transaction_date,
    COALESCE(v_bank.reference, 'BANK-' || v_bank.id::text),
    v_invoice.id,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    p_recorded_by,
    'Bank reconciliation: ' || v_bank.id::text,
    NULL
  );

  IF COALESCE((v_payment->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Atomic payment processing failed';
  END IF;

  UPDATE public.bank_transactions
  SET matched = true,
      matched_invoice_id = v_invoice.id,
      matched_tenant_id = v_invoice.tenant_id,
      match_method = 'atomic_reconciliation',
      match_confidence = 100
  WHERE id = v_bank.id;

  RETURN v_payment || jsonb_build_object(
    'success', true,
    'bank_transaction_id', v_bank.id,
    'invoice_id', v_invoice.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_bank_transaction_atomic(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_bank_transaction_atomic(uuid, uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.reconcile_bank_transaction_atomic(uuid, uuid, uuid, uuid)
IS 'Atomically applies a bank transaction to an invoice and marks the bank transaction matched.';
