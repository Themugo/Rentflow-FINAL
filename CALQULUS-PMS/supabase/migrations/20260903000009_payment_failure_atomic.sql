-- CALQULUS PMS — Phase 24: centralize terminal payment-failure transitions
-- Provider callbacks use a service-role-only RPC instead of ad-hoc UPDATEs.

CREATE OR REPLACE FUNCTION public.mark_payment_transaction_failed_atomic(
  p_transaction_id uuid,
  p_failure_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx record;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized payment failure transition' USING ERRCODE='42501';
  END IF;
  SELECT id, status INTO v_tx
  FROM public.payment_transactions
  WHERE id=p_transaction_id
  FOR UPDATE;
  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Payment transaction not found' USING ERRCODE='P0002';
  END IF;
  IF v_tx.status = 'completed' THEN
    RAISE EXCEPTION 'Completed payment cannot be marked failed' USING ERRCODE='55000';
  END IF;
  IF v_tx.status = 'failed' THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'transaction_id',v_tx.id,'status','failed');
  END IF;
  UPDATE public.payment_transactions
  SET status='failed', failure_reason=left(coalesce(nullif(btrim(p_failure_reason),''),'Payment failed'),500), updated_at=now()
  WHERE id=v_tx.id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'transaction_id',v_tx.id,'status','failed');
END; $$;

REVOKE ALL ON FUNCTION public.mark_payment_transaction_failed_atomic(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_transaction_failed_atomic(uuid,text) TO service_role;
