-- CALQULUS Phase 36: water billing lifecycle integrity.

CREATE OR REPLACE FUNCTION public.save_water_billing_config_atomic(
  p_property_id uuid,
  p_billing_method text,
  p_rate_per_unit numeric DEFAULT NULL,
  p_flat_rate_amount numeric DEFAULT NULL,
  p_invoice_mode text DEFAULT 'separate',
  p_billing_cycle_day numeric DEFAULT 1,
  p_meter_number text DEFAULT NULL,
  p_water_provider text DEFAULT NULL,
  p_is_active boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid := public.get_effective_manager_id(); v_id uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF v_manager IS NULL OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=v_manager) THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_billing_method NOT IN ('meter','flat_rate') THEN RAISE EXCEPTION 'Invalid billing method' USING ERRCODE='22023'; END IF;
  IF p_invoice_mode NOT IN ('separate','bundled') THEN RAISE EXCEPTION 'Invalid invoice mode' USING ERRCODE='22023'; END IF;
  IF p_rate_per_unit IS NOT NULL AND p_rate_per_unit < 0 THEN RAISE EXCEPTION 'Rate cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_flat_rate_amount IS NOT NULL AND p_flat_rate_amount < 0 THEN RAISE EXCEPTION 'Flat rate cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_billing_cycle_day < 1 OR p_billing_cycle_day > 31 THEN RAISE EXCEPTION 'Invalid billing cycle day' USING ERRCODE='22023'; END IF;
  SELECT id INTO v_id FROM public.water_billing_config WHERE property_id=p_property_id FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.water_billing_config(manager_id,property_id,billing_method,rate_per_unit,flat_rate_amount,invoice_mode,billing_cycle_day,meter_number,water_provider,is_active)
    VALUES(v_manager,p_property_id,p_billing_method,p_rate_per_unit,p_flat_rate_amount,p_invoice_mode,p_billing_cycle_day,nullif(trim(p_meter_number),''),nullif(trim(p_water_provider),''),p_is_active) RETURNING id INTO v_id;
  ELSE
    UPDATE public.water_billing_config SET manager_id=v_manager,billing_method=p_billing_method,rate_per_unit=p_rate_per_unit,flat_rate_amount=p_flat_rate_amount,invoice_mode=p_invoice_mode,billing_cycle_day=p_billing_cycle_day,meter_number=nullif(trim(p_meter_number),''),water_provider=nullif(trim(p_water_provider),''),is_active=p_is_active,updated_at=now() WHERE id=v_id;
  END IF;
  RETURN jsonb_build_object('success',true,'config_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.record_water_meter_reading_atomic(
  p_property_id uuid,p_unit_id uuid,p_previous_reading numeric,p_current_reading numeric,p_rate_per_unit numeric,p_reading_date date DEFAULT CURRENT_DATE,p_total_amount numeric DEFAULT NULL,p_notes text DEFAULT NULL,p_billing_period_start text DEFAULT NULL,p_billing_period_end text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=public.get_effective_manager_id(); v_id uuid; v_consumption numeric; v_property uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF p_previous_reading < 0 OR p_current_reading < 0 OR p_current_reading < p_previous_reading THEN RAISE EXCEPTION 'Invalid meter sequence' USING ERRCODE='22023'; END IF;
  IF p_rate_per_unit < 0 THEN RAISE EXCEPTION 'Rate cannot be negative' USING ERRCODE='22023'; END IF;
  SELECT property_id INTO v_property FROM public.units WHERE id=p_unit_id FOR UPDATE;
  IF v_property IS DISTINCT FROM p_property_id OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=v_manager) THEN RAISE EXCEPTION 'Unit/property outside manager scope' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_unit_id::text,20260936));
  IF EXISTS(SELECT 1 FROM public.water_meter_readings WHERE unit_id=p_unit_id AND reading_date=p_reading_date) THEN RAISE EXCEPTION 'A reading already exists for this unit and date' USING ERRCODE='23505'; END IF;
  v_consumption:=p_current_reading-p_previous_reading;
  INSERT INTO public.water_meter_readings(manager_id,property_id,unit_id,previous_reading,current_reading,consumption,rate_per_unit,total_amount,reading_date,status,notes,billing_period_start,billing_period_end)
  VALUES(v_manager,p_property_id,p_unit_id,p_previous_reading,p_current_reading,v_consumption,p_rate_per_unit,COALESCE(p_total_amount,v_consumption*p_rate_per_unit),p_reading_date,'pending',nullif(trim(p_notes),''),nullif(trim(p_billing_period_start),''),nullif(trim(p_billing_period_end),'')) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'reading_id',v_id,'consumption',v_consumption,'total_amount',COALESCE(p_total_amount,v_consumption*p_rate_per_unit));
END; $$;

CREATE OR REPLACE FUNCTION public.submit_tenant_water_reading_atomic(
  p_unit_id uuid,p_previous_reading numeric,p_current_reading numeric,p_rate_per_unit numeric,p_reading_date date DEFAULT CURRENT_DATE,p_tenant_photo_url text DEFAULT NULL,p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant uuid; v_manager uuid; v_property uuid; v_id uuid; v_consumption numeric;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.user_roles WHERE user_id=auth.uid() AND role='tenant' LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Tenant authorization required' USING ERRCODE='42501'; END IF;
  SELECT t.manager_id,t.property_id INTO v_manager,v_property FROM public.tenants t WHERE t.id=v_tenant AND t.unit_id=p_unit_id FOR UPDATE;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Tenant/unit relationship not found' USING ERRCODE='42501'; END IF;
  IF p_current_reading < p_previous_reading OR p_previous_reading < 0 OR p_current_reading < 0 OR p_rate_per_unit < 0 THEN RAISE EXCEPTION 'Invalid meter values' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_unit_id::text,20260936));
  IF EXISTS(SELECT 1 FROM public.water_meter_readings WHERE unit_id=p_unit_id AND reading_date=p_reading_date) THEN RAISE EXCEPTION 'A reading already exists for this unit and date' USING ERRCODE='23505'; END IF;
  v_consumption:=p_current_reading-p_previous_reading;
  INSERT INTO public.water_meter_readings(manager_id,property_id,unit_id,previous_reading,current_reading,consumption,rate_per_unit,total_amount,reading_date,status,notes,submitted_by_tenant,tenant_user_id,tenant_photo_url,manager_verified)
  VALUES(v_manager,v_property,p_unit_id,p_previous_reading,p_current_reading,v_consumption,p_rate_per_unit,v_consumption*p_rate_per_unit,p_reading_date,'pending',COALESCE(NULLIF(trim(p_notes),''),'Self-reported by tenant'),true,auth.uid(),p_tenant_photo_url,false) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'reading_id',v_id,'manager_id',v_manager,'consumption',v_consumption,'total_amount',v_consumption*p_rate_per_unit);
END; $$;

CREATE OR REPLACE FUNCTION public.dispute_water_reading_atomic(p_reading_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.water_meter_readings%ROWTYPE; v_tenant uuid; v_manager uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Dispute reason is required' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM public.water_meter_readings WHERE id=p_reading_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Reading not found' USING ERRCODE='P0002'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.user_roles WHERE user_id=auth.uid() AND role='tenant' LIMIT 1;
  IF v_tenant IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenants t WHERE t.id=v_tenant AND t.unit_id=r.unit_id AND t.property_id=r.property_id) THEN RAISE EXCEPTION 'Reading outside tenant scope' USING ERRCODE='42501'; END IF;
  UPDATE public.water_meter_readings SET disputed=true,dispute_reason=trim(p_reason),updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'reading_id',r.id);
END; $$;

CREATE OR REPLACE FUNCTION public.link_water_reading_invoice_atomic(p_reading_id uuid,p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.water_meter_readings%ROWTYPE; v_manager uuid:=public.get_effective_manager_id();
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.water_meter_readings WHERE id=p_reading_id FOR UPDATE;
  IF r.id IS NULL OR r.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Reading outside manager scope' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=p_invoice_id AND i.manager_id=v_manager) THEN RAISE EXCEPTION 'Invoice outside manager scope' USING ERRCODE='42501'; END IF;
  IF r.invoice_id IS NOT NULL AND r.invoice_id IS DISTINCT FROM p_invoice_id THEN RAISE EXCEPTION 'Reading is already linked to another invoice' USING ERRCODE='55000'; END IF;
  UPDATE public.water_meter_readings SET invoice_id=p_invoice_id,status='invoiced',updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'reading_id',r.id,'invoice_id',p_invoice_id);
END; $$;

REVOKE ALL ON FUNCTION public.save_water_billing_config_atomic(uuid,text,numeric,numeric,text,numeric,text,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.record_water_meter_reading_atomic(uuid,uuid,numeric,numeric,numeric,date,numeric,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.submit_tenant_water_reading_atomic(uuid,numeric,numeric,numeric,date,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.dispute_water_reading_atomic(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.link_water_reading_invoice_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_water_billing_config_atomic(uuid,text,numeric,numeric,text,numeric,text,text,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_water_meter_reading_atomic(uuid,uuid,numeric,numeric,numeric,date,numeric,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_tenant_water_reading_atomic(uuid,numeric,numeric,numeric,date,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.dispute_water_reading_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.link_water_reading_invoice_atomic(uuid,uuid) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.water_billing_config FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.water_meter_readings FROM authenticated;

-- Unit-level utility meters are part of the same utility control plane.
CREATE OR REPLACE FUNCTION public.save_unit_utility_meter_atomic(
  p_unit_id uuid,
  p_property_id uuid,
  p_utility_type text,
  p_meter_number text,
  p_meter_label text DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_account_number text DEFAULT NULL,
  p_billing_method text DEFAULT 'prepaid',
  p_rate_per_unit numeric DEFAULT NULL,
  p_is_active boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=public.get_effective_manager_id(); v_id uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_meter_number),'') IS NULL THEN RAISE EXCEPTION 'Meter number is required' USING ERRCODE='22023'; END IF;
  IF p_utility_type NOT IN ('water','electricity','gas','internet') THEN RAISE EXCEPTION 'Invalid utility type' USING ERRCODE='22023'; END IF;
  IF p_billing_method NOT IN ('prepaid','postpaid','flat_rate') THEN RAISE EXCEPTION 'Invalid billing method' USING ERRCODE='22023'; END IF;
  IF p_rate_per_unit IS NOT NULL AND p_rate_per_unit < 0 THEN RAISE EXCEPTION 'Rate cannot be negative' USING ERRCODE='22023'; END IF;
  IF v_manager IS NULL OR NOT EXISTS(SELECT 1 FROM public.units u JOIN public.properties p ON p.id=u.property_id WHERE u.id=p_unit_id AND u.property_id=p_property_id AND p.manager_id=v_manager) THEN RAISE EXCEPTION 'Unit/property outside manager scope' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_id FROM public.unit_utility_meters WHERE unit_id=p_unit_id AND utility_type=p_utility_type FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.unit_utility_meters(unit_id,property_id,manager_id,utility_type,meter_number,meter_label,provider,account_number,billing_method,rate_per_unit,is_active)
    VALUES(p_unit_id,p_property_id,v_manager,p_utility_type,trim(p_meter_number),nullif(trim(p_meter_label),''),nullif(trim(p_provider),''),nullif(trim(p_account_number),''),p_billing_method,p_rate_per_unit,p_is_active) RETURNING id INTO v_id;
  ELSE
    UPDATE public.unit_utility_meters SET meter_number=trim(p_meter_number),meter_label=nullif(trim(p_meter_label),''),provider=nullif(trim(p_provider),''),account_number=nullif(trim(p_account_number),''),billing_method=p_billing_method,rate_per_unit=p_rate_per_unit,is_active=p_is_active,updated_at=now() WHERE id=v_id;
  END IF;
  RETURN jsonb_build_object('success',true,'meter_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.update_unit_utility_meter_reading_atomic(p_meter_id uuid,p_reading numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=public.get_effective_manager_id(); v_old numeric;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_reading < 0 THEN RAISE EXCEPTION 'Reading cannot be negative' USING ERRCODE='22023'; END IF;
  SELECT current_reading INTO v_old FROM public.unit_utility_meters WHERE id=p_meter_id AND manager_id=v_manager FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meter outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_reading < COALESCE(v_old,0) THEN RAISE EXCEPTION 'Reading cannot decrease' USING ERRCODE='22023'; END IF;
  UPDATE public.unit_utility_meters SET current_reading=p_reading,last_read_date=CURRENT_DATE,updated_at=now() WHERE id=p_meter_id;
  RETURN jsonb_build_object('success',true,'meter_id',p_meter_id,'current_reading',p_reading);
END; $$;

CREATE OR REPLACE FUNCTION public.set_unit_utility_meter_active_atomic(p_meter_id uuid,p_is_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=public.get_effective_manager_id();
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  UPDATE public.unit_utility_meters SET is_active=p_is_active,updated_at=now() WHERE id=p_meter_id AND manager_id=v_manager;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meter outside manager scope' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('success',true,'meter_id',p_meter_id,'is_active',p_is_active);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_unit_utility_meter_atomic(p_meter_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid:=public.get_effective_manager_id();
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  DELETE FROM public.unit_utility_meters WHERE id=p_meter_id AND manager_id=v_manager;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meter outside manager scope' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('success',true,'meter_id',p_meter_id);
END; $$;

REVOKE ALL ON FUNCTION public.save_unit_utility_meter_atomic(uuid,uuid,text,text,text,text,text,text,numeric,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_unit_utility_meter_reading_atomic(uuid,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_unit_utility_meter_active_atomic(uuid,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_unit_utility_meter_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_unit_utility_meter_atomic(uuid,uuid,text,text,text,text,text,text,numeric,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.update_unit_utility_meter_reading_atomic(uuid,numeric) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_unit_utility_meter_active_atomic(uuid,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_unit_utility_meter_atomic(uuid) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.unit_utility_meters FROM authenticated;
