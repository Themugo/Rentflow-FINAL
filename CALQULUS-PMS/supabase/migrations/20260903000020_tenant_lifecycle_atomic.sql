-- CALQULUS PMS — Phases 43–44
-- Atomic tenant lifecycle/profile/transfer and property financial configuration.

CREATE OR REPLACE FUNCTION public.update_tenant_profile_atomic(p_tenant_id uuid, p_payload jsonb)
RETURNS public.tenants
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.tenants%ROWTYPE; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT t.* INTO v FROM public.tenants t WHERE t.id=p_tenant_id
    AND (t.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=t.manager_id AND ms.submanager_user_id=v_uid) OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.tenant_id=t.id AND ur.user_id=v_uid AND ur.role='tenant'))
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF coalesce(p_payload->>'id_type',coalesce(v.id_type,'national_id')) NOT IN ('national_id','passport','alien_id','driving_license') THEN RAISE EXCEPTION 'Invalid ID type' USING ERRCODE='22023'; END IF;
  IF coalesce(p_payload->>'risk_flag',coalesce(v.risk_flag,'clear')) NOT IN ('clear','caution','blacklisted') THEN RAISE EXCEPTION 'Invalid risk flag' USING ERRCODE='22023'; END IF;
  IF coalesce((p_payload->>'adults_count')::int,coalesce(v.adults_count,1)) < 1 OR coalesce((p_payload->>'children_count')::int,coalesce(v.children_count,0)) < 0 THEN RAISE EXCEPTION 'Invalid occupant counts' USING ERRCODE='22023'; END IF;
  UPDATE public.tenants SET
    name=coalesce(nullif(trim(p_payload->>'name'),''),v.name), phone=coalesce(p_payload->>'phone',v.phone), email=coalesce(nullif(trim(p_payload->>'email'),''),v.email),
    national_id=p_payload->>'national_id', id_type=coalesce(p_payload->>'id_type',v.id_type),
    date_of_birth=nullif(p_payload->>'date_of_birth','')::date, gender=p_payload->>'gender', nationality=p_payload->>'nationality',
    employment_status=p_payload->>'employment_status', employer_name=p_payload->>'employer_name', employer_phone=p_payload->>'employer_phone',
    employer_address=p_payload->>'employer_address', occupation=p_payload->>'occupation', monthly_income=nullif(p_payload->>'monthly_income','')::numeric,
    emergency_contact_name=p_payload->>'emergency_contact_name', emergency_contact_phone=p_payload->>'emergency_contact_phone', emergency_contact_relationship=p_payload->>'emergency_contact_relationship',
    previous_landlord_name=p_payload->>'previous_landlord_name', previous_landlord_phone=p_payload->>'previous_landlord_phone', previous_address=p_payload->>'previous_address',
    risk_flag=coalesce(p_payload->>'risk_flag',v.risk_flag), risk_reason=p_payload->>'risk_reason',
    adults_count=coalesce((p_payload->>'adults_count')::int,v.adults_count,1), children_count=coalesce((p_payload->>'children_count')::int,v.children_count,0),
    photo_url=coalesce(p_payload->>'photo_url',v.photo_url), updated_at=now()
  WHERE id=v.id RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_tenant_creation_atomic(p_tenant_id uuid, p_payload jsonb)
RETURNS public.tenants
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.tenants%ROWTYPE; v_uid uuid:=auth.uid();
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT t.* INTO v FROM public.tenants t WHERE t.id=p_tenant_id AND t.manager_id=v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found or unauthorized' USING ERRCODE='42501'; END IF;
  UPDATE public.tenants SET deposit_months=nullif(p_payload->>'deposit_months','')::numeric, other_charges=nullif(p_payload->>'other_charges','')::numeric, other_charges_description=p_payload->>'other_charges_description', deposit_balance=nullif(p_payload->>'deposit_balance','')::numeric, photo_url=coalesce(p_payload->>'photo_url',photo_url), updated_at=now() WHERE id=v.id RETURNING * INTO v;
  INSERT INTO public.tenant_history(tenant_id,action,description) VALUES(v.id,'Created',coalesce(p_payload->>'history_description','Tenant account created'));
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_tenant_atomic(p_tenant_id uuid, p_property_id uuid, p_unit_id uuid DEFAULT NULL, p_unit_number text DEFAULT NULL, p_destination_manager_id uuid DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS public.tenants
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tenants%ROWTYPE; src public.properties%ROWTYPE; dst public.properties%ROWTYPE; u public.units%ROWTYPE; v_uid uuid := auth.uid(); v_old_property text; v_old_unit text; v_unit_id uuid := p_unit_id;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR NOT (t.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=t.manager_id AND ms.submanager_user_id=v_uid)) THEN RAISE EXCEPTION 'Tenant not found or unauthorized' USING ERRCODE='42501'; END IF;
  SELECT * INTO dst FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF NOT FOUND OR NOT (dst.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=dst.manager_id AND ms.submanager_user_id=v_uid)) THEN RAISE EXCEPTION 'Destination property unauthorized' USING ERRCODE='42501'; END IF;
  v_old_property := t.property; v_old_unit := t.unit;
  IF t.property_id IS NOT NULL THEN SELECT * INTO src FROM public.properties WHERE id=t.property_id FOR UPDATE; END IF;
  IF v_unit_id IS NULL AND nullif(trim(p_unit_number),'') IS NOT NULL THEN SELECT id INTO v_unit_id FROM public.units WHERE property_id=p_property_id AND lower(unit_number)=lower(trim(p_unit_number)) FOR UPDATE; END IF;
  IF v_unit_id IS NOT NULL THEN
    SELECT * INTO u FROM public.units WHERE id=v_unit_id AND property_id=p_property_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Destination unit not found' USING ERRCODE='42501'; END IF;
    IF u.status='inactive' THEN RAISE EXCEPTION 'Destination unit is inactive' USING ERRCODE='22023'; END IF;
    IF EXISTS (SELECT 1 FROM public.tenants x WHERE x.id<>t.id AND x.unit_id=u.id AND x.status='active') THEN RAISE EXCEPTION 'Destination unit already has an active tenant' USING ERRCODE='23505'; END IF;
  END IF;
  IF p_destination_manager_id IS NOT NULL AND p_destination_manager_id IS DISTINCT FROM dst.manager_id THEN RAISE EXCEPTION 'Destination manager mismatch' USING ERRCODE='22023'; END IF;
  UPDATE public.tenants SET manager_id=dst.manager_id, property_id=p_property_id, property=dst.name, unit_id=v_unit_id, unit=CASE WHEN v_unit_id IS NULL THEN NULL ELSE u.unit_number END, updated_at=now() WHERE id=t.id RETURNING * INTO t;
  INSERT INTO public.tenant_history(tenant_id,action,description) VALUES (t.id,'Transfer',format('Transferred from %s%s to %s%s. %s',coalesce(v_old_property,'Unassigned'),CASE WHEN v_old_unit IS NULL THEN '' ELSE ' - Unit '||v_old_unit END,dst.name,CASE WHEN p_unit_id IS NULL THEN '' ELSE ' - Unit '||u.unit_number END,coalesce(nullif(trim(p_notes),''),'')));
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.save_property_billing_config_atomic(p_property_id uuid, p_payload jsonb)
RETURNS public.property_billing_config
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_billing_config%ROWTYPE; v_uid uuid := auth.uid(); v_manager uuid;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT manager_id INTO v_manager FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF v_manager IS NULL OR NOT (v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid)) THEN RAISE EXCEPTION 'Property unauthorized' USING ERRCODE='42501'; END IF;
  IF coalesce(p_payload->>'invoice_mode','compiled') NOT IN ('compiled','separate','rent_only','grouped') THEN RAISE EXCEPTION 'Invalid invoice mode' USING ERRCODE='22023'; END IF;
  IF coalesce((p_payload->>'due_day_of_month')::int,1) NOT BETWEEN 1 AND 28 OR coalesce((p_payload->>'auto_generate_day')::int,25) NOT BETWEEN 1 AND 28 THEN RAISE EXCEPTION 'Invalid billing day' USING ERRCODE='22023'; END IF;
  IF coalesce((p_payload->>'grace_period_days')::int,0)<0 OR coalesce((p_payload->>'notify_before_days')::int,0)<0 THEN RAISE EXCEPTION 'Invalid billing intervals' USING ERRCODE='22023'; END IF;
  IF coalesce((p_payload->>'late_penalty_amount')::numeric,0)<0 OR coalesce((p_payload->>'late_penalty_pct')::numeric,0) NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid penalty' USING ERRCODE='22023'; END IF;
  INSERT INTO public.property_billing_config(property_id,manager_id,invoice_mode,due_day_of_month,grace_period_days,late_penalty_enabled,late_penalty_type,late_penalty_amount,late_penalty_pct,auto_generate_monthly,auto_generate_day,notify_before_days,invoice_prefix,receipt_prefix)
  VALUES(p_property_id,v_manager,coalesce(p_payload->>'invoice_mode','compiled'),coalesce((p_payload->>'due_day_of_month')::int,1),coalesce((p_payload->>'grace_period_days')::int,0),coalesce((p_payload->>'late_penalty_enabled')::boolean,false),coalesce(p_payload->>'late_penalty_type','fixed'),coalesce((p_payload->>'late_penalty_amount')::numeric,0),coalesce((p_payload->>'late_penalty_pct')::numeric,0),coalesce((p_payload->>'auto_generate_monthly')::boolean,true),coalesce((p_payload->>'auto_generate_day')::int,25),coalesce((p_payload->>'notify_before_days')::int,3),coalesce(nullif(trim(p_payload->>'invoice_prefix'),''),'INV'),coalesce(nullif(trim(p_payload->>'receipt_prefix'),''),'RCP'))
  ON CONFLICT(property_id) DO UPDATE SET manager_id=EXCLUDED.manager_id,invoice_mode=EXCLUDED.invoice_mode,due_day_of_month=EXCLUDED.due_day_of_month,grace_period_days=EXCLUDED.grace_period_days,late_penalty_enabled=EXCLUDED.late_penalty_enabled,late_penalty_type=EXCLUDED.late_penalty_type,late_penalty_amount=EXCLUDED.late_penalty_amount,late_penalty_pct=EXCLUDED.late_penalty_pct,auto_generate_monthly=EXCLUDED.auto_generate_monthly,auto_generate_day=EXCLUDED.auto_generate_day,notify_before_days=EXCLUDED.notify_before_days,invoice_prefix=EXCLUDED.invoice_prefix,receipt_prefix=EXCLUDED.receipt_prefix,updated_at=now()
  RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.save_property_deduction_atomic(p_deduction_id uuid, p_property_id uuid, p_payload jsonb)
RETURNS public.property_deductions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_deductions%ROWTYPE; v_uid uuid:=auth.uid(); v_manager uuid;
BEGIN
  SELECT manager_id INTO v_manager FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF v_manager IS NULL OR NOT(v_manager=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid)) THEN RAISE EXCEPTION 'Property unauthorized' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_payload->>'deduction_name'),'') IS NULL OR coalesce((p_payload->>'amount')::numeric,0)<0 THEN RAISE EXCEPTION 'Invalid deduction' USING ERRCODE='22023'; END IF;
  IF coalesce(p_payload->>'deduction_type','fixed') NOT IN ('fixed','percentage') THEN RAISE EXCEPTION 'Invalid deduction type' USING ERRCODE='22023'; END IF;
  INSERT INTO public.property_deductions(id,property_id,manager_id,deduction_name,deduction_type,amount,is_recurring,is_active) VALUES(coalesce(p_deduction_id,gen_random_uuid()),p_property_id,v_manager,trim(p_payload->>'deduction_name'),coalesce(p_payload->>'deduction_type','fixed'),coalesce((p_payload->>'amount')::numeric,0),coalesce((p_payload->>'is_recurring')::boolean,true),coalesce((p_payload->>'is_active')::boolean,true))
  ON CONFLICT(id) DO UPDATE SET deduction_name=EXCLUDED.deduction_name,deduction_type=EXCLUDED.deduction_type,amount=EXCLUDED.amount,is_recurring=EXCLUDED.is_recurring,is_active=EXCLUDED.is_active,updated_at=now()
  RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.transition_property_deduction_atomic(p_id uuid,p_is_active boolean)
RETURNS public.property_deductions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_deductions%ROWTYPE;
BEGIN SELECT d.* INTO v FROM public.property_deductions d JOIN public.properties p ON p.id=d.property_id WHERE d.id=p_id AND (p.manager_id=auth.uid() OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=auth.uid())) FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Deduction not found or unauthorized' USING ERRCODE='42501'; END IF; UPDATE public.property_deductions SET is_active=p_is_active,updated_at=now() WHERE id=p_id RETURNING * INTO v; RETURN v; END $$;

CREATE OR REPLACE FUNCTION public.delete_property_deduction_atomic(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT EXISTS(SELECT 1 FROM public.property_deductions d JOIN public.properties p ON p.id=d.property_id WHERE d.id=p_id AND (p.manager_id=auth.uid() OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=auth.uid()))) THEN RAISE EXCEPTION 'Deduction not found or unauthorized' USING ERRCODE='42501'; END IF; DELETE FROM public.property_deductions WHERE id=p_id; END $$;

CREATE OR REPLACE FUNCTION public.save_property_amenity_charge_atomic(p_charge_id uuid,p_property_id uuid,p_unit_id uuid,p_payload jsonb)
RETURNS public.property_amenity_charges LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_amenity_charges%ROWTYPE; v_uid uuid:=auth.uid(); v_manager uuid;
BEGIN
  SELECT manager_id INTO v_manager FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF v_manager IS NULL OR NOT(v_manager=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid)) THEN RAISE EXCEPTION 'Property unauthorized' USING ERRCODE='42501'; END IF;
  IF p_unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.units WHERE id=p_unit_id AND property_id=p_property_id) THEN RAISE EXCEPTION 'Unit does not belong to property' USING ERRCODE='22023'; END IF;
  IF nullif(trim(p_payload->>'charge_type'),'') IS NULL OR nullif(trim(p_payload->>'charge_label'),'') IS NULL OR coalesce((p_payload->>'amount')::numeric,0)<0 THEN RAISE EXCEPTION 'Invalid amenity charge' USING ERRCODE='22023'; END IF;
  INSERT INTO public.property_amenity_charges(id,property_id,unit_id,manager_id,charge_type,charge_label,amount,is_active) VALUES(coalesce(p_charge_id,gen_random_uuid()),p_property_id,p_unit_id,v_manager,trim(p_payload->>'charge_type'),trim(p_payload->>'charge_label'),coalesce((p_payload->>'amount')::numeric,0),coalesce((p_payload->>'is_active')::boolean,true))
  ON CONFLICT(id) DO UPDATE SET unit_id=EXCLUDED.unit_id,charge_type=EXCLUDED.charge_type,charge_label=EXCLUDED.charge_label,amount=EXCLUDED.amount,is_active=EXCLUDED.is_active,updated_at=now()
  RETURNING * INTO v; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.transition_property_amenity_charge_atomic(p_id uuid,p_is_active boolean)
RETURNS public.property_amenity_charges LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_amenity_charges%ROWTYPE;
BEGIN SELECT a.* INTO v FROM public.property_amenity_charges a JOIN public.properties p ON p.id=a.property_id WHERE a.id=p_id AND (p.manager_id=auth.uid() OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=auth.uid())) FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Amenity charge not found or unauthorized' USING ERRCODE='42501'; END IF; UPDATE public.property_amenity_charges SET is_active=p_is_active,updated_at=now() WHERE id=p_id RETURNING * INTO v; RETURN v; END $$;

CREATE OR REPLACE FUNCTION public.delete_property_amenity_charge_atomic(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT EXISTS(SELECT 1 FROM public.property_amenity_charges a JOIN public.properties p ON p.id=a.property_id WHERE a.id=p_id AND (p.manager_id=auth.uid() OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=auth.uid()))) THEN RAISE EXCEPTION 'Amenity charge not found or unauthorized' USING ERRCODE='42501'; END IF; DELETE FROM public.property_amenity_charges WHERE id=p_id; END $$;

REVOKE INSERT,UPDATE,DELETE ON public.property_billing_config,public.property_deductions,public.property_amenity_charges FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_profile_atomic(uuid,jsonb),public.finalize_tenant_creation_atomic(uuid,jsonb),public.transfer_tenant_atomic(uuid,uuid,uuid,text,uuid,text),public.save_property_billing_config_atomic(uuid,jsonb),public.save_property_deduction_atomic(uuid,uuid,jsonb),public.transition_property_deduction_atomic(uuid,boolean),public.delete_property_deduction_atomic(uuid),public.save_property_amenity_charge_atomic(uuid,uuid,uuid,jsonb),public.transition_property_amenity_charge_atomic(uuid,boolean),public.delete_property_amenity_charge_atomic(uuid) TO authenticated,service_role;
