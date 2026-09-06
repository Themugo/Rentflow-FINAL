-- CALQULUS PMS — Payment exception control centre
-- One scoped queue for stale, failed, allocation-mismatch and receipt-recovery exceptions.

CREATE OR REPLACE FUNCTION public.get_payment_exception_control_center(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_scope_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_scope_ok;
  IF NOT COALESCE(v_scope_ok,false) THEN RAISE EXCEPTION 'Payment exception scope unauthorized' USING ERRCODE='42501'; END IF;

  RETURN jsonb_build_object(
    'stale_pending', COALESCE((SELECT jsonb_agg(x.row ORDER BY x.created_at DESC) FROM (SELECT jsonb_build_object('id',pt.id,'amount',pt.amount,'status',pt.status,'created_at',pt.created_at,'updated_at',pt.updated_at,'reference',COALESCE(pt.mpesa_receipt_number,pt.bank_reference,pt.checkout_request_id::text)) AS row, pt.created_at FROM public.payment_transactions pt WHERE pt.manager_id=v_manager AND pt.status IN ('pending','initiating') AND COALESCE(pt.initiated_at,pt.created_at) < now()-interval '60 minutes' ORDER BY pt.created_at DESC LIMIT 50) x),'[]'::jsonb),
    'allocation_mismatches', COALESCE((SELECT jsonb_agg(x.row ORDER BY x.created_at DESC) FROM (SELECT jsonb_build_object('id',pt.id,'amount',pt.amount,'allocated_amount',COALESCE(a.allocated_amount,0),'difference',ROUND((pt.amount-COALESCE(a.allocated_amount,0))::numeric,2),'created_at',pt.created_at,'reference',COALESCE(pt.mpesa_receipt_number,pt.bank_reference,pt.checkout_request_id::text)) AS row, pt.created_at FROM public.payment_transactions pt LEFT JOIN LATERAL (SELECT SUM(pa.allocated_amount) allocated_amount FROM public.payment_allocations pa WHERE pa.transaction_id=pt.id) a ON true WHERE pt.manager_id=v_manager AND pt.status='completed' AND ABS(pt.amount-COALESCE(a.allocated_amount,0)) > 0.01 ORDER BY pt.created_at DESC LIMIT 50) x),'[]'::jsonb),
    'receipt_recovery', COALESCE((SELECT jsonb_agg(x.row ORDER BY x.created_at DESC) FROM (SELECT jsonb_build_object('id',pt.id,'amount',pt.amount,'status',pt.status,'created_at',pt.created_at,'reference',COALESCE(pt.mpesa_receipt_number,pt.bank_reference,pt.checkout_request_id::text)) AS row, pt.created_at FROM public.payment_transactions pt WHERE pt.manager_id=v_manager AND pt.status='completed' AND NOT EXISTS (SELECT 1 FROM public.issued_payment_receipts r WHERE r.transaction_id=pt.id) ORDER BY pt.created_at DESC LIMIT 50) x),'[]'::jsonb),
    'failed_24h', COALESCE((SELECT jsonb_agg(x.row ORDER BY x.updated_at DESC) FROM (SELECT jsonb_build_object('id',pt.id,'amount',pt.amount,'updated_at',pt.updated_at,'reference',COALESCE(pt.mpesa_receipt_number,pt.bank_reference,pt.checkout_request_id::text)) AS row, pt.updated_at FROM public.payment_transactions pt WHERE pt.manager_id=v_manager AND pt.status='failed' AND COALESCE(pt.updated_at,pt.created_at) >= now()-interval '24 hours' ORDER BY pt.updated_at DESC LIMIT 50) x),'[]'::jsonb)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_payment_exception_control_center(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_payment_recovery_atomic(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v public.payment_transactions%ROWTYPE; v_manager uuid; v_receipt public.issued_payment_receipts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.payment_transactions WHERE id=p_transaction_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Payment transaction not found' USING ERRCODE='P0002'; END IF;
  v_manager:=v.manager_id;
  IF v_uid<>v_manager AND NOT EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) THEN
    RAISE EXCEPTION 'Payment recovery scope unauthorized' USING ERRCODE='42501';
  END IF;
  IF v.status <> 'completed' THEN RAISE EXCEPTION 'Only completed payments can be recovered' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_receipt FROM public.issued_payment_receipts WHERE transaction_id=v.id LIMIT 1;
  IF v_receipt.id IS NULL THEN
    SELECT * INTO v_receipt FROM public.issue_payment_receipt_atomic(v.id);
  END IF;
  PERFORM public.notify_payment_receipt_recipients_atomic(v_receipt.id);
  RETURN jsonb_build_object('transaction_id',v.id,'receipt_id',v_receipt.id,'receipt_number',v_receipt.receipt_number,'recovered',true);
END $$;
GRANT EXECUTE ON FUNCTION public.complete_payment_recovery_atomic(uuid) TO authenticated;
