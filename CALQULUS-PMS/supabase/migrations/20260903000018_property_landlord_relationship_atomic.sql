-- Phase 39-40: property/unit/tenant + landlord relationship atomic lifecycle hardening.

CREATE OR REPLACE FUNCTION public.create_property_atomic(
  p_name text, p_address text, p_house_number text DEFAULT NULL,
  p_house_label_prefix text DEFAULT NULL, p_units numeric DEFAULT 0,
  p_image_url text DEFAULT NULL, p_property_type text DEFAULT 'flat',
  p_number_of_floors numeric DEFAULT 1, p_rent_per_house numeric DEFAULT 0,
  p_payment_details text DEFAULT NULL, p_manager_id uuid DEFAULT NULL
) RETURNS public.properties
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid := auth.uid(); v_property public.properties%ROWTYPE; v_allowed boolean;
BEGIN
  IF v_manager IS NULL OR auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_manager AND role IN ('manager','agency')) THEN RAISE EXCEPTION 'Property creation not permitted' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_name),'') IS NULL OR nullif(trim(p_address),'') IS NULL THEN RAISE EXCEPTION 'Property name and address are required' USING ERRCODE='22023'; END IF;
  IF p_units < 0 OR p_number_of_floors < 1 OR p_rent_per_house < 0 THEN RAISE EXCEPTION 'Invalid property values' USING ERRCODE='22023'; END IF;
  SELECT public.check_tier_allows_property(v_manager, coalesce(nullif(trim(p_property_type),''),'flat')) INTO v_allowed;
  IF NOT coalesce(v_allowed,false) THEN RAISE EXCEPTION 'Property type is not available on your plan' USING ERRCODE='42501'; END IF;
  INSERT INTO public.properties(name,address,house_number,house_label_prefix,units,occupied,revenue,image_url,manager_id,property_type,number_of_floors,rent_per_house,payment_details,status)
  VALUES(trim(p_name),trim(p_address),nullif(trim(p_house_number),''),nullif(trim(p_house_label_prefix),''),p_units,0,0,nullif(trim(p_image_url),''),v_manager,coalesce(nullif(trim(p_property_type),''),'flat'),p_number_of_floors,p_rent_per_house,nullif(trim(p_payment_details),''),'active')
  RETURNING * INTO v_property;
  RETURN v_property;
END $$;

CREATE OR REPLACE FUNCTION public.update_property_atomic(p_property_id uuid, p_payload jsonb)
RETURNS public.properties LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_property public.properties%ROWTYPE; v_manager uuid := auth.uid(); v_type text; v_allowed boolean;
BEGIN
  SELECT * INTO v_property FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF NOT FOUND OR NOT (v_property.manager_id=v_manager OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=v_property.id AND pl.manager_id=v_manager)) THEN RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF nullif(trim(coalesce(p_payload->>'name','')),'') IS NULL OR nullif(trim(coalesce(p_payload->>'address','')),'') IS NULL THEN RAISE EXCEPTION 'Property name and address are required' USING ERRCODE='22023'; END IF;
  v_type := coalesce(nullif(trim(p_payload->>'property_type'),''),v_property.property_type,'flat');
  SELECT public.check_tier_allows_property(v_manager,v_type) INTO v_allowed;
  IF NOT coalesce(v_allowed,false) THEN RAISE EXCEPTION 'Property type is not available on your plan' USING ERRCODE='42501'; END IF;
  UPDATE public.properties SET
    name=trim(p_payload->>'name'), address=trim(p_payload->>'address'),
    house_number=nullif(trim(p_payload->>'house_number'),''), house_label_prefix=nullif(trim(p_payload->>'house_label_prefix'),''),
    units=GREATEST(0,coalesce((p_payload->>'units')::numeric,units)),
    image_url=nullif(trim(p_payload->>'image_url'),''), property_type=v_type,
    number_of_floors=GREATEST(1,coalesce((p_payload->>'number_of_floors')::numeric,number_of_floors,1)),
    rent_per_house=GREATEST(0,coalesce((p_payload->>'rent_per_house')::numeric,rent_per_house,0)),
    payment_details=nullif(trim(p_payload->>'payment_details'),''), updated_at=now()
  WHERE id=p_property_id RETURNING * INTO v_property;
  RETURN v_property;
END $$;

CREATE OR REPLACE FUNCTION public.transition_property_atomic(p_property_id uuid, p_status text)
RETURNS public.properties LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.properties%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF NOT FOUND OR NOT (v.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=v.id AND pl.manager_id=auth.uid())) THEN RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('active','inactive') THEN RAISE EXCEPTION 'Invalid property status' USING ERRCODE='22023'; END IF;
  UPDATE public.properties SET status=p_status, updated_at=now() WHERE id=p_property_id RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.save_unit_atomic(p_unit_id uuid DEFAULT NULL, p_property_id uuid DEFAULT NULL, p_unit_number text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS public.units LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.units%ROWTYPE; v_property uuid; v_manager uuid := auth.uid(); v_number text;
BEGIN
  IF v_manager IS NULL OR auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  v_property := coalesce(p_property_id, (p_payload->>'property_id')::uuid);
  IF v_property IS NULL THEN SELECT property_id INTO v_property FROM public.units WHERE id=p_unit_id; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=v_property AND (p.manager_id=v_manager OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p.id AND pl.manager_id=v_manager))) THEN RAISE EXCEPTION 'Property is outside your management portfolio' USING ERRCODE='42501'; END IF;
  v_number := nullif(trim(coalesce(p_unit_number,p_payload->>'unit_number','')),'');
  IF v_number IS NULL THEN RAISE EXCEPTION 'Unit number is required' USING ERRCODE='22023'; END IF;
  IF p_unit_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.units WHERE property_id=v_property AND lower(unit_number)=lower(v_number)) THEN RAISE EXCEPTION 'A unit with this number already exists' USING ERRCODE='23505'; END IF;
    v := jsonb_populate_record(NULL::public.units, p_payload - 'id' - 'property_id' - 'created_at' - 'updated_at');
    v.id := gen_random_uuid(); v.property_id := v_property; v.unit_number := v_number; v.status := coalesce(nullif(v.status,''),'vacant'); v.created_at := now(); v.updated_at := now();
    INSERT INTO public.units SELECT v.* RETURNING * INTO v;
  ELSE
    SELECT * INTO v FROM public.units WHERE id=p_unit_id FOR UPDATE;
    IF NOT FOUND OR v.property_id IS DISTINCT FROM v_property THEN RAISE EXCEPTION 'Unit not found or unauthorized' USING ERRCODE='42501'; END IF;
    IF EXISTS (SELECT 1 FROM public.units WHERE property_id=v_property AND lower(unit_number)=lower(v_number) AND id<>p_unit_id) THEN RAISE EXCEPTION 'A unit with this number already exists' USING ERRCODE='23505'; END IF;
    v := jsonb_populate_record(v, p_payload - 'id' - 'property_id' - 'created_at' - 'updated_at');
    v.unit_number := v_number; v.property_id := v_property; v.updated_at := now();
    UPDATE public.units SET
      unit_number=v.unit_number, label=v.label, unit_type=v.unit_type, bedrooms=v.bedrooms, bathrooms=v.bathrooms,
      square_feet=v.square_feet, description=v.description, monthly_rent=v.monthly_rent, house_deposit=v.house_deposit,
      water_deposit=v.water_deposit, floor_number=v.floor_number, furnished=v.furnished, facing=v.facing,
      parking_included=v.parking_included, parking_bays=v.parking_bays, notes=v.notes, available_from=v.available_from,
      market_rent=v.market_rent, status=v.status, updated_at=v.updated_at
      WHERE id=p_unit_id RETURNING * INTO v;
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.transition_unit_atomic(p_unit_id uuid, p_status text)
RETURNS public.units LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.units%ROWTYPE;
BEGIN
  SELECT u.* INTO v FROM public.units u JOIN public.properties p ON p.id=u.property_id WHERE u.id=p_unit_id AND (p.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p.id AND pl.manager_id=auth.uid())) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('vacant','occupied','reserved','maintenance','inactive') THEN RAISE EXCEPTION 'Invalid unit status' USING ERRCODE='22023'; END IF;
  UPDATE public.units SET status=p_status, updated_at=now() WHERE id=p_unit_id RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.assign_tenant_unit_atomic(p_tenant_id uuid, p_property_id uuid, p_unit_id uuid DEFAULT NULL, p_unit_number text DEFAULT NULL)
RETURNS public.tenants LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tenants%ROWTYPE; u public.units%ROWTYPE; p public.properties%ROWTYPE; v_uid uuid := auth.uid(); v_unit_number text;
BEGIN
  SELECT * INTO p FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF NOT FOUND OR p.manager_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR t.manager_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Tenant not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF p_unit_id IS NOT NULL THEN
    SELECT * INTO u FROM public.units WHERE id=p_unit_id AND property_id=p_property_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found in property' USING ERRCODE='42501'; END IF;
  ELSE
    v_unit_number := nullif(trim(p_unit_number),'');
    IF v_unit_number IS NULL THEN
      UPDATE public.tenants SET property_id=p.id, property=p.name, unit=NULL, unit_id=NULL, updated_at=now() WHERE id=t.id RETURNING * INTO t;
      RETURN t;
    END IF;
    SELECT * INTO u FROM public.units WHERE property_id=p_property_id AND lower(unit_number)=lower(v_unit_number) FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.units(property_id,unit_number,status) VALUES(p_property_id,v_unit_number,'occupied') RETURNING * INTO u;
    END IF;
  END IF;
  IF u.status='inactive' THEN RAISE EXCEPTION 'Inactive unit cannot be assigned' USING ERRCODE='55000'; END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE unit_id=u.id AND id<>t.id AND status='active') THEN RAISE EXCEPTION 'Unit already has an active tenant' USING ERRCODE='23505'; END IF;
  UPDATE public.tenants SET property_id=p.id, property=p.name, unit=u.unit_number, unit_id=u.id, updated_at=now() WHERE id=t.id RETURNING * INTO t;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.unassign_tenant_atomic(p_tenant_id uuid)
RETURNS public.tenants LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.tenants%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.tenants WHERE id=p_tenant_id AND manager_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found or unauthorized' USING ERRCODE='42501'; END IF;
  UPDATE public.tenants SET property_id=NULL, property=NULL, unit=NULL, unit_id=NULL, updated_at=now() WHERE id=p_tenant_id RETURNING * INTO t;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.link_landlord_atomic(p_property_id uuid, p_landlord_user_id uuid, p_revenue_share_pct numeric DEFAULT 100)
RETURNS public.property_landlords LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_landlords%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND manager_id=auth.uid()) THEN RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_landlord_user_id AND role='landlord') THEN RAISE EXCEPTION 'User is not a landlord' USING ERRCODE='22023'; END IF;
  IF p_revenue_share_pct < 0 OR p_revenue_share_pct > 100 THEN RAISE EXCEPTION 'Revenue share must be 0-100' USING ERRCODE='22023'; END IF;
  INSERT INTO public.property_landlords(property_id,landlord_user_id,manager_id,revenue_share_pct) VALUES(p_property_id,p_landlord_user_id,auth.uid(),p_revenue_share_pct)
  ON CONFLICT(property_id) DO UPDATE SET landlord_user_id=EXCLUDED.landlord_user_id, manager_id=EXCLUDED.manager_id, revenue_share_pct=EXCLUDED.revenue_share_pct, updated_at=now()
  RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.create_landlord_invitation_atomic(p_property_id uuid, p_email text)
RETURNS public.landlord_invitations LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.landlord_invitations%ROWTYPE; e text:=lower(trim(p_email));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND manager_id=auth.uid()) THEN RAISE EXCEPTION 'Property not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF e IS NULL OR e='' THEN RAISE EXCEPTION 'Email is required' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.landlord_invitations WHERE property_id=p_property_id AND lower(email)=e AND status='pending' AND expires_at>now()) THEN RAISE EXCEPTION 'A pending invitation already exists for this email' USING ERRCODE='23505'; END IF;
  INSERT INTO public.landlord_invitations(property_id,manager_id,email,invited_by_webhost,status,expires_at)
  VALUES(p_property_id,auth.uid(),e,false,'pending',now()+interval '7 days') RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.unlink_landlord_atomic(p_link_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_landlords%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.property_landlords WHERE id=p_link_id FOR UPDATE;
  IF NOT FOUND OR v.manager_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Landlord link not found or unauthorized' USING ERRCODE='42501'; END IF;
  DELETE FROM public.property_landlords WHERE id=p_link_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.update_landlord_authority_atomic(
  p_link_id uuid, p_operating_model text, p_revenue_share_pct numeric,
  p_management_fee_pct numeric DEFAULT NULL, p_allows_delegated_manager boolean DEFAULT true,
  p_delegated_manager_id uuid DEFAULT NULL
) RETURNS public.property_landlords LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.property_landlords%ROWTYPE; v_operator uuid;
BEGIN
  SELECT * INTO v FROM public.property_landlords WHERE id=p_link_id FOR UPDATE;
  IF NOT FOUND OR v.manager_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Landlord link not found or unauthorized' USING ERRCODE='42501'; END IF;
  IF p_operating_model NOT IN ('landlord_self_managed','manager_operates_landlord_collects','agency_collects_full_management','agency_collects_pays_landlord','agency_manages_fee_from_landlord') THEN RAISE EXCEPTION 'Invalid operating model' USING ERRCODE='22023'; END IF;
  IF p_revenue_share_pct < 0 OR p_revenue_share_pct > 100 OR (p_management_fee_pct IS NOT NULL AND (p_management_fee_pct < 0 OR p_management_fee_pct > 100)) THEN RAISE EXCEPTION 'Invalid financial configuration' USING ERRCODE='22023'; END IF;
  IF p_delegated_manager_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_delegated_manager_id AND role IN ('manager','submanager','agency')) THEN RAISE EXCEPTION 'Invalid delegated manager' USING ERRCODE='22023'; END IF;
  UPDATE public.property_landlords SET operating_model=p_operating_model, payment_destination=public.payment_destination_for_model(p_operating_model), revenue_share_pct=p_revenue_share_pct, management_fee_pct=p_management_fee_pct, allows_delegated_manager=p_allows_delegated_manager, delegated_manager_id=CASE WHEN p_allows_delegated_manager THEN p_delegated_manager_id ELSE NULL END, updated_at=now() WHERE id=p_link_id RETURNING * INTO v;
  IF p_operating_model='landlord_self_managed' THEN v_operator:=CASE WHEN p_allows_delegated_manager AND p_delegated_manager_id IS NOT NULL THEN p_delegated_manager_id ELSE v.landlord_user_id END;
  ELSIF p_allows_delegated_manager AND p_delegated_manager_id IS NOT NULL THEN v_operator:=p_delegated_manager_id;
  ELSE v_operator:=auth.uid(); END IF;
  UPDATE public.properties SET manager_id=v_operator, updated_at=now() WHERE id=v.property_id AND (manager_id=auth.uid() OR manager_id=v.delegated_manager_id OR manager_id=v.landlord_user_id);
  RETURN v;
END $$;

-- Authenticated clients may read these rows, but lifecycle mutations are RPC-only.
DROP POLICY IF EXISTS manager_manages_own_properties ON public.properties;
DROP POLICY IF EXISTS "manager_manages_own_properties" ON public.properties;
CREATE POLICY manager_reads_own_properties ON public.properties FOR SELECT USING (manager_id=auth.uid());

DROP POLICY IF EXISTS manager_manages_own_units ON public.units;
DROP POLICY IF EXISTS "manager_manages_own_units" ON public.units;
CREATE POLICY manager_reads_own_units ON public.units FOR SELECT USING (property_id IN (SELECT id FROM public.properties WHERE manager_id=auth.uid()));

DROP POLICY IF EXISTS manager_manages_property_landlords ON public.property_landlords;
DROP POLICY IF EXISTS manager_manages_linked_landlords ON public.property_landlords;
CREATE POLICY manager_reads_linked_landlords ON public.property_landlords FOR SELECT USING (manager_id=auth.uid());

DROP POLICY IF EXISTS manager_manages_invitations ON public.landlord_invitations;
DROP POLICY IF EXISTS manager_manages_landlord_invitations ON public.landlord_invitations;
CREATE POLICY manager_reads_own_landlord_invitations ON public.landlord_invitations FOR SELECT USING (manager_id=auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.properties FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.units FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.property_landlords FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.landlord_invitations FROM authenticated;

GRANT EXECUTE ON FUNCTION public.create_property_atomic(text,text,text,text,numeric,text,text,numeric,numeric,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_property_atomic(uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_property_atomic(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_unit_atomic(uuid,uuid,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_unit_atomic(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_tenant_unit_atomic(uuid,uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unassign_tenant_atomic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_landlord_atomic(uuid,uuid,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_landlord_invitation_atomic(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlink_landlord_atomic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_landlord_authority_atomic(uuid,text,numeric,numeric,boolean,uuid) TO authenticated, service_role;
