-- CALQULUS PMS — Phase 19: platform invoice lifecycle convergence
-- All webhost financial mutations use one authorized database boundary.

CREATE OR REPLACE FUNCTION public.cancel_manager_invoice_atomic(
  p_manager_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invoice record;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('webhost','platform_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized platform invoice cancellation' USING ERRCODE='42501';
  END IF;

  SELECT id, status INTO v_invoice
  FROM public.manager_invoices
  WHERE id = p_manager_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Platform invoice not found' USING ERRCODE='P0002';
  END IF;
  IF v_invoice.status = 'paid' THEN
    RAISE EXCEPTION 'Paid platform invoice cannot be cancelled' USING ERRCODE='55000';
  END IF;
  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'invoice_id',v_invoice.id,'status','cancelled');
  END IF;

  UPDATE public.manager_invoices
  SET status = 'cancelled', updated_at = now()
  WHERE id = v_invoice.id;

  RETURN jsonb_build_object('success',true,'idempotent',false,'invoice_id',v_invoice.id,'status','cancelled');
END; $$;

REVOKE ALL ON FUNCTION public.cancel_manager_invoice_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_manager_invoice_atomic(uuid) TO authenticated, service_role;


-- Phase 21 hardening: manual platform settlement must be invoice-idempotent,
-- not merely reference-idempotent. A paid invoice can never receive a second
-- successful manual transaction through this RPC.
CREATE OR REPLACE FUNCTION public.record_platform_invoice_payment_atomic(
  p_manager_invoice_id uuid,
  p_manager_user_id uuid,
  p_amount numeric,
  p_reference text,
  p_payment_method text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invoice record; v_existing record; v_tx_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('webhost','platform_admin')
  ) THEN RAISE EXCEPTION 'Unauthorized platform invoice settlement' USING ERRCODE='42501'; END IF;
  IF p_amount <= 0 OR p_reference IS NULL OR btrim(p_reference) = '' THEN
    RAISE EXCEPTION 'Invalid platform payment amount or reference' USING ERRCODE='22023';
  END IF;
  SELECT id, manager_user_id, amount, status INTO v_invoice
  FROM public.manager_invoices WHERE id=p_manager_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL OR v_invoice.manager_user_id IS DISTINCT FROM p_manager_user_id THEN
    RAISE EXCEPTION 'Platform invoice ownership mismatch' USING ERRCODE='42501';
  END IF;
  IF round(v_invoice.amount,2) <> round(p_amount,2) THEN RAISE EXCEPTION 'Payment amount does not match invoice' USING ERRCODE='22003'; END IF;
  IF v_invoice.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled platform invoice cannot be paid' USING ERRCODE='55000'; END IF;

  -- The invoice lock above serializes concurrent settlement attempts. If the
  -- invoice is already paid, return an existing successful transaction when
  -- one exists; otherwise report the legacy-paid state without creating money.
  IF v_invoice.status = 'paid' THEN
    SELECT id, reference, status INTO v_existing
    FROM public.platform_payment_transactions
    WHERE manager_invoice_id = p_manager_invoice_id AND status = 'success'
    ORDER BY completed_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'already_paid', true,
      'transaction_id', v_existing.id, 'reference', v_existing.reference, 'status', 'paid'
    );
  END IF;

  SELECT id, manager_invoice_id, manager_user_id, amount, status INTO v_existing
  FROM public.platform_payment_transactions WHERE reference=btrim(p_reference) FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.manager_invoice_id IS DISTINCT FROM p_manager_invoice_id OR v_existing.manager_user_id IS DISTINCT FROM p_manager_user_id OR round(v_existing.amount,2) <> round(p_amount,2) THEN
      RAISE EXCEPTION 'Platform payment reference collision' USING ERRCODE='23505';
    END IF;
    IF v_existing.status = 'success' THEN
      UPDATE public.manager_invoices SET status='paid', paid_date=COALESCE(paid_date,CURRENT_DATE), updated_at=now() WHERE id=v_invoice.id;
      PERFORM public.reinstate_manager_on_payment(v_invoice.id);
    END IF;
    RETURN jsonb_build_object('success',true,'idempotent',true,'transaction_id',v_existing.id,'status',v_existing.status);
  END IF;

  INSERT INTO public.platform_payment_transactions (
    manager_invoice_id, manager_user_id, provider, payment_method, reference,
    amount, currency, status, metadata, completed_at
  ) VALUES (
    p_manager_invoice_id, p_manager_user_id, 'internal', p_payment_method, btrim(p_reference),
    round(p_amount,2), 'KES', 'success', jsonb_build_object('source','webhost_manual'), now()
  ) RETURNING id INTO v_tx_id;
  UPDATE public.manager_invoices
  SET status='paid', paid_date=COALESCE(paid_date,CURRENT_DATE), updated_at=now()
  WHERE id=v_invoice.id;
  PERFORM public.reinstate_manager_on_payment(v_invoice.id);
  RETURN jsonb_build_object('success',true,'idempotent',false,'transaction_id',v_tx_id,'status','success');
END; $$;

REVOKE ALL ON FUNCTION public.record_platform_invoice_payment_atomic(uuid,uuid,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_platform_invoice_payment_atomic(uuid,uuid,numeric,text,text) TO authenticated, service_role;
