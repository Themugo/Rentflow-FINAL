-- CALQULUS Phase 37-38: core property + unit lifecycle integrity.
-- Authenticated portfolio mutations are centralized in SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.save_property_atomic(
  p_property_id uuid DEFAULT NULL,
  p_name text DEFAULT '',
  p_address text DEFAULT '',
  p_house_number text DEFAULT NULL,
  p_house_label_prefix text DEFAULT NULL,
  p_units numeric DEFAULT 0,
  p_image_url text DEFAULT NULL,
  p_property_type text DEFAULT 'flat',
  p_number_of_floors numeric DEFAULT 1,
  p_rent_per_house numeric DEFAULT 0,
  p_payment_details text DEFAULT NULL,
  p_category_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_manager uuid := public.get_effective_manager_id();
  v_property public.properties%ROWTYPE;
  v_id uuid;
  v_category text := COALESCE(NULLIF(trim(p_category_key), ''), CASE p_property_type
    WHEN 'flat' THEN 'residential_flat'
    WHEN 'apartment' THEN 'residential_flat'
    WHEN 'bungalow' THEN 'residential_bungalow'
    WHEN 'villa' THEN 'residential_villa'
    WHEN 'townhouse' THEN 'residential_townhouse'
    WHEN 'commercial' THEN 'commercial_office'
    WHEN 'mixed_use' THEN 'mixed_residential_commercial'
    ELSE 'residential_flat' END);
BEGIN
  IF auth.role() <> 'authenticated' OR v_manager IS NULL THEN
    RAISE EXCEPTION 'Manager authentication required' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_name), '') IS NULL OR nullif(trim(p_address), '') IS NULL THEN
    RAISE EXCEPTION 'Property name and address are required' USING ERRCODE='22023';
  END IF;
  IF p_units < 0 OR p_number_of_floors < 0 OR p_rent_per_house < 0 THEN
    RAISE EXCEPTION 'Property numeric values cannot be negative' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.property_categories WHERE key=v_category AND is_active=true) THEN
    RAISE EXCEPTION 'Invalid property category' USING ERRCODE='22023';
  END IF;
  IF public.check_tier_allows_property(v_manager, v_category) IS NOT TRUE THEN
    RAISE EXCEPTION 'Property category is not available on the current subscription tier' USING ERRCODE='42501';
  END IF;

  IF p_property_id IS NULL THEN
    INSERT INTO public.properties (
      name,address,house_number,house_label_prefix,units,occupied,revenue,image_url,
      manager_id,property_type,number_of_floors,rent_per_house,payment_details,category_key,status
    ) VALUES (
      trim(p_name),trim(p_address),nullif(trim(p_house_number),''),nullif(trim(p_house_label_prefix),''),
      p_units,0,0,nullif(trim(p_image_url),''),v_manager,COALESCE(NULLIF(trim(p_property_type),''),'flat'),
      COALESCE(p_number_of_floors,1),COALESCE(p_rent_per_house,0),nullif(trim(p_payment_details),''),v_category,'active'
    ) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_property FROM public.properties WHERE id=p_property_id FOR UPDATE;
    IF v_property.id IS NULL OR v_property.manager_id IS DISTINCT FROM v_manager THEN
      RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501';
    END IF;
    UPDATE public.properties SET
      name=trim(p_name), address=trim(p_address), house_number=nullif(trim(p_house_number),''),
      house_label_prefix=nullif(trim(p_house_label_prefix),''), units=p_units,
      image_url=nullif(trim(p_image_url),''), property_type=COALESCE(NULLIF(trim(p_property_type),''),'flat'),
      number_of_floors=COALESCE(p_number_of_floors,1), rent_per_house=COALESCE(p_rent_per_house,0),
      payment_details=nullif(trim(p_payment_details),''), category_key=v_category, updated_at=now()
    WHERE id=p_property_id;
    v_id := p_property_id;
  END IF;
  RETURN jsonb_build_object('success',true,'property_id',v_id,'category_key',v_category);
END; $$;

CREATE OR REPLACE FUNCTION public.deactivate_property_atomic(p_property_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid := public.get_effective_manager_id(); v_property public.properties%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR v_manager IS NULL THEN RAISE EXCEPTION 'Manager authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_property FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF v_property.id IS NULL OR v_property.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;
  IF v_property.status='inactive' THEN RETURN jsonb_build_object('success',true,'property_id',p_property_id,'status','inactive'); END IF;
  UPDATE public.properties SET status='inactive',updated_at=now() WHERE id=p_property_id;
  RETURN jsonb_build_object('success',true,'property_id',p_property_id,'status','inactive');
END; $$;

CREATE OR REPLACE FUNCTION public.save_unit_atomic(
  p_unit_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_unit_number text DEFAULT '',
  p_label text DEFAULT NULL,
  p_unit_type text DEFAULT 'standard',
  p_bedrooms numeric DEFAULT NULL,
  p_bathrooms numeric DEFAULT NULL,
  p_square_feet numeric DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_monthly_rent numeric DEFAULT NULL,
  p_house_deposit numeric DEFAULT NULL,
  p_water_deposit numeric DEFAULT NULL,
  p_floor_number integer DEFAULT NULL,
  p_furnished text DEFAULT 'unfurnished',
  p_status text DEFAULT 'vacant'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_manager uuid := public.get_effective_manager_id();
  v_unit public.units%ROWTYPE;
  v_property public.properties%ROWTYPE;
  v_id uuid;
  v_charge_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' OR v_manager IS NULL THEN RAISE EXCEPTION 'Manager authentication required' USING ERRCODE='42501'; END IF;
  IF p_property_id IS NULL OR nullif(trim(p_unit_number),'') IS NULL THEN RAISE EXCEPTION 'Property and unit number are required' USING ERRCODE='22023'; END IF;
  IF p_monthly_rent IS NOT NULL AND p_monthly_rent < 0 THEN RAISE EXCEPTION 'Monthly rent cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_house_deposit IS NOT NULL AND p_house_deposit < 0 THEN RAISE EXCEPTION 'House deposit cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_water_deposit IS NOT NULL AND p_water_deposit < 0 THEN RAISE EXCEPTION 'Water deposit cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_status NOT IN ('vacant','occupied','inactive','reserved','maintenance') THEN RAISE EXCEPTION 'Invalid unit status' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_property FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF v_property.id IS NULL OR v_property.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;

  IF p_unit_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.units WHERE property_id=p_property_id AND unit_number=trim(p_unit_number)) THEN
      RAISE EXCEPTION 'A unit with this number already exists' USING ERRCODE='23505';
    END IF;
    INSERT INTO public.units (
      property_id,unit_number,label,unit_type,bedrooms,bathrooms,square_feet,description,monthly_rent,
      house_deposit,water_deposit,floor_number,furnished,status
    ) VALUES (
      p_property_id,trim(p_unit_number),COALESCE(NULLIF(trim(p_label),''),trim(p_unit_number)),
      COALESCE(NULLIF(trim(p_unit_type),''),'standard'),p_bedrooms,p_bathrooms,p_square_feet,nullif(trim(p_description),''),
      p_monthly_rent,p_house_deposit,p_water_deposit,p_floor_number,COALESCE(NULLIF(trim(p_furnished),''),'unfurnished'),p_status
    ) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_unit FROM public.units WHERE id=p_unit_id FOR UPDATE;
    IF v_unit.id IS NULL OR v_unit.property_id IS DISTINCT FROM p_property_id THEN RAISE EXCEPTION 'Unit outside property scope' USING ERRCODE='42501'; END IF;
    IF EXISTS (SELECT 1 FROM public.units WHERE property_id=p_property_id AND unit_number=trim(p_unit_number) AND id<>p_unit_id) THEN RAISE EXCEPTION 'A unit with this number already exists' USING ERRCODE='23505'; END IF;
    UPDATE public.units SET
      unit_number=trim(p_unit_number),label=COALESCE(NULLIF(trim(p_label),''),trim(p_unit_number)),
      unit_type=COALESCE(NULLIF(trim(p_unit_type),''),'standard'),bedrooms=p_bedrooms,bathrooms=p_bathrooms,
      square_feet=p_square_feet,description=nullif(trim(p_description),''),monthly_rent=p_monthly_rent,
      house_deposit=p_house_deposit,water_deposit=p_water_deposit,floor_number=p_floor_number,
      furnished=COALESCE(NULLIF(trim(p_furnished),''),'unfurnished'),status=p_status,updated_at=now()
    WHERE id=p_unit_id;
    v_id := p_unit_id;
  END IF;

  IF p_monthly_rent IS NOT NULL AND p_monthly_rent > 0 THEN
    SELECT id INTO v_charge_id FROM public.unit_charge_configs
      WHERE unit_id=v_id AND charge_type='rent' FOR UPDATE;
    IF v_charge_id IS NULL THEN
      INSERT INTO public.unit_charge_configs(unit_id,property_id,manager_id,charge_type,charge_label,amount,is_active,is_metered,billing_cycle,auto_generate)
      VALUES(v_id,p_property_id,v_manager,'rent','Monthly Rent',p_monthly_rent,true,false,'monthly',true);
    ELSE
      UPDATE public.unit_charge_configs SET amount=p_monthly_rent,is_active=true,auto_generate=true,updated_at=now() WHERE id=v_charge_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'unit_id',v_id,'property_id',p_property_id);
END; $$;

CREATE OR REPLACE FUNCTION public.deactivate_unit_atomic(p_unit_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid := public.get_effective_manager_id(); v_unit public.units%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR v_manager IS NULL THEN RAISE EXCEPTION 'Manager authentication required' USING ERRCODE='42501'; END IF;
  SELECT u.* INTO v_unit FROM public.units u JOIN public.properties p ON p.id=u.property_id WHERE u.id=p_unit_id AND p.manager_id=v_manager FOR UPDATE;
  IF v_unit.id IS NULL THEN RAISE EXCEPTION 'Unit outside manager scope' USING ERRCODE='42501'; END IF;
  UPDATE public.units SET status='inactive',updated_at=now() WHERE id=p_unit_id;
  RETURN jsonb_build_object('success',true,'unit_id',p_unit_id,'status','inactive');
END; $$;

REVOKE ALL ON FUNCTION public.save_property_atomic(uuid,text,text,text,text,numeric,text,text,numeric,numeric,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.deactivate_property_atomic(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_unit_atomic(uuid,uuid,text,text,text,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.deactivate_unit_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_property_atomic(uuid,text,text,text,text,numeric,text,text,numeric,numeric,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_property_atomic(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_unit_atomic(uuid,uuid,text,text,text,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_unit_atomic(uuid) TO authenticated,service_role;

REVOKE INSERT,UPDATE,DELETE ON public.properties FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.units FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.unit_charge_configs FROM authenticated;

CREATE OR REPLACE FUNCTION public.assign_tenant_to_unit_atomic(p_tenant_id uuid,p_property_id uuid,p_unit_number text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_manager uuid := public.get_effective_manager_id();
  v_tenant public.tenants%ROWTYPE;
  v_unit public.units%ROWTYPE;
  v_property public.properties%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR v_manager IS NULL THEN RAISE EXCEPTION 'Manager authentication required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_unit_number),'') IS NULL THEN RAISE EXCEPTION 'Unit number is required' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_property FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF v_property.id IS NULL OR v_property.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
  IF v_tenant.id IS NULL OR v_tenant.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Tenant outside manager scope' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_unit FROM public.units WHERE property_id=p_property_id AND unit_number=trim(p_unit_number) FOR UPDATE;
  IF v_unit.id IS NULL THEN
    INSERT INTO public.units(property_id,unit_number,label,status)
    VALUES(p_property_id,trim(p_unit_number),trim(p_unit_number),'occupied') RETURNING * INTO v_unit;
  ELSE
    IF v_unit.status='inactive' THEN RAISE EXCEPTION 'Cannot assign a tenant to an inactive unit' USING ERRCODE='55000'; END IF;
    IF EXISTS (SELECT 1 FROM public.tenants WHERE unit_id=v_unit.id AND id<>p_tenant_id AND status='active') THEN
      RAISE EXCEPTION 'Unit already has an active tenant' USING ERRCODE='23514';
    END IF;
    UPDATE public.units SET status='occupied',updated_at=now() WHERE id=v_unit.id;
  END IF;
  UPDATE public.tenants SET property_id=p_property_id,property=v_property.name,unit=trim(p_unit_number),unit_id=v_unit.id,updated_at=now() WHERE id=p_tenant_id;
  RETURN jsonb_build_object('success',true,'tenant_id',p_tenant_id,'unit_id',v_unit.id,'property_id',p_property_id);
END; $$;

CREATE OR REPLACE FUNCTION public.unassign_tenant_from_unit_atomic(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_manager uuid := public.get_effective_manager_id();
  v_tenant public.tenants%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR v_manager IS NULL THEN RAISE EXCEPTION 'Manager authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
  IF v_tenant.id IS NULL OR v_tenant.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Tenant outside manager scope' USING ERRCODE='42501'; END IF;
  IF v_tenant.unit_id IS NOT NULL THEN
    UPDATE public.units SET status='vacant',updated_at=now()
    WHERE id=v_tenant.unit_id AND NOT EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.unit_id=v_tenant.unit_id AND t.id<>p_tenant_id AND t.status='active'
    );
  END IF;
  UPDATE public.tenants SET property_id=NULL,property=NULL,unit=NULL,unit_id=NULL,updated_at=now() WHERE id=p_tenant_id;
  RETURN jsonb_build_object('success',true,'tenant_id',p_tenant_id);
END; $$;

REVOKE ALL ON FUNCTION public.assign_tenant_to_unit_atomic(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.unassign_tenant_from_unit_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_tenant_to_unit_atomic(uuid,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.unassign_tenant_from_unit_atomic(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.save_unit_charge_config_atomic(
  p_charge_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_charge_type text DEFAULT 'custom',
  p_charge_label text DEFAULT '',
  p_amount numeric DEFAULT 0,
  p_is_metered boolean DEFAULT false,
  p_billing_cycle text DEFAULT 'monthly',
  p_auto_generate boolean DEFAULT true,
  p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_manager uuid := public.get_effective_manager_id();
  v_unit public.units%ROWTYPE;
  v_charge public.unit_charge_configs%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' OR v_manager IS NULL THEN RAISE EXCEPTION 'Manager authentication required' USING ERRCODE='42501'; END IF;
  IF p_unit_id IS NULL OR p_property_id IS NULL OR nullif(trim(p_charge_label),'') IS NULL THEN RAISE EXCEPTION 'Unit, property and charge label are required' USING ERRCODE='22023'; END IF;
  IF p_amount < 0 THEN RAISE EXCEPTION 'Charge amount cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_charge_type NOT IN ('rent','water','garbage','security','service_charge','caretaker','wifi','parking','electricity','custom') THEN RAISE EXCEPTION 'Invalid charge type' USING ERRCODE='22023'; END IF;
  IF p_billing_cycle NOT IN ('monthly','quarterly','annual','once_off','on_demand') THEN RAISE EXCEPTION 'Invalid billing cycle' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_unit FROM public.units WHERE id=p_unit_id AND property_id=p_property_id FOR UPDATE;
  IF v_unit.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND manager_id=v_manager) THEN RAISE EXCEPTION 'Unit outside manager scope' USING ERRCODE='42501'; END IF;

  IF p_charge_id IS NULL THEN
    INSERT INTO public.unit_charge_configs(unit_id,property_id,manager_id,charge_type,charge_label,amount,is_active,is_metered,billing_cycle,auto_generate,notes)
    VALUES(p_unit_id,p_property_id,v_manager,p_charge_type,trim(p_charge_label),p_amount,true,p_is_metered,p_billing_cycle,p_auto_generate,nullif(trim(p_notes),''))
    RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_charge FROM public.unit_charge_configs WHERE id=p_charge_id FOR UPDATE;
    IF v_charge.id IS NULL OR v_charge.unit_id IS DISTINCT FROM p_unit_id OR v_charge.property_id IS DISTINCT FROM p_property_id OR v_charge.manager_id IS DISTINCT FROM v_manager THEN
      RAISE EXCEPTION 'Charge configuration outside manager scope' USING ERRCODE='42501';
    END IF;
    UPDATE public.unit_charge_configs SET charge_type=p_charge_type,charge_label=trim(p_charge_label),amount=p_amount,is_metered=p_is_metered,billing_cycle=p_billing_cycle,auto_generate=p_auto_generate,notes=nullif(trim(p_notes),''),updated_at=now() WHERE id=p_charge_id;
    v_id := p_charge_id;
  END IF;
  RETURN jsonb_build_object('success',true,'charge_id',v_id,'unit_id',p_unit_id);
END; $$;

CREATE OR REPLACE FUNCTION public.set_unit_charge_active_atomic(p_charge_id uuid,p_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid := public.get_effective_manager_id(); v_charge public.unit_charge_configs%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR v_manager IS NULL THEN RAISE EXCEPTION 'Manager authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_charge FROM public.unit_charge_configs WHERE id=p_charge_id FOR UPDATE;
  IF v_charge.id IS NULL OR v_charge.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Charge configuration outside manager scope' USING ERRCODE='42501'; END IF;
  UPDATE public.unit_charge_configs SET is_active=p_active,updated_at=now() WHERE id=p_charge_id;
  RETURN jsonb_build_object('success',true,'charge_id',p_charge_id,'is_active',p_active);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_unit_charge_atomic(p_charge_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid := public.get_effective_manager_id(); v_charge public.unit_charge_configs%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR v_manager IS NULL THEN RAISE EXCEPTION 'Manager authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_charge FROM public.unit_charge_configs WHERE id=p_charge_id FOR UPDATE;
  IF v_charge.id IS NULL OR v_charge.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Charge configuration outside manager scope' USING ERRCODE='42501'; END IF;
  DELETE FROM public.unit_charge_configs WHERE id=p_charge_id;
  RETURN jsonb_build_object('success',true,'charge_id',p_charge_id);
END; $$;

REVOKE ALL ON FUNCTION public.save_unit_charge_config_atomic(uuid,uuid,uuid,text,text,numeric,boolean,text,boolean,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_unit_charge_active_atomic(uuid,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_unit_charge_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_unit_charge_config_atomic(uuid,uuid,uuid,text,text,numeric,boolean,text,boolean,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_unit_charge_active_atomic(uuid,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_unit_charge_atomic(uuid) TO authenticated,service_role;
