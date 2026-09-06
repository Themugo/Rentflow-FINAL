-- Phase 66: insurance policy/claim mutation convergence
-- Browser callers may read marketplace data, but financial/lifecycle writes are server-authorized.

CREATE OR REPLACE FUNCTION public.save_insurance_policy_atomic(
  p_policy_id uuid DEFAULT NULL,
  p_provider_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_unit text DEFAULT NULL,
  p_policy_type text DEFAULT NULL,
  p_coverage_type text DEFAULT NULL,
  p_coverage_amount numeric DEFAULT NULL,
  p_premium numeric DEFAULT NULL,
  p_deductible numeric DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_renewal_date timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid:=auth.uid(); v_id uuid:=p_policy_id; v_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid AND role IN ('webhost','manager','submanager') ORDER BY CASE role WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Marketplace authorization required' USING ERRCODE='42501'; END IF;
  IF v_id IS NOT NULL AND p_property_id IS NULL THEN SELECT property_id INTO p_property_id FROM public.insurance_policies WHERE id=v_id; END IF;
  IF p_property_id IS NULL THEN RAISE EXCEPTION 'Property is required' USING ERRCODE='22023'; END IF;
  IF p_coverage_amount IS NULL OR p_coverage_amount < 0 OR p_premium IS NULL OR p_premium < 0 OR p_deductible IS NULL OR p_deductible < 0 THEN RAISE EXCEPTION 'Insurance amounts must be non-negative' USING ERRCODE='22023'; END IF;
  IF v_id IS NULL AND (p_start_date IS NULL OR p_end_date IS NULL OR p_end_date <= p_start_date) THEN RAISE EXCEPTION 'Invalid insurance dates' USING ERRCODE='22023'; END IF;
  IF v_id IS NOT NULL AND p_start_date IS NULL THEN SELECT start_date INTO p_start_date FROM public.insurance_policies WHERE id=v_id; END IF;
  IF v_id IS NOT NULL AND p_end_date IS NULL THEN SELECT end_date INTO p_end_date FROM public.insurance_policies WHERE id=v_id; END IF;
  IF p_end_date <= p_start_date THEN RAISE EXCEPTION 'Invalid insurance dates' USING ERRCODE='22023'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('active','pending','expired','cancelled') THEN RAISE EXCEPTION 'Invalid insurance status' USING ERRCODE='22023'; END IF;
  IF v_role <> 'webhost' AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=v_uid) THEN
    RAISE EXCEPTION 'Property portfolio authorization required' USING ERRCODE='42501';
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.insurance_policies(provider_id,property_id,unit,policy_type,coverage_type,coverage_amount,premium,deductible,status,start_date,end_date,renewal_date)
    VALUES(p_provider_id,p_property_id,p_unit,p_policy_type,p_coverage_type,p_coverage_amount,p_premium,p_deductible,p_status,p_start_date,p_end_date,p_renewal_date) RETURNING id INTO v_id;
  ELSE
    PERFORM 1 FROM public.insurance_policies WHERE id=v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insurance policy not found' USING ERRCODE='P0002'; END IF;
    UPDATE public.insurance_policies SET provider_id=COALESCE(p_provider_id,provider_id),unit=COALESCE(p_unit,unit),policy_type=COALESCE(p_policy_type,policy_type),coverage_type=COALESCE(p_coverage_type,coverage_type),coverage_amount=p_coverage_amount,premium=p_premium,deductible=p_deductible,status=p_status,start_date=COALESCE(p_start_date,start_date),end_date=COALESCE(p_end_date,end_date),renewal_date=COALESCE(p_renewal_date,renewal_date) WHERE id=v_id AND property_id=p_property_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insurance policy portfolio mismatch' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN (SELECT to_jsonb(x) FROM public.insurance_policies x WHERE x.id=v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.transition_insurance_claim_atomic(p_claim_id uuid, p_target_status text, p_approved_amount numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_claim public.insurance_claims%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid AND role IN ('webhost','manager','submanager') ORDER BY CASE role WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Marketplace authorization required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_claim FROM public.insurance_claims WHERE id=p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insurance claim not found' USING ERRCODE='P0002'; END IF;
  IF v_role <> 'webhost' AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=v_claim.property_id AND p.manager_id=v_uid) THEN RAISE EXCEPTION 'Property portfolio authorization required' USING ERRCODE='42501'; END IF;
  IF p_target_status NOT IN ('submitted','under_review','approved','rejected','paid') THEN RAISE EXCEPTION 'Invalid claim status' USING ERRCODE='22023'; END IF;
  IF p_target_status='approved' AND (p_approved_amount IS NULL OR p_approved_amount < 0 OR p_approved_amount > v_claim.claim_amount) THEN RAISE EXCEPTION 'Approved amount must be between zero and claim amount' USING ERRCODE='22023'; END IF;
  IF p_target_status='paid' AND COALESCE(v_claim.approved_amount,0) <= 0 THEN RAISE EXCEPTION 'Claim must have a positive approved amount before payment' USING ERRCODE='22023'; END IF;
  UPDATE public.insurance_claims SET status=p_target_status, approved_amount=CASE WHEN p_target_status='approved' THEN p_approved_amount ELSE approved_amount END, approved_date=CASE WHEN p_target_status='approved' THEN now() ELSE approved_date END, paid_date=CASE WHEN p_target_status='paid' THEN now() ELSE paid_date END WHERE id=p_claim_id;
  RETURN (SELECT to_jsonb(x) FROM public.insurance_claims x WHERE x.id=p_claim_id);
END; $$;

REVOKE INSERT, UPDATE, DELETE ON public.insurance_policies FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.insurance_claims FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.save_insurance_policy_atomic(uuid,uuid,uuid,text,text,text,numeric,numeric,numeric,text,timestamptz,timestamptz,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_insurance_claim_atomic(uuid,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_insurance_policy_atomic(uuid,uuid,uuid,text,text,text,numeric,numeric,numeric,text,timestamptz,timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_insurance_claim_atomic(uuid,text,numeric) TO authenticated;
