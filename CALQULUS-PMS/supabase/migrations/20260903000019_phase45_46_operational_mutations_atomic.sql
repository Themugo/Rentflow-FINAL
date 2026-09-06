-- Phase 45-46: tenant screening/notices and unit operational mutations.
-- Client-facing authenticated writes are routed through server-authorized atomic RPCs.

CREATE OR REPLACE FUNCTION public.create_tenant_blacklist_atomic(
  p_tenant_id uuid DEFAULT NULL, p_property_id uuid DEFAULT NULL,
  p_tenant_name text DEFAULT NULL, p_tenant_email text DEFAULT NULL,
  p_tenant_phone text DEFAULT NULL, p_national_id text DEFAULT NULL,
  p_reason text DEFAULT NULL, p_category text DEFAULT 'other',
  p_severity text DEFAULT 'medium', p_incident_date date DEFAULT NULL,
  p_amount_owed numeric DEFAULT 0, p_notes text DEFAULT NULL,
  p_expires_at date DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_id uuid; v_manager uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  IF p_reason IS NULL OR trim(p_reason)='' THEN RAISE EXCEPTION 'Reason is required'; END IF;
  IF p_amount_owed < 0 THEN RAISE EXCEPTION 'Amount owed cannot be negative'; END IF;
  IF p_severity NOT IN ('low','medium','high','critical') THEN RAISE EXCEPTION 'Invalid severity'; END IF;
  IF p_property_id IS NOT NULL THEN
    SELECT manager_id INTO v_manager FROM public.properties WHERE id=p_property_id FOR UPDATE;
    IF NOT FOUND OR v_manager<>v_uid THEN RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='manager') THEN RAISE EXCEPTION 'Manager role required' USING ERRCODE='42501'; END IF;
  END IF;
  IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND (manager_id=v_uid OR property_id=p_property_id)) THEN RAISE EXCEPTION 'Tenant is outside your portfolio' USING ERRCODE='42501'; END IF;
  INSERT INTO public.tenant_blacklist(manager_id,tenant_id,property_id,tenant_name,tenant_email,tenant_phone,national_id,reason,category,severity,incident_date,amount_owed,notes,expires_at,is_active)
  VALUES(v_uid,p_tenant_id,p_property_id,NULLIF(trim(p_tenant_name),''),NULLIF(trim(p_tenant_email),''),NULLIF(trim(p_tenant_phone),''),NULLIF(trim(p_national_id),''),trim(p_reason),p_category,p_severity,p_incident_date,p_amount_owed,NULLIF(trim(p_notes),''),p_expires_at,true)
  RETURNING id INTO v_id; RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.remove_tenant_blacklist_atomic(p_entry_id uuid,p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid;
BEGIN
  v_uid:=auth.uid();
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  UPDATE public.tenant_blacklist SET is_active=false,removed_at=now(),removed_reason=NULLIF(trim(p_reason),'')
  WHERE id=p_entry_id AND manager_id=v_uid AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Screening record not found or unauthorized' USING ERRCODE='42501'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.create_tenant_notice_atomic(
  p_tenant_id uuid,p_unit_id uuid DEFAULT NULL,p_property_id uuid DEFAULT NULL,
  p_tenancy_id uuid DEFAULT NULL,p_notice_type text DEFAULT 'general',p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,p_current_rent numeric DEFAULT NULL,p_new_rent numeric DEFAULT NULL,
  p_effective_date date DEFAULT NULL,p_notice_period_days integer DEFAULT NULL,
  p_delivery_method text DEFAULT 'email',p_status text DEFAULT 'sent'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_id uuid; v_manager uuid; v_tenant public.tenants%ROWTYPE;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  IF p_title IS NULL OR trim(p_title)='' OR p_body IS NULL OR trim(p_body)='' THEN RAISE EXCEPTION 'Notice title and body are required'; END IF;
  IF p_status NOT IN ('draft','sent') THEN RAISE EXCEPTION 'Invalid notice status'; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found'; END IF;
  v_manager:=v_tenant.manager_id;
  IF v_manager<>v_uid OR (p_property_id IS NOT NULL AND v_tenant.property_id IS DISTINCT FROM p_property_id) THEN RAISE EXCEPTION 'Tenant is outside your portfolio' USING ERRCODE='42501'; END IF;
  IF p_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.units WHERE id=p_unit_id AND property_id=v_tenant.property_id) THEN RAISE EXCEPTION 'Unit does not belong to tenant property' USING ERRCODE='42501'; END IF;
  INSERT INTO public.tenant_notices(tenant_id,unit_id,property_id,manager_id,tenancy_id,notice_type,title,body,current_rent,new_rent,effective_date,notice_period_days,delivery_method,status,sent_at)
  VALUES(p_tenant_id,p_unit_id,v_tenant.property_id,v_uid,p_tenancy_id,p_notice_type,trim(p_title),trim(p_body),p_current_rent,p_new_rent,p_effective_date,p_notice_period_days,p_delivery_method,p_status,CASE WHEN p_status='sent' THEN now() ELSE NULL END)
  RETURNING id INTO v_id; RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.acknowledge_tenant_notice_atomic(p_notice_id uuid,p_response text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_tenant uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  SELECT t.id INTO v_tenant FROM public.tenants t JOIN public.user_roles ur ON ur.tenant_id=t.id WHERE ur.user_id=v_uid AND ur.role='tenant';
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Tenant identity required' USING ERRCODE='42501'; END IF;
  UPDATE public.tenant_notices SET tenant_acknowledged=true,tenant_ack_at=now(),tenant_response=NULLIF(trim(p_response),''),read_at=COALESCE(read_at,now()),status=CASE WHEN status IN ('sent','delivered') THEN 'acknowledged' ELSE status END
  WHERE id=p_notice_id AND tenant_id=v_tenant AND status<>'withdrawn';
  IF NOT FOUND THEN RAISE EXCEPTION 'Notice not found or unauthorized' USING ERRCODE='42501'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.issue_unit_key_atomic(
  p_unit_id uuid,p_key_type text,p_key_label text DEFAULT NULL,p_serial_number text DEFAULT NULL,
  p_issued_date date DEFAULT CURRENT_DATE,p_issued_to_name text DEFAULT NULL,p_tenant_id uuid DEFAULT NULL,p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_property uuid; v_id uuid;
BEGIN
  SELECT property_id INTO v_property FROM public.units WHERE id=p_unit_id FOR UPDATE;
  IF v_property IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=v_property AND manager_id=v_uid) THEN RAISE EXCEPTION 'Unit not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF p_key_type IS NULL OR trim(p_key_type)='' THEN RAISE EXCEPTION 'Key type is required'; END IF;
  IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND property_id=v_property AND unit_id=p_unit_id AND status='active') THEN RAISE EXCEPTION 'Tenant is not active in this unit' USING ERRCODE='42501'; END IF;
  INSERT INTO public.unit_key_records(unit_id,property_id,manager_id,tenant_id,key_type,key_label,serial_number,issued_date,issued_by,issued_to_name,notes,status)
  VALUES(p_unit_id,v_property,v_uid,p_tenant_id,trim(p_key_type),NULLIF(trim(p_key_label),''),NULLIF(trim(p_serial_number),''),p_issued_date,v_uid,NULLIF(trim(p_issued_to_name),''),NULLIF(trim(p_notes),''),'active') RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.return_unit_key_atomic(p_key_id uuid,p_returned_date date,p_return_condition text,p_replacement_cost numeric DEFAULT NULL,p_deducted_from_deposit boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid; v_status text; v_manager uuid;
BEGIN
  v_uid:=auth.uid();
  SELECT status,manager_id INTO v_status,v_manager FROM public.unit_key_records WHERE id=p_key_id FOR UPDATE;
  IF NOT FOUND OR v_manager<>v_uid THEN RAISE EXCEPTION 'Key record not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF v_status<>'active' THEN RAISE EXCEPTION 'Only active keys can be returned'; END IF;
  IF p_return_condition NOT IN ('good','damaged','lost') THEN RAISE EXCEPTION 'Invalid return condition'; END IF;
  IF p_replacement_cost IS NOT NULL AND p_replacement_cost<0 THEN RAISE EXCEPTION 'Replacement cost cannot be negative'; END IF;
  UPDATE public.unit_key_records SET returned_date=p_returned_date,returned_to=v_uid,return_condition=p_return_condition,replacement_cost=p_replacement_cost,deducted_from_deposit=p_deducted_from_deposit,status=CASE WHEN p_return_condition='lost' THEN 'lost' ELSE 'returned' END,updated_at=now() WHERE id=p_key_id;
END; $$;

CREATE OR REPLACE FUNCTION public.save_unit_amenity_atomic(p_amenity_id uuid DEFAULT NULL,p_unit_id uuid DEFAULT NULL,p_amenity_type text DEFAULT NULL,p_amenity_label text DEFAULT NULL,p_is_included boolean DEFAULT true,p_extra_charge numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_property uuid; v_id uuid;
BEGIN
  IF p_extra_charge<0 THEN RAISE EXCEPTION 'Extra charge cannot be negative'; END IF;
  IF p_amenity_id IS NOT NULL THEN SELECT property_id,unit_id INTO v_property,p_unit_id FROM public.unit_amenities WHERE id=p_amenity_id FOR UPDATE; ELSE SELECT property_id INTO v_property FROM public.units WHERE id=p_unit_id FOR UPDATE; END IF;
  IF v_property IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=v_property AND manager_id=v_uid) THEN RAISE EXCEPTION 'Amenity target unauthorized' USING ERRCODE='42501'; END IF;
  IF p_amenity_label IS NULL OR trim(p_amenity_label)='' THEN RAISE EXCEPTION 'Amenity label is required'; END IF;
  IF p_amenity_id IS NULL THEN
    INSERT INTO public.unit_amenities(unit_id,property_id,manager_id,amenity_type,amenity_label,is_included,extra_charge) VALUES(p_unit_id,v_property,v_uid,trim(p_amenity_type),trim(p_amenity_label),p_is_included,CASE WHEN p_is_included THEN 0 ELSE p_extra_charge END) RETURNING id INTO v_id;
  ELSE
    UPDATE public.unit_amenities SET amenity_type=trim(p_amenity_type),amenity_label=trim(p_amenity_label),is_included=p_is_included,extra_charge=CASE WHEN p_is_included THEN 0 ELSE p_extra_charge END WHERE id=p_amenity_id RETURNING id INTO v_id;
  END IF; RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_unit_amenity_atomic(p_amenity_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.unit_amenities a USING public.properties p WHERE a.id=p_amenity_id AND a.property_id=p.id AND p.manager_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Amenity not found or unauthorized' USING ERRCODE='42501'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.save_unit_utility_meter_atomic(p_meter_id uuid DEFAULT NULL,p_unit_id uuid DEFAULT NULL,p_utility_type text DEFAULT NULL,p_meter_number text DEFAULT NULL,p_meter_label text DEFAULT NULL,p_provider text DEFAULT NULL,p_account_number text DEFAULT NULL,p_billing_method text DEFAULT 'postpaid',p_rate_per_unit numeric DEFAULT NULL,p_is_active boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_property uuid; v_id uuid;
BEGIN
  IF p_meter_number IS NULL OR trim(p_meter_number)='' THEN RAISE EXCEPTION 'Meter number is required'; END IF;
  IF p_rate_per_unit IS NOT NULL AND p_rate_per_unit<0 THEN RAISE EXCEPTION 'Rate cannot be negative'; END IF;
  IF p_meter_id IS NOT NULL THEN SELECT property_id,unit_id INTO v_property,p_unit_id FROM public.unit_utility_meters WHERE id=p_meter_id FOR UPDATE; ELSE SELECT property_id INTO v_property FROM public.units WHERE id=p_unit_id FOR UPDATE; END IF;
  IF v_property IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=v_property AND manager_id=v_uid) THEN RAISE EXCEPTION 'Meter target unauthorized' USING ERRCODE='42501'; END IF;
  IF p_meter_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.unit_utility_meters WHERE unit_id=p_unit_id AND utility_type=p_utility_type) THEN RAISE EXCEPTION 'A meter for this utility type already exists'; END IF;
    INSERT INTO public.unit_utility_meters(unit_id,property_id,manager_id,utility_type,meter_number,meter_label,provider,account_number,billing_method,rate_per_unit,is_active) VALUES(p_unit_id,v_property,v_uid,trim(p_utility_type),trim(p_meter_number),NULLIF(trim(p_meter_label),''),NULLIF(trim(p_provider),''),NULLIF(trim(p_account_number),''),p_billing_method,p_rate_per_unit,p_is_active) RETURNING id INTO v_id;
  ELSE
    UPDATE public.unit_utility_meters SET meter_number=trim(p_meter_number),meter_label=NULLIF(trim(p_meter_label),''),provider=NULLIF(trim(p_provider),''),account_number=NULLIF(trim(p_account_number),''),billing_method=p_billing_method,rate_per_unit=p_rate_per_unit,is_active=p_is_active,updated_at=now() WHERE id=p_meter_id RETURNING id INTO v_id;
  END IF; RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_unit_utility_meter_reading_atomic(p_meter_id uuid,p_reading numeric,p_read_date date DEFAULT CURRENT_DATE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid; v_current numeric; v_manager uuid;
BEGIN
  v_uid:=auth.uid();
  SELECT current_reading,manager_id INTO v_current,v_manager FROM public.unit_utility_meters WHERE id=p_meter_id FOR UPDATE;
  IF NOT FOUND OR v_manager<>v_uid THEN RAISE EXCEPTION 'Meter not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF p_reading<0 OR p_reading<v_current THEN RAISE EXCEPTION 'Reading cannot be below the current reading'; END IF;
  UPDATE public.unit_utility_meters SET current_reading=p_reading,last_read_date=p_read_date,updated_at=now() WHERE id=p_meter_id;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_unit_utility_meter_atomic(p_meter_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.unit_utility_meters m USING public.properties p WHERE m.id=p_meter_id AND m.property_id=p.id AND p.manager_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Meter not found or unauthorized' USING ERRCODE='42501'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.save_unit_inspection_atomic(p_inspection_id uuid DEFAULT NULL,p_unit_id uuid DEFAULT NULL,p_tenant_id uuid DEFAULT NULL,p_tenancy_id uuid DEFAULT NULL,p_inspection_type text DEFAULT 'move_in',p_inspection_date date DEFAULT CURRENT_DATE,p_checklist_items jsonb DEFAULT '[]'::jsonb,p_damage_found boolean DEFAULT false,p_damage_description text DEFAULT NULL,p_notes text DEFAULT NULL,p_status text DEFAULT 'completed',p_tenant_present boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_property uuid; v_id uuid;
BEGIN
  IF p_inspection_id IS NOT NULL THEN SELECT property_id,unit_id INTO v_property,p_unit_id FROM public.unit_inspections WHERE id=p_inspection_id FOR UPDATE; ELSE SELECT property_id INTO v_property FROM public.units WHERE id=p_unit_id FOR UPDATE; END IF;
  IF v_property IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=v_property AND manager_id=v_uid) THEN RAISE EXCEPTION 'Inspection target unauthorized' USING ERRCODE='42501'; END IF;
  IF p_inspection_type NOT IN ('move_in','move_out','periodic','maintenance','complaint') THEN RAISE EXCEPTION 'Invalid inspection type'; END IF;
  IF p_inspection_id IS NULL THEN
    INSERT INTO public.unit_inspections(unit_id,property_id,manager_id,tenant_id,tenancy_id,inspection_type,inspection_date,conducted_by,checklist_items,damage_found,damage_description,notes,status,tenant_present) VALUES(p_unit_id,v_property,v_uid,p_tenant_id,p_tenancy_id,p_inspection_type,p_inspection_date,v_uid,p_checklist_items,p_damage_found,NULLIF(trim(p_damage_description),''),NULLIF(trim(p_notes),''),p_status,p_tenant_present) RETURNING id INTO v_id;
  ELSE
    UPDATE public.unit_inspections SET checklist_items=p_checklist_items,damage_found=p_damage_found,damage_description=NULLIF(trim(p_damage_description),''),notes=NULLIF(trim(p_notes),''),status=p_status,tenant_present=p_tenant_present,updated_at=now() WHERE id=p_inspection_id RETURNING id INTO v_id;
  END IF; RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.save_water_billing_config_atomic(p_config_id uuid DEFAULT NULL,p_property_id uuid DEFAULT NULL,p_billing_method text DEFAULT 'flat_rate',p_flat_rate_amount numeric DEFAULT 0,p_rate_per_unit numeric DEFAULT 0,p_water_provider text DEFAULT NULL,p_meter_number text DEFAULT NULL,p_invoice_mode text DEFAULT 'separate',p_billing_cycle_day numeric DEFAULT 1,p_is_active boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_id uuid;
BEGIN
  IF p_flat_rate_amount<0 OR p_rate_per_unit<0 OR p_billing_cycle_day<1 OR p_billing_cycle_day>31 THEN RAISE EXCEPTION 'Invalid water billing values'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND manager_id=v_uid) THEN RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF p_config_id IS NULL THEN
    INSERT INTO public.water_billing_config(property_id,manager_id,billing_method,flat_rate_amount,rate_per_unit,water_provider,meter_number,invoice_mode,billing_cycle_day,is_active) VALUES(p_property_id,v_uid,p_billing_method,p_flat_rate_amount,p_rate_per_unit,NULLIF(trim(p_water_provider),''),NULLIF(trim(p_meter_number),''),p_invoice_mode,p_billing_cycle_day,p_is_active) RETURNING id INTO v_id;
  ELSE
    UPDATE public.water_billing_config SET billing_method=p_billing_method,flat_rate_amount=p_flat_rate_amount,rate_per_unit=p_rate_per_unit,water_provider=NULLIF(trim(p_water_provider),''),meter_number=NULLIF(trim(p_meter_number),''),invoice_mode=p_invoice_mode,billing_cycle_day=p_billing_cycle_day,is_active=p_is_active,updated_at=now() WHERE id=p_config_id AND property_id=p_property_id AND manager_id=v_uid RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Water billing configuration not found or unauthorized' USING ERRCODE='42501'; END IF;
  END IF; RETURN v_id;
END; $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('create_tenant_blacklist_atomic(uuid,uuid,text,text,text,text,text,text,text,date,numeric,text,date)'),
    ('remove_tenant_blacklist_atomic(uuid,text)'),
    ('create_tenant_notice_atomic(uuid,uuid,uuid,uuid,text,text,text,numeric,numeric,date,integer,text,text)'),
    ('acknowledge_tenant_notice_atomic(uuid,text)'),
    ('issue_unit_key_atomic(uuid,text,text,text,date,text,uuid,text)'),
    ('return_unit_key_atomic(uuid,date,text,numeric,boolean)'),
    ('save_unit_amenity_atomic(uuid,uuid,text,text,boolean,numeric)'),
    ('delete_unit_amenity_atomic(uuid)'),
    ('save_unit_utility_meter_atomic(uuid,uuid,text,text,text,text,text,text,numeric,boolean)'),
    ('record_unit_utility_meter_reading_atomic(uuid,numeric,date)'),
    ('delete_unit_utility_meter_atomic(uuid)'),
    ('save_unit_inspection_atomic(uuid,uuid,uuid,uuid,text,date,jsonb,boolean,text,text,text,boolean)'),
    ('save_water_billing_config_atomic(uuid,uuid,text,numeric,numeric,text,text,text,numeric,boolean)')
  ) AS x(sig) LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.'||split_part(r.sig,'(',1)||'('||split_part(r.sig,'(',2)||' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||split_part(r.sig,'(',1)||'('||split_part(r.sig,'(',2)||' TO authenticated, service_role';
  END LOOP;
END $$;

REVOKE INSERT,UPDATE,DELETE ON public.tenant_blacklist, public.tenant_notices, public.unit_key_records, public.unit_amenities, public.unit_utility_meters, public.unit_inspections, public.water_billing_config FROM authenticated;
