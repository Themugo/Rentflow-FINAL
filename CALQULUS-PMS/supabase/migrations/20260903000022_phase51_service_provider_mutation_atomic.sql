-- CALQULUS Phase 51: service-provider profile and rate-card mutation convergence.
-- Provider-owned writes must cross an atomic SECURITY DEFINER boundary.

CREATE OR REPLACE FUNCTION public.save_service_provider_profile_atomic(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_id uuid;
  v_user uuid := auth.uid();
  v_existing public.service_providers%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' OR v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Profile payload must be an object' USING ERRCODE='22023';
  END IF;
  IF nullif(trim(p_payload->>'business_name'),'') IS NULL THEN
    RAISE EXCEPTION 'Business name is required' USING ERRCODE='22023';
  END IF;
  IF COALESCE((p_payload->>'service_radius_km')::int, 20) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid service radius' USING ERRCODE='22023';
  END IF;
  IF COALESCE((p_payload->>'response_time_hrs')::int, 24) NOT BETWEEN 1 AND 720 THEN
    RAISE EXCEPTION 'Invalid response time' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.service_providers
  WHERE user_id=v_user
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.service_providers (
      user_id,business_name,contact_name,phone,whatsapp,email,bio,county,town,
      service_radius_km,response_time_hrs,is_available,added_by,added_by_role,status
    ) VALUES (
      v_user,trim(p_payload->>'business_name'),nullif(trim(p_payload->>'contact_name'),''),
      nullif(trim(p_payload->>'phone'),''),nullif(trim(p_payload->>'whatsapp'),''),
      nullif(trim(p_payload->>'email'),''),nullif(trim(p_payload->>'bio'),''),
      nullif(trim(p_payload->>'county'),''),nullif(trim(p_payload->>'town'),''),
      COALESCE((p_payload->>'service_radius_km')::int,20),
      COALESCE((p_payload->>'response_time_hrs')::int,24),
      COALESCE((p_payload->>'is_available')::boolean,true),v_user,'self','active'
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.service_providers SET
      business_name=trim(p_payload->>'business_name'),
      contact_name=nullif(trim(p_payload->>'contact_name'),''),
      phone=nullif(trim(p_payload->>'phone'),''),
      whatsapp=nullif(trim(p_payload->>'whatsapp'),''),
      email=nullif(trim(p_payload->>'email'),''),
      bio=nullif(trim(p_payload->>'bio'),''),
      county=nullif(trim(p_payload->>'county'),''),
      town=nullif(trim(p_payload->>'town'),''),
      service_radius_km=COALESCE((p_payload->>'service_radius_km')::int,20),
      response_time_hrs=COALESCE((p_payload->>'response_time_hrs')::int,24),
      is_available=COALESCE((p_payload->>'is_available')::boolean,true),
      updated_at=now()
    WHERE id=v_existing.id
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('success',true,'provider_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.save_provider_service_atomic(p_provider_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_rate_min numeric; v_rate_max numeric; v_rate_type text;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_providers WHERE id=p_provider_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Provider ownership required' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_payload->>'category_key'),'') IS NULL THEN RAISE EXCEPTION 'Service category is required' USING ERRCODE='22023'; END IF;
  v_rate_type:=COALESCE(nullif(trim(p_payload->>'rate_type'),''),'per_job');
  IF v_rate_type NOT IN ('per_job','per_hour','per_day','fixed','quote_only') THEN RAISE EXCEPTION 'Invalid rate type' USING ERRCODE='22023'; END IF;
  v_rate_min:=NULLIF(p_payload->>'rate_min','')::numeric;
  v_rate_max:=NULLIF(p_payload->>'rate_max','')::numeric;
  IF v_rate_min IS NOT NULL AND v_rate_min < 0 THEN RAISE EXCEPTION 'Rate cannot be negative' USING ERRCODE='22023'; END IF;
  IF v_rate_max IS NOT NULL AND v_rate_max < 0 THEN RAISE EXCEPTION 'Rate cannot be negative' USING ERRCODE='22023'; END IF;
  IF v_rate_min IS NOT NULL AND v_rate_max IS NOT NULL AND v_rate_max < v_rate_min THEN RAISE EXCEPTION 'Maximum rate cannot be below minimum rate' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_categories WHERE key=trim(p_payload->>'category_key') AND is_active=true) THEN
    RAISE EXCEPTION 'Invalid or inactive service category' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.provider_services(provider_id,category_key,rate_type,rate_min,rate_max,rate_notes,is_active)
  VALUES(p_provider_id,trim(p_payload->>'category_key'),v_rate_type,v_rate_min,v_rate_max,nullif(trim(p_payload->>'rate_notes'),''),COALESCE((p_payload->>'is_active')::boolean,true))
  ON CONFLICT (provider_id,category_key) DO UPDATE SET
    rate_type=EXCLUDED.rate_type,rate_min=EXCLUDED.rate_min,rate_max=EXCLUDED.rate_max,
    rate_notes=EXCLUDED.rate_notes,is_active=EXCLUDED.is_active
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'provider_service_id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_provider_service_atomic(p_provider_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  DELETE FROM public.provider_services ps
  WHERE ps.id=p_provider_service_id
    AND EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.id=ps.provider_id AND sp.user_id=auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider service not found or forbidden' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('success',true,'provider_service_id',p_provider_service_id);
END; $$;

REVOKE ALL ON FUNCTION public.save_service_provider_profile_atomic(jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_provider_service_atomic(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_provider_service_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_service_provider_profile_atomic(jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_provider_service_atomic(uuid,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_provider_service_atomic(uuid) TO authenticated,service_role;

REVOKE INSERT,UPDATE,DELETE ON public.service_providers FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.provider_services FROM authenticated;
