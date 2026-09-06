-- Phase 36: water meter reading lifecycle atomicity.
-- Financially relevant readings must enter and transition through controlled RPCs.

CREATE OR REPLACE FUNCTION public.create_water_meter_reading_atomic(
  p_property_id uuid,
  p_unit_id uuid,
  p_previous_reading numeric,
  p_current_reading numeric,
  p_rate_per_unit numeric,
  p_reading_date date,
  p_billing_period_start text DEFAULT NULL,
  p_billing_period_end text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_submitted_by_tenant boolean DEFAULT false,
  p_tenant_user_id uuid DEFAULT NULL,
  p_tenant_photo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_manager uuid; v_id uuid; v_amount numeric; v_consumption numeric;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  IF p_previous_reading < 0 OR p_current_reading < 0 OR p_current_reading < p_previous_reading THEN RAISE EXCEPTION 'Invalid meter readings' USING ERRCODE='22023'; END IF;
  IF p_rate_per_unit < 0 OR p_reading_date IS NULL THEN RAISE EXCEPTION 'Invalid water billing values' USING ERRCODE='22023'; END IF;

  SELECT manager_id INTO v_manager FROM public.properties WHERE id=p_property_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Property not found'; END IF;

  IF p_submitted_by_tenant THEN
    IF p_tenant_user_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Tenant identity mismatch' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id IN (SELECT tenant_id FROM public.user_roles WHERE user_id=v_uid AND role='tenant') AND t.property_id=p_property_id AND t.unit_id=p_unit_id AND t.manager_id=v_manager) THEN
      RAISE EXCEPTION 'Tenant is not assigned to this unit' USING ERRCODE='42501';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='manager') OR v_manager<>v_uid THEN
      RAISE EXCEPTION 'Only the property manager can record this reading' USING ERRCODE='42501';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.units WHERE id=p_unit_id AND property_id=p_property_id) THEN
    RAISE EXCEPTION 'Unit does not belong to property' USING ERRCODE='42501';
  END IF;

  v_consumption := p_current_reading-p_previous_reading;
  v_amount := v_consumption*p_rate_per_unit;
  INSERT INTO public.water_meter_readings(
    unit_id,property_id,manager_id,previous_reading,current_reading,consumption,rate_per_unit,total_amount,
    reading_date,billing_period_start,billing_period_end,notes,status,submitted_by_tenant,tenant_user_id,tenant_photo_url,manager_verified
  ) VALUES (
    p_unit_id,p_property_id,v_manager,p_previous_reading,p_current_reading,v_consumption,p_rate_per_unit,v_amount,
    p_reading_date,p_billing_period_start,p_billing_period_end,NULLIF(trim(p_notes),''),'pending',p_submitted_by_tenant,
    CASE WHEN p_submitted_by_tenant THEN v_uid ELSE NULL END,p_tenant_photo_url,NOT p_submitted_by_tenant
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_water_meter_reading_atomic(
  p_reading_id uuid,
  p_action text,
  p_invoice_id uuid DEFAULT NULL,
  p_dispute_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_r public.water_meter_readings%ROWTYPE; v_tenant uuid; v_manager uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_r FROM public.water_meter_readings WHERE id=p_reading_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Water reading not found'; END IF;
  v_manager:=v_r.manager_id;

  IF p_action='dispute' THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.tenants t ON t.id=ur.tenant_id WHERE ur.user_id=v_uid AND ur.role='tenant' AND t.unit_id=v_r.unit_id AND t.property_id=v_r.property_id) THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501';
    END IF;
    IF p_dispute_reason IS NULL OR trim(p_dispute_reason)='' THEN RAISE EXCEPTION 'Dispute reason is required'; END IF;
    UPDATE public.water_meter_readings SET disputed=true, dispute_reason=trim(p_dispute_reason), updated_at=now() WHERE id=v_r.id;
    RETURN jsonb_build_object('id',v_r.id,'action','dispute');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='manager') OR v_manager<>v_uid THEN
    RAISE EXCEPTION 'Only the property manager can transition this reading' USING ERRCODE='42501';
  END IF;

  IF p_action='verify' THEN
    UPDATE public.water_meter_readings SET manager_verified=true, updated_at=now() WHERE id=v_r.id;
  ELSIF p_action='invoiced' THEN
    IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'Invoice is required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE id=p_invoice_id AND property_id=v_r.property_id AND tenant_id IN (SELECT id FROM public.tenants WHERE unit_id=v_r.unit_id AND manager_id=v_manager)) THEN
      RAISE EXCEPTION 'Invoice does not belong to this reading';
    END IF;
    UPDATE public.water_meter_readings SET invoice_id=p_invoice_id,status='invoiced',updated_at=now() WHERE id=v_r.id;
  ELSIF p_action='paid' THEN
    UPDATE public.water_meter_readings SET status='paid',updated_at=now() WHERE id=v_r.id AND invoice_id IS NOT NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reading must be invoiced before paid'; END IF;
  ELSE
    RAISE EXCEPTION 'Invalid water reading action';
  END IF;
  RETURN jsonb_build_object('id',v_r.id,'action',p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.create_water_meter_reading_atomic(uuid,uuid,numeric,numeric,numeric,date,text,text,text,boolean,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_water_meter_reading_atomic(uuid,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_water_meter_reading_atomic(uuid,uuid,numeric,numeric,numeric,date,text,text,text,boolean,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_water_meter_reading_atomic(uuid,text,uuid,text) TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.water_meter_readings FROM authenticated;
