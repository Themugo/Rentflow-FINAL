-- CALQULUS Phase 54: unit media mutation convergence.
-- All unit photo metadata mutations are atomic and manager-scoped.

CREATE OR REPLACE FUNCTION public.save_unit_photo_atomic(
  p_unit_id uuid,
  p_photo_url text,
  p_photo_type text DEFAULT 'general',
  p_caption text DEFAULT NULL,
  p_display_order integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  u public.units%ROWTYPE;
  v_property_id uuid;
  v_id uuid;
  v_order integer;
  v_cover boolean;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO u FROM public.units WHERE id=p_unit_id;
  IF u.id IS NULL THEN RAISE EXCEPTION 'Unit not found' USING ERRCODE='P0002'; END IF;
  SELECT property_id INTO v_property_id FROM public.units WHERE id=p_unit_id;
  IF v_property_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=v_property_id AND manager_id=auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_photo_url),'') IS NULL THEN RAISE EXCEPTION 'Photo URL is required' USING ERRCODE='22023'; END IF;
  IF p_photo_type NOT IN ('general','exterior','interior','kitchen','bathroom','bedroom','common_area') THEN
    RAISE EXCEPTION 'Invalid photo type' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE(p_display_order, COALESCE(max(display_order),-1)+1) INTO v_order FROM public.unit_photos WHERE unit_id=p_unit_id;
  v_cover := NOT EXISTS (SELECT 1 FROM public.unit_photos WHERE unit_id=p_unit_id);
  INSERT INTO public.unit_photos(unit_id,property_id,manager_id,photo_url,caption,photo_type,display_order,is_cover)
  VALUES(p_unit_id,v_property_id,auth.uid(),trim(p_photo_url),nullif(trim(p_caption),''),p_photo_type,v_order,v_cover)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'photo_id',v_id,'unit_id',p_unit_id,'is_cover',v_cover);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_unit_photo_atomic(p_photo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.unit_photos%ROWTYPE; v_next uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.unit_photos WHERE id=p_photo_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Photo not found' USING ERRCODE='P0002'; END IF;
  IF r.manager_id IS DISTINCT FROM auth.uid() OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=r.property_id AND manager_id=auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  DELETE FROM public.unit_photos WHERE id=r.id;
  IF r.is_cover THEN
    SELECT id INTO v_next FROM public.unit_photos WHERE unit_id=r.unit_id ORDER BY display_order,created_at LIMIT 1;
    IF v_next IS NOT NULL THEN UPDATE public.unit_photos SET is_cover=true WHERE id=v_next; END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'photo_id',r.id,'promoted_photo_id',v_next);
END; $$;

CREATE OR REPLACE FUNCTION public.set_unit_cover_photo_atomic(p_photo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.unit_photos%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.unit_photos WHERE id=p_photo_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Photo not found' USING ERRCODE='P0002'; END IF;
  IF r.manager_id IS DISTINCT FROM auth.uid() OR NOT EXISTS (SELECT 1 FROM public.properties WHERE id=r.property_id AND manager_id=auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  UPDATE public.unit_photos SET is_cover=false WHERE unit_id=r.unit_id AND is_cover=true;
  UPDATE public.unit_photos SET is_cover=true WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'photo_id',r.id,'unit_id',r.unit_id);
END; $$;

REVOKE ALL ON FUNCTION public.save_unit_photo_atomic(uuid,text,text,text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_unit_photo_atomic(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_unit_cover_photo_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_unit_photo_atomic(uuid,text,text,text,integer) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_unit_photo_atomic(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_unit_cover_photo_atomic(uuid) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.unit_photos FROM authenticated;
