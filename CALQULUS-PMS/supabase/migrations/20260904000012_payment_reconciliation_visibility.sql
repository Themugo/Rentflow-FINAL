-- CALQULUS PMS — Payment reconciliation & operational visibility
-- Canonical manager receipt listing plus scoped integrity/stale-payment summaries.

CREATE OR REPLACE FUNCTION public.get_manager_issued_payment_receipts(p_manager_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  receipt_id uuid,
  receipt_number text,
  issued_at timestamptz,
  total_amount numeric,
  payer_name text,
  payer_type text,
  payer_phone text,
  payer_email text,
  payment_method text,
  payment_reference text,
  transaction_status text,
  property_id uuid,
  property_name text,
  unit_id uuid,
  unit_number text,
  invoice_count integer,
  allocation_count integer,
  allocated_amount numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_manager_id IS NULL THEN p_manager_id:=v_uid; END IF;
  IF v_uid<>p_manager_id AND NOT EXISTS (
    SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p_manager_id AND ms.submanager_user_id=v_uid
  ) THEN
    RAISE EXCEPTION 'Receipt scope unauthorized' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.receipt_number,
    r.issued_at,
    r.total_amount,
    COALESCE(pp.display_name,'Unknown payer'),
    pp.party_type,
    pp.phone,
    pp.email,
    pt.payment_type,
    COALESCE(pt.mpesa_receipt_number,pt.bank_reference,pt.checkout_request_id::text),
    pt.status,
    MAX(pa.property_id) FILTER (WHERE pa.property_id IS NOT NULL),
    MAX(p.name) FILTER (WHERE p.name IS NOT NULL),
    MAX(pa.unit_id) FILTER (WHERE pa.unit_id IS NOT NULL),
    MAX(u.unit_number) FILTER (WHERE u.unit_number IS NOT NULL),
    COUNT(DISTINCT pa.invoice_id)::integer,
    COUNT(pa.id)::integer,
    COALESCE(SUM(pa.allocated_amount),0)
  FROM public.issued_payment_receipts r
  JOIN public.payment_transactions pt ON pt.id=r.transaction_id
  LEFT JOIN public.payment_parties pp ON pp.id=r.payer_party_id
  LEFT JOIN public.payment_allocations pa ON pa.transaction_id=pt.id
  LEFT JOIN public.properties p ON p.id=pa.property_id
  LEFT JOIN public.units u ON u.id=pa.unit_id
  WHERE pt.manager_id=p_manager_id
  GROUP BY r.id,r.receipt_number,r.issued_at,r.total_amount,pp.display_name,pp.party_type,pp.phone,pp.email,pt.payment_type,pt.mpesa_receipt_number,pt.bank_reference,pt.checkout_request_id,pt.status
  ORDER BY r.issued_at DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.get_manager_issued_payment_receipts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_payment_reconciliation_summary(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_scope uuid[]; v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF v_uid<>v_manager AND NOT EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) THEN
    RAISE EXCEPTION 'Reconciliation scope unauthorized' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'pending_count', (SELECT COUNT(*) FROM public.payment_transactions pt WHERE pt.manager_id=v_manager AND pt.status IN ('pending','initiating')),
    'stale_pending_count', (SELECT COUNT(*) FROM public.payment_transactions pt WHERE pt.manager_id=v_manager AND pt.status IN ('pending','initiating') AND COALESCE(pt.initiated_at,pt.created_at) < now()-interval '60 minutes'),
    'failed_count_24h', (SELECT COUNT(*) FROM public.payment_transactions pt WHERE pt.manager_id=v_manager AND pt.status='failed' AND COALESCE(pt.updated_at,pt.created_at) >= now()-interval '24 hours'),
    'allocation_mismatch_count', (SELECT COUNT(*) FROM public.payment_transactions pt WHERE pt.manager_id=v_manager AND pt.status='completed' AND ABS(pt.amount-COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa WHERE pa.transaction_id=pt.id),0)) > 0.01),
    'issued_receipt_count', (SELECT COUNT(*) FROM public.issued_payment_receipts r JOIN public.payment_transactions pt ON pt.id=r.transaction_id WHERE pt.manager_id=v_manager),
    'issued_receipt_total', (SELECT COALESCE(SUM(r.total_amount),0) FROM public.issued_payment_receipts r JOIN public.payment_transactions pt ON pt.id=r.transaction_id WHERE pt.manager_id=v_manager)
  ) INTO v_result;
  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.get_payment_reconciliation_summary(uuid) TO authenticated;
