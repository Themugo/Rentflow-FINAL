-- Phase 37: unit charge configuration atomic lifecycle.
CREATE OR REPLACE FUNCTION public.save_unit_charge_config_atomic(
  p_unit_id uuid, p_charge_type text, p_charge_label text, p_amount numeric,
  p_is_metered boolean DEFAULT false, p_billing_cycle text DEFAULT 'monthly',
  p_auto_generate boolean DEFAULT true, p_notes text DEFAULT NULL, p_charge_id uuid DEFAULT NULL
) RETURNS public.unit_charge_configs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_unit public.units%ROWTYPE; v_charge public.unit_charge_configs%ROWTYPE; v_manager uuid := auth.uid();
BEGIN
  SELECT * INTO v_unit FROM public.units WHERE id=p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found'; END IF;
  IF v_unit.property_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=v_unit.property_id AND p.manager_id=v_manager) THEN
    RAISE EXCEPTION 'Unit is outside your management portfolio';
  END IF;
  IF trim(coalesce(p_charge_type,''))='' OR trim(coalesce(p_charge_label,''))='' THEN RAISE EXCEPTION 'Charge type and label are required'; END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'Charge amount must be non-negative'; END IF;
  IF p_billing_cycle NOT IN ('monthly','quarterly','annual','once_off','on_demand') THEN RAISE EXCEPTION 'Invalid billing cycle'; END IF;
  IF p_charge_id IS NOT NULL THEN
    SELECT * INTO v_charge FROM public.unit_charge_configs WHERE id=p_charge_id FOR UPDATE;
    IF NOT FOUND OR v_charge.unit_id <> p_unit_id THEN RAISE EXCEPTION 'Charge configuration not found'; END IF;
    UPDATE public.unit_charge_configs SET charge_type=trim(p_charge_type), charge_label=trim(p_charge_label), amount=round(p_amount,2), is_metered=p_is_metered, billing_cycle=p_billing_cycle, auto_generate=p_auto_generate, notes=p_notes, updated_at=now() WHERE id=p_charge_id RETURNING * INTO v_charge;
  ELSE
    INSERT INTO public.unit_charge_configs(unit_id,property_id,manager_id,charge_type,charge_label,amount,is_active,is_metered,billing_cycle,auto_generate,notes)
    VALUES(p_unit_id,v_unit.property_id,v_manager,trim(p_charge_type),trim(p_charge_label),round(p_amount,2),true,p_is_metered,p_billing_cycle,p_auto_generate,p_notes)
    RETURNING * INTO v_charge;
  END IF;
  RETURN v_charge;
END $$;

CREATE OR REPLACE FUNCTION public.transition_unit_charge_config_atomic(p_charge_id uuid, p_is_active boolean)
RETURNS public.unit_charge_configs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_charge public.unit_charge_configs%ROWTYPE;
BEGIN
  SELECT * INTO v_charge FROM public.unit_charge_configs c JOIN public.properties p ON p.id=c.property_id WHERE c.id=p_charge_id AND p.manager_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Charge configuration not found or unauthorized'; END IF;
  UPDATE public.unit_charge_configs SET is_active=p_is_active, updated_at=now() WHERE id=p_charge_id RETURNING * INTO v_charge;
  RETURN v_charge;
END $$;

CREATE OR REPLACE FUNCTION public.delete_unit_charge_config_atomic(p_charge_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.unit_charge_configs c JOIN public.properties p ON p.id=c.property_id WHERE c.id=p_charge_id AND p.manager_id=auth.uid()) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Charge configuration not found or unauthorized'; END IF;
  DELETE FROM public.unit_charge_configs WHERE id=p_charge_id;
  RETURN true;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.unit_charge_configs FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_unit_charge_config_atomic(uuid,text,text,numeric,boolean,text,boolean,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_unit_charge_config_atomic(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_unit_charge_config_atomic(uuid) TO authenticated, service_role;
