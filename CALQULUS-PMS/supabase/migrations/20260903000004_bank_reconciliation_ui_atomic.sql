-- CALQULUS PMS — Phase 18: bank reconciliation UI convergence
-- All manager-facing reconciliation mutations use atomic, manager-scoped RPCs.

-- Replace the earlier 4-argument signature rather than leaving an overload that
-- could bypass the newer caller/tenant contract.
DROP FUNCTION IF EXISTS public.reconcile_bank_transaction_atomic(uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.reconcile_bank_transaction_atomic(
  p_bank_transaction_id uuid,
  p_invoice_id uuid DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_recorded_by uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bank record; v_invoice record; v_payment jsonb; v_tenant uuid;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_manager_id THEN
    RAISE EXCEPTION 'Unauthorized bank reconciliation' USING ERRCODE='42501';
  END IF;
  SELECT id, manager_id, amount, transaction_date, reference, matched
  INTO v_bank FROM public.bank_transactions WHERE id=p_bank_transaction_id FOR UPDATE;
  IF v_bank.id IS NULL THEN RAISE EXCEPTION 'Bank transaction not found'; END IF;
  IF v_bank.manager_id IS DISTINCT FROM p_manager_id THEN RAISE EXCEPTION 'Bank transaction is outside manager portfolio' USING ERRCODE='42501'; END IF;
  IF v_bank.matched THEN RETURN jsonb_build_object('success',true,'idempotent',true,'bank_transaction_id',v_bank.id); END IF;

  IF p_invoice_id IS NOT NULL THEN
    SELECT id, tenant_id, manager_id, status INTO v_invoice
    FROM public.invoices WHERE id=p_invoice_id FOR UPDATE;
    IF v_invoice.id IS NULL OR v_invoice.manager_id IS DISTINCT FROM p_manager_id THEN RAISE EXCEPTION 'Invoice is outside manager portfolio' USING ERRCODE='42501'; END IF;
    IF v_invoice.status NOT IN ('pending','overdue','partially_paid') THEN RAISE EXCEPTION 'Invoice is not payable' USING ERRCODE='55000'; END IF;
    v_tenant := v_invoice.tenant_id;
  ELSE
    v_tenant := p_tenant_id;
    IF v_tenant IS NULL THEN RAISE EXCEPTION 'Tenant is required for automatic allocation' USING ERRCODE='22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=v_tenant AND manager_id=p_manager_id) THEN RAISE EXCEPTION 'Tenant is outside manager portfolio' USING ERRCODE='42501'; END IF;
  END IF;

  v_payment := public.process_payment_atomic(
    v_tenant, p_manager_id, v_bank.amount, 'bank_transfer', v_bank.transaction_date,
    COALESCE(v_bank.reference, 'BANK-' || v_bank.id::text), p_invoice_id,
    NULL,NULL,NULL,NULL,NULL,NULL,p_recorded_by,
    'Bank reconciliation: ' || v_bank.id::text,NULL
  );
  IF COALESCE((v_payment->>'success')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Atomic payment processing failed'; END IF;

  UPDATE public.bank_transactions SET matched=true, matched_invoice_id=p_invoice_id,
    matched_tenant_id=v_tenant, match_method='atomic_reconciliation', match_confidence=100 WHERE id=v_bank.id;
  RETURN v_payment || jsonb_build_object('success',true,'bank_transaction_id',v_bank.id,'invoice_id',p_invoice_id,'tenant_id',v_tenant);
END; $$;

CREATE OR REPLACE FUNCTION public.dismiss_bank_transaction_atomic(
  p_bank_transaction_id uuid,
  p_manager_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bank record;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_manager_id THEN
    RAISE EXCEPTION 'Unauthorized bank transaction dismissal' USING ERRCODE='42501';
  END IF;
  SELECT id, manager_id, matched INTO v_bank FROM public.bank_transactions WHERE id=p_bank_transaction_id FOR UPDATE;
  IF v_bank.id IS NULL THEN RAISE EXCEPTION 'Bank transaction not found'; END IF;
  IF v_bank.manager_id IS DISTINCT FROM p_manager_id THEN RAISE EXCEPTION 'Bank transaction is outside manager portfolio' USING ERRCODE='42501'; END IF;
  IF v_bank.matched THEN RETURN jsonb_build_object('success',true,'idempotent',true,'bank_transaction_id',v_bank.id); END IF;
  UPDATE public.bank_transactions SET matched=true, match_method='ignored', match_confidence=0 WHERE id=v_bank.id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'bank_transaction_id',v_bank.id,'status','ignored');
END; $$;

REVOKE ALL ON FUNCTION public.reconcile_bank_transaction_atomic(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_bank_transaction_atomic(uuid,uuid,uuid,uuid,uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dismiss_bank_transaction_atomic(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_bank_transaction_atomic(uuid,uuid) TO authenticated, service_role;
