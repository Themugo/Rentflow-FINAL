-- Phase 56: payout request reconciliation and authorization hardening.
-- Canonical payout mutations remain server-side and lock the request row.

CREATE OR REPLACE FUNCTION public.transition_payout_request_atomic(
  p_payout_id uuid,
  p_target_status text,
  p_payment_method text DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_payment_proof_url text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL,
  p_management_fee_pct numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_p public.payout_requests%ROWTYPE;
  v_manager uuid;
  v_net numeric;
  v_bank jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_p FROM public.payout_requests WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout request not found'; END IF;

  SELECT role INTO v_role FROM public.user_roles WHERE user_id = v_uid LIMIT 1;
  IF v_role = 'submanager' THEN
    SELECT manager_id INTO v_manager FROM public.manager_submanagers WHERE submanager_user_id = v_uid LIMIT 1;
  ELSE
    v_manager := v_uid;
  END IF;

  IF v_role = 'landlord' THEN
    IF v_p.landlord_user_id <> v_uid OR p_target_status <> 'rejected' THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501';
    END IF;
  ELSIF v_role IN ('manager','submanager') THEN
    IF v_p.manager_id IS DISTINCT FROM v_manager THEN
      RAISE EXCEPTION 'Payout is outside caller portfolio' USING ERRCODE='42501';
    END IF;
  ELSIF v_role = 'webhost' THEN
    IF COALESCE(v_p.recipient_type, 'manager') <> 'webhost' THEN
      RAISE EXCEPTION 'Payout is not routed to the platform' USING ERRCODE='42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501';
  END IF;

  IF p_target_status = 'approved' AND v_p.status = 'pending' THEN
    IF v_role NOT IN ('manager','submanager','webhost') THEN RAISE EXCEPTION 'Only an administrator can approve payouts' USING ERRCODE='42501'; END IF;
    UPDATE public.payout_requests
      SET status='approved', approved_at=now(), approved_by=v_uid
      WHERE id=v_p.id;

  ELSIF p_target_status = 'paid' AND v_p.status = 'approved' THEN
    IF v_role NOT IN ('manager','submanager','webhost') THEN RAISE EXCEPTION 'Only an administrator can mark payouts paid' USING ERRCODE='42501'; END IF;
    IF NULLIF(trim(p_payment_reference),'') IS NULL THEN RAISE EXCEPTION 'Payment reference required'; END IF;
    IF p_management_fee_pct IS NOT NULL AND (p_management_fee_pct < 0 OR p_management_fee_pct > 100) THEN RAISE EXCEPTION 'Invalid management fee'; END IF;
    IF v_p.recipient_type = 'manager' AND v_p.manager_id IS NULL THEN RAISE EXCEPTION 'Managed payout has no manager destination'; END IF;

    -- Snapshot the currently configured landlord destination at the moment funds are marked paid.
    SELECT to_jsonb(lbd) INTO v_bank
    FROM public.landlord_bank_details lbd
    WHERE lbd.landlord_user_id = v_p.landlord_user_id
    LIMIT 1;

    v_net := round(v_p.amount * (1 - COALESCE(p_management_fee_pct,0) / 100), 2);
    UPDATE public.payout_requests
      SET status='paid', paid_at=now(),
          payment_method=NULLIF(trim(p_payment_method),''),
          payment_reference=NULLIF(trim(p_payment_reference),''),
          payment_proof_url=NULLIF(trim(p_payment_proof_url),''),
          management_fee_pct=p_management_fee_pct,
          management_fee_amt=CASE WHEN p_management_fee_pct IS NULL THEN NULL ELSE round(v_p.amount*p_management_fee_pct/100,2) END,
          net_amount=v_net,
          bank_details_snapshot=COALESCE(v_bank, bank_details_snapshot)
      WHERE id=v_p.id;

  ELSIF p_target_status = 'rejected' AND v_p.status = 'pending' THEN
    IF NULLIF(trim(p_rejection_reason),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
    UPDATE public.payout_requests
      SET status='rejected', rejection_reason=NULLIF(trim(p_rejection_reason),''), approved_by=CASE WHEN v_role='landlord' THEN approved_by ELSE v_uid END
      WHERE id=v_p.id;

  ELSIF p_target_status = v_p.status THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Invalid payout transition from % to %', v_p.status, p_target_status;
  END IF;

  SELECT * INTO v_p FROM public.payout_requests WHERE id=v_p.id;
  RETURN jsonb_build_object('id',v_p.id,'status',v_p.status,'paid_at',v_p.paid_at,'approved_at',v_p.approved_at,'net_amount',v_p.net_amount);
END $$;

-- No client can bypass the canonical payout state machine.
REVOKE INSERT, UPDATE, DELETE ON public.payout_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payout_requests FROM anon;
REVOKE ALL ON FUNCTION public.transition_payout_request_atomic(uuid,text,text,text,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_payout_request_atomic(uuid,text,text,text,text,text,numeric) TO authenticated,service_role;
