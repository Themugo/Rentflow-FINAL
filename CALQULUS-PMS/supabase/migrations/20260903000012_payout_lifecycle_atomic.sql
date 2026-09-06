-- Phase 27: payout request lifecycle atomicity.
-- All payout creation and status transitions must pass through these RPCs.

CREATE OR REPLACE FUNCTION public.create_payout_request_atomic(
  p_property_id uuid,
  p_landlord_user_id uuid,
  p_amount numeric,
  p_period_start date,
  p_period_end date,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_role text; v_manager uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE='28000'; END IF;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid LIMIT 1;
  IF v_role = 'landlord' THEN
    IF p_landlord_user_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
  ELSIF v_role IN ('manager','submanager','webhost') THEN
    IF v_role='submanager' THEN SELECT manager_id INTO v_manager FROM public.manager_submanagers WHERE submanager_user_id=v_uid LIMIT 1; ELSE v_manager:=v_uid; END IF;
    IF v_role <> 'webhost' AND NOT EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p_property_id AND pl.landlord_user_id=p_landlord_user_id AND pl.manager_id=COALESCE(v_manager,v_uid)) THEN
      RAISE EXCEPTION 'Property is not in caller portfolio' USING ERRCODE='42501';
    END IF;
  ELSE RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN RAISE EXCEPTION 'Invalid payout request'; END IF;
  SELECT manager_id INTO v_manager FROM public.property_landlords WHERE property_id=p_property_id AND landlord_user_id=p_landlord_user_id LIMIT 1;
  INSERT INTO public.payout_requests(property_id,landlord_user_id,manager_id,recipient_type,amount,period_start,period_end,notes,status)
  VALUES(p_property_id,p_landlord_user_id,v_manager,CASE WHEN v_manager IS NULL THEN 'webhost' ELSE 'manager' END,p_amount,p_period_start,p_period_end,NULLIF(trim(p_notes),''),'pending')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id',v_id,'status','pending');
END $$;

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
DECLARE v_uid uuid := auth.uid(); v_role text; v_p public.payout_requests%ROWTYPE; v_manager uuid; v_net numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_p FROM public.payout_requests WHERE id=p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout request not found'; END IF;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid LIMIT 1;
  IF v_role='submanager' THEN SELECT manager_id INTO v_manager FROM public.manager_submanagers WHERE submanager_user_id=v_uid LIMIT 1; ELSE v_manager:=v_uid; END IF;
  IF v_role='landlord' THEN
    IF v_p.landlord_user_id<>v_uid OR p_target_status NOT IN ('rejected') THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
  ELSIF v_role='webhost' THEN NULL;
  ELSIF v_role IN ('manager','submanager') THEN
    IF v_p.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Payout is outside caller portfolio' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
  IF p_target_status='approved' AND v_p.status='pending' THEN
    UPDATE public.payout_requests SET status='approved',approved_at=now(),approved_by=v_uid WHERE id=v_p.id;
  ELSIF p_target_status='paid' AND v_p.status='approved' THEN
    IF NULLIF(trim(p_payment_reference),'') IS NULL THEN RAISE EXCEPTION 'Payment reference required'; END IF;
    IF p_management_fee_pct IS NOT NULL AND (p_management_fee_pct<0 OR p_management_fee_pct>100) THEN RAISE EXCEPTION 'Invalid management fee'; END IF;
    v_net := round(v_p.amount * (1-COALESCE(p_management_fee_pct,0)/100),2);
    UPDATE public.payout_requests SET status='paid',paid_at=now(),payment_method=NULLIF(trim(p_payment_method),''),payment_reference=NULLIF(trim(p_payment_reference),''),payment_proof_url=NULLIF(trim(p_payment_proof_url),''),management_fee_pct=p_management_fee_pct,management_fee_amt=CASE WHEN p_management_fee_pct IS NULL THEN NULL ELSE round(v_p.amount*p_management_fee_pct/100,2) END,net_amount=v_net WHERE id=v_p.id;
  ELSIF p_target_status='rejected' AND v_p.status='pending' THEN
    UPDATE public.payout_requests SET status='rejected',rejection_reason=NULLIF(trim(p_rejection_reason),''),approved_by=CASE WHEN v_role='landlord' THEN approved_by ELSE v_uid END WHERE id=v_p.id;
  ELSIF p_target_status=v_p.status THEN NULL;
  ELSE RAISE EXCEPTION 'Invalid payout transition from % to %',v_p.status,p_target_status;
  END IF;
  SELECT * INTO v_p FROM public.payout_requests WHERE id=v_p.id;
  RETURN jsonb_build_object('id',v_p.id,'status',v_p.status,'paid_at',v_p.paid_at,'approved_at',v_p.approved_at);
END $$;

REVOKE ALL ON FUNCTION public.create_payout_request_atomic(uuid,uuid,numeric,date,date,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.transition_payout_request_atomic(uuid,text,text,text,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_payout_request_atomic(uuid,uuid,numeric,date,date,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_payout_request_atomic(uuid,text,text,text,text,text,numeric) TO authenticated,service_role;
