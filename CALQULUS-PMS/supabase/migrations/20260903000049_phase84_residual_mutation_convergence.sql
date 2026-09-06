-- Phase 84: residual application mutation convergence
-- Close remaining browser DML gaps on insurance claims, tenant meter notifications,
-- utility-meter lifecycle toggles and profile-photo metadata.

CREATE OR REPLACE FUNCTION public.create_insurance_claim_atomic(
  p_policy_id uuid,
  p_provider_id uuid,
  p_property_id uuid,
  p_claim_type text,
  p_description text,
  p_claim_amount numeric,
  p_documents jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid AND role IN ('webhost','manager','submanager') ORDER BY CASE role WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END LIMIT 1;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Marketplace authorization required' USING ERRCODE='42501'; END IF;
  IF p_claim_amount IS NULL OR p_claim_amount <= 0 THEN RAISE EXCEPTION 'Claim amount must be positive' USING ERRCODE='22023'; END IF;
  IF p_policy_id IS NULL OR p_provider_id IS NULL OR p_property_id IS NULL THEN RAISE EXCEPTION 'Policy, provider and property are required' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.insurance_policies ip WHERE ip.id=p_policy_id AND ip.property_id=p_property_id AND ip.provider_id=p_provider_id) THEN RAISE EXCEPTION 'Insurance policy/provider/property mismatch' USING ERRCODE='42501'; END IF;
  IF v_role <> 'webhost' AND NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=v_uid) THEN RAISE EXCEPTION 'Property portfolio authorization required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.insurance_claims(policy_id,provider_id,property_id,claim_type,description,claim_amount,status,documents)
  VALUES(p_policy_id,p_provider_id,p_property_id,trim(p_claim_type),trim(p_description),p_claim_amount,'submitted',p_documents)
  RETURNING id INTO v_id;
  RETURN (SELECT to_jsonb(x) FROM public.insurance_claims x WHERE x.id=v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.notify_manager_of_tenant_meter_reading_atomic(
  p_unit_id uuid,
  p_reading numeric,
  p_consumption numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_tenant uuid; v_manager uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_reading < 0 OR p_consumption < 0 THEN RAISE EXCEPTION 'Meter values cannot be negative' USING ERRCODE='22023'; END IF;
  SELECT t.id,p.manager_id INTO v_tenant,v_manager
  FROM public.tenants t JOIN public.properties p ON p.id=t.property_id
  WHERE t.unit_id=p_unit_id AND t.status='active'
    AND (t.email = (SELECT email FROM auth.users WHERE id=v_uid)
         OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=v_uid AND ur.role='tenant' AND ur.tenant_id=t.id))
  ORDER BY t.id LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Tenant/unit authorization required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.in_app_notifications(user_id,manager_id,title,body,type,source,reference_type,reference_id)
  VALUES(v_manager,v_manager,'Meter reading submitted',format('A tenant submitted a water meter reading for Unit %s: %s m³ (consumption: %s m³)',p_unit_id,p_reading,p_consumption),'info','system','water_meter',p_unit_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.set_unit_utility_meter_active_atomic(p_meter_id uuid,p_is_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid; v_manager uuid;
BEGIN
  v_uid:=auth.uid();
  SELECT manager_id INTO v_manager FROM public.unit_utility_meters WHERE id=p_meter_id FOR UPDATE;
  IF v_manager IS NULL OR v_manager<>v_uid THEN RAISE EXCEPTION 'Meter not found or unauthorized' USING ERRCODE='42501'; END IF;
  UPDATE public.unit_utility_meters SET is_active=p_is_active,updated_at=now() WHERE id=p_meter_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_profile_photo_atomic(p_photo_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_photo_url IS NOT NULL AND length(p_photo_url)>2000 THEN RAISE EXCEPTION 'Photo URL is too long' USING ERRCODE='22023'; END IF;
  UPDATE public.profiles SET photo_url=p_photo_url WHERE id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found' USING ERRCODE='P0002'; END IF;
END; $$;

REVOKE INSERT,UPDATE,DELETE ON public.insurance_claims FROM authenticated,anon;
REVOKE INSERT,UPDATE,DELETE ON public.in_app_notifications FROM authenticated,anon;
REVOKE UPDATE ON public.unit_utility_meters FROM authenticated,anon;

REVOKE ALL ON FUNCTION public.create_insurance_claim_atomic(uuid,uuid,uuid,text,text,numeric,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_manager_of_tenant_meter_reading_atomic(uuid,numeric,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_unit_utility_meter_active_atomic(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_profile_photo_atomic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_insurance_claim_atomic(uuid,uuid,uuid,text,text,numeric,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_manager_of_tenant_meter_reading_atomic(uuid,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_unit_utility_meter_active_atomic(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_photo_atomic(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_manager_of_tenant_vehicle_request_atomic(
  p_plate_number text,p_vehicle_description text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid; v_tenant uuid; v_id uuid;
BEGIN
  SELECT t.id,t.manager_id INTO v_tenant,v_manager
  FROM public.tenants t
  WHERE t.status='active' AND (
    t.email=(SELECT email FROM auth.users WHERE id=v_uid)
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=v_uid AND ur.role='tenant' AND ur.tenant_id=t.id)
  ) ORDER BY t.id LIMIT 1;
  IF v_tenant IS NULL OR v_manager IS NULL THEN RAISE EXCEPTION 'Tenant account not found or unauthorized' USING ERRCODE='42501'; END IF;
  INSERT INTO public.in_app_notifications(user_id,manager_id,title,body,type,source,reference_type,reference_id)
  VALUES(v_manager,v_manager,'Vehicle registration request',format('Tenant submitted vehicle %s — approval required.',trim(p_vehicle_description)),'info','system','tenant_vehicle',v_tenant)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.notify_manager_of_tenant_vehicle_request_atomic(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_manager_of_tenant_vehicle_request_atomic(text,text) TO authenticated;
