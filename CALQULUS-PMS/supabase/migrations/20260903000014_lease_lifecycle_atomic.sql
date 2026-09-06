-- Phase 35: lease status lifecycle atomicity.
-- Centralizes status transitions so lease, tenant occupancy and unit state cannot diverge.

CREATE OR REPLACE FUNCTION public.transition_lease_atomic(
  p_lease_id uuid,
  p_target_status text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lease public.leases%ROWTYPE;
  v_manager uuid;
  v_other_active uuid;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN
    RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE='28000';
  END IF;
  IF p_target_status NOT IN ('draft','pending','active','expired','terminated') THEN
    RAISE EXCEPTION 'Invalid lease status' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lease not found'; END IF;

  IF auth.role() = 'service_role' THEN
    v_manager := v_lease.manager_id;
  ELSE
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='manager') THEN
      v_manager := v_uid;
    ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='submanager') THEN
      SELECT manager_id INTO v_manager FROM public.manager_submanagers WHERE submanager_user_id=v_uid LIMIT 1;
    END IF;
    IF v_manager IS NULL OR v_lease.manager_id IS DISTINCT FROM v_manager THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501';
    END IF;
  END IF;

  IF v_lease.status = p_target_status THEN
    RETURN jsonb_build_object('id',v_lease.id,'status',v_lease.status,'idempotent',true);
  END IF;

  IF p_target_status = 'active' AND v_lease.unit_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_lease.unit_id::text, 20260902));
    SELECT id INTO v_other_active
    FROM public.leases
    WHERE unit_id=v_lease.unit_id AND id<>v_lease.id AND status='active'
    LIMIT 1 FOR UPDATE;
    IF v_other_active IS NOT NULL THEN
      RAISE EXCEPTION 'Unit already has another active lease' USING ERRCODE='23505';
    END IF;
  END IF;

  UPDATE public.leases
  SET status=p_target_status, updated_at=now()
  WHERE id=v_lease.id;

  IF v_lease.unit_id IS NOT NULL THEN
    UPDATE public.units u
    SET status = CASE
      WHEN p_target_status='active' THEN 'occupied'
      WHEN p_target_status IN ('terminated','expired')
           AND NOT EXISTS (SELECT 1 FROM public.leases l WHERE l.unit_id=u.id AND l.id<>v_lease.id AND l.status='active')
        THEN 'available'
      ELSE u.status
    END,
    updated_at=now()
    WHERE u.id=v_lease.unit_id;
  END IF;

  RETURN jsonb_build_object('id',v_lease.id,'status',p_target_status,'idempotent',false);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_lease_atomic(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_lease_atomic(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.attach_lease_document_atomic(
  p_lease_id uuid, p_document_url text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000'; END IF;
  SELECT manager_id INTO v_manager FROM public.leases WHERE id=p_lease_id FOR UPDATE;
  IF v_manager IS NULL OR v_manager<>v_uid OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='manager') THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501';
  END IF;
  IF p_document_url IS NULL OR trim(p_document_url)='' THEN RAISE EXCEPTION 'Document path is required'; END IF;
  UPDATE public.leases SET document_url=trim(p_document_url), updated_at=now() WHERE id=p_lease_id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.attach_lease_document_atomic(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_lease_document_atomic(uuid,text) TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.leases FROM authenticated;
