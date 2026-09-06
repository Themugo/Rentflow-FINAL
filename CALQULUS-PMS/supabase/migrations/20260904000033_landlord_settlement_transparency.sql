-- CALQULUS PMS — Owner Portal Financial Delivery & Settlement Transparency
-- Exposes only the authenticated landlord's own payout/settlement records.
-- No tenant identity, payment-party identity, or manager-only settlement data is returned.

CREATE OR REPLACE FUNCTION public.get_landlord_settlement_transparency(
  p_landlord_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' OR v_uid <> p_landlord_user_id THEN
    RAISE EXCEPTION 'Landlord scope required' USING ERRCODE='42501';
  END IF;

  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'approved_net', coalesce(sum(CASE WHEN pr.status='approved' AND bi.id IS NOT NULL THEN coalesce(bi.net_amount, pr.net_amount, pr.amount) ELSE 0 END),0),
      'settled_net', coalesce(sum(CASE WHEN b.status='settled' THEN coalesce(bi.net_amount, pr.net_amount, pr.amount) ELSE 0 END),0),
      'settled_count', count(*) FILTER (WHERE b.status='settled'),
      'pending_count', count(*) FILTER (WHERE b.status IN ('draft','approved','processing'))
    ),
    'settlements', coalesce(jsonb_agg(
      jsonb_build_object(
        'batch_id', b.id,
        'batch_status', b.status,
        'period_start', fp.period_start,
        'period_end', fp.period_end,
        'property_id', pr.property_id,
        'property_name', p.name,
        'payout_request_id', pr.id,
        'gross_amount', coalesce(bi.gross_amount, pr.amount),
        'fee_amount', coalesce(bi.fee_amount, pr.management_fee_amt, 0),
        'net_amount', coalesce(bi.net_amount, pr.net_amount, round(pr.amount-coalesce(pr.management_fee_amt,0),2)),
        'payout_status', pr.status,
        'settlement_reference', b.settlement_reference,
        'approved_at', b.approved_at,
        'settled_at', b.settled_at,
        'requested_at', pr.created_at,
        'paid_at', pr.paid_at,
        'notes', pr.notes
      ) ORDER BY coalesce(b.settled_at,b.approved_at,pr.created_at) DESC
    ) FILTER (WHERE b.id IS NOT NULL),'[]'::jsonb)
  ) INTO v_result
  FROM public.payout_requests pr
  LEFT JOIN public.owner_payout_batch_items bi ON bi.payout_request_id = pr.id
  LEFT JOIN public.owner_payout_batches b ON b.id = bi.batch_id
  LEFT JOIN public.financial_close_periods fp ON fp.id = b.close_period_id
  LEFT JOIN public.properties p ON p.id = pr.property_id
  WHERE pr.landlord_user_id = p_landlord_user_id;

  RETURN coalesce(v_result, jsonb_build_object(
    'summary', jsonb_build_object('approved_net',0,'settled_net',0,'settled_count',0,'pending_count',0),
    'settlements','[]'::jsonb
  ));
END $$;

REVOKE ALL ON FUNCTION public.get_landlord_settlement_transparency(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_landlord_settlement_transparency(uuid) TO authenticated, service_role;
