-- CALQULUS Phase 53: provider review / rating integrity.
-- Reviews must originate from a real completed maintenance relationship.

CREATE UNIQUE INDEX IF NOT EXISTS provider_reviews_provider_reviewer_unique_idx
  ON public.provider_reviews(provider_id, reviewer_id)
  WHERE reviewer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_provider_review_atomic(
  p_provider_id uuid,
  p_rating integer,
  p_title text DEFAULT NULL,
  p_comment text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_role text;
  v_maintenance_id uuid;
  v_review_id uuid;
  v_existing uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Rating must be between 1 and 5' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.id=p_provider_id AND sp.status='active') THEN
    RAISE EXCEPTION 'Service provider not found' USING ERRCODE='P0002';
  END IF;

  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='tenant') THEN 'tenant'
    WHEN public.get_effective_manager_id() IS NOT NULL THEN 'manager'
    ELSE 'unknown'
  END INTO v_role;
  IF v_role='unknown' THEN RAISE EXCEPTION 'Only managers and tenants may review providers' USING ERRCODE='42501'; END IF;

  SELECT id INTO v_existing FROM public.provider_reviews WHERE provider_id=p_provider_id AND reviewer_id=auth.uid() LIMIT 1;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'You have already reviewed this provider' USING ERRCODE='23505'; END IF;

  IF v_role='manager' THEN
    SELECT mr.id INTO v_maintenance_id
    FROM public.maintenance_requests mr
    WHERE mr.assigned_provider_id=p_provider_id
      AND mr.manager_id=public.get_effective_manager_id()
      AND mr.status='completed'
    ORDER BY mr.provider_completed_at DESC NULLS LAST, mr.updated_at DESC
    LIMIT 1;
  ELSE
    SELECT mr.id INTO v_maintenance_id
    FROM public.maintenance_requests mr
    JOIN public.user_roles ur ON ur.user_id=auth.uid() AND ur.role='tenant'
    JOIN public.tenants t ON t.id=ur.tenant_id
    WHERE mr.assigned_provider_id=p_provider_id
      AND mr.status='completed'
      AND lower(mr.tenant_email)=lower(t.email)
      AND lower(t.email)=lower((SELECT email FROM auth.users WHERE id=auth.uid()))
    ORDER BY mr.provider_completed_at DESC NULLS LAST, mr.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_maintenance_id IS NULL THEN RAISE EXCEPTION 'A completed maintenance job with this provider is required' USING ERRCODE='42501'; END IF;

  INSERT INTO public.provider_reviews(provider_id, reviewer_id, reviewer_role, maintenance_id, rating, title, comment)
  VALUES(p_provider_id, auth.uid(), v_role, v_maintenance_id, p_rating,
         nullif(trim(p_title),''), nullif(trim(p_comment),''))
  RETURNING id INTO v_review_id;

  RETURN jsonb_build_object('success',true,'review_id',v_review_id,'maintenance_id',v_maintenance_id,'rating',p_rating);
END; $$;

REVOKE ALL ON FUNCTION public.create_provider_review_atomic(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_provider_review_atomic(uuid,integer,text,text) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.provider_reviews FROM authenticated;
