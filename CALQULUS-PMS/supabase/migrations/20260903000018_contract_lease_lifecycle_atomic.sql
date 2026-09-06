-- CALQULUS Phase 35: contract + lease mutation integrity.
-- Authenticated lifecycle writes are centralized in SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.create_contract_atomic(
  p_lease_id uuid,
  p_tenant_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_template_id uuid DEFAULT NULL,
  p_title text DEFAULT '',
  p_content text DEFAULT '',
  p_valid_from text DEFAULT NULL,
  p_valid_until text DEFAULT NULL,
  p_status text DEFAULT 'draft'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_lease public.leases%ROWTYPE;
  v_id uuid;
  v_manager uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  v_manager := public.get_effective_manager_id();
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_title),'') IS NULL OR nullif(trim(p_content),'') IS NULL THEN RAISE EXCEPTION 'Contract title and content are required' USING ERRCODE='22023'; END IF;
  IF p_status NOT IN ('draft','pending_approval','approved','sent','pending_signature','signed','expired','terminated') THEN RAISE EXCEPTION 'Invalid contract status' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_lease FROM public.leases WHERE id=p_lease_id AND manager_id=v_manager FOR UPDATE;
  IF v_lease.id IS NULL THEN RAISE EXCEPTION 'Lease is outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_tenant_id IS NOT NULL AND v_lease.tenant_id IS DISTINCT FROM p_tenant_id THEN RAISE EXCEPTION 'Tenant does not belong to lease' USING ERRCODE='42501'; END IF;
  IF p_property_id IS NOT NULL AND v_lease.property_id IS DISTINCT FROM p_property_id THEN RAISE EXCEPTION 'Property does not belong to lease' USING ERRCODE='42501'; END IF;
  IF p_unit_id IS NOT NULL AND v_lease.unit_id IS DISTINCT FROM p_unit_id THEN RAISE EXCEPTION 'Unit does not belong to lease' USING ERRCODE='42501'; END IF;

  INSERT INTO public.contracts(lease_id,tenant_id,property_id,unit_id,template_id,title,content,valid_from,valid_until,status,pending_approval)
  VALUES(p_lease_id,COALESCE(p_tenant_id,v_lease.tenant_id),COALESCE(p_property_id,v_lease.property_id),COALESCE(p_unit_id,v_lease.unit_id),p_template_id,trim(p_title),p_content,p_valid_from,p_valid_until,p_status,false)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'contract_id',v_id,'status',p_status);
END; $$;

CREATE OR REPLACE FUNCTION public.transition_contract_atomic(
  p_contract_id uuid,
  p_action text,
  p_target_status text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_signature text DEFAULT NULL,
  p_document_url text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  c public.contracts%ROWTYPE;
  v_manager uuid := public.get_effective_manager_id();
  v_role text;
  v_tenant_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.contracts WHERE id=p_contract_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Contract not found' USING ERRCODE='P0002'; END IF;
  SELECT role::text, tenant_id INTO v_role, v_tenant_id FROM public.user_roles WHERE user_id=auth.uid() ORDER BY CASE WHEN role='tenant' THEN 0 ELSE 1 END LIMIT 1;

  IF p_action IN ('status','approve','submit_approval','manager_sign','delete') THEN
    IF v_manager IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.leases l WHERE l.id=c.lease_id AND l.manager_id=v_manager
    ) THEN RAISE EXCEPTION 'Contract outside manager scope' USING ERRCODE='42501'; END IF;
    IF v_role NOT IN ('manager','submanager','agency') THEN RAISE EXCEPTION 'Manager authorization required' USING ERRCODE='42501'; END IF;

    IF c.status IN ('terminated','expired') AND p_action NOT IN ('status') THEN
      RAISE EXCEPTION 'Terminal contract cannot be modified' USING ERRCODE='55000';
    END IF;

    IF p_action='manager_sign' THEN
      IF nullif(trim(p_signature),'') IS NULL THEN RAISE EXCEPTION 'Manager signature is required' USING ERRCODE='22023'; END IF;
      UPDATE public.contracts SET manager_signature=p_signature, manager_signed_at=now(), status=CASE WHEN tenant_signature IS NOT NULL THEN 'signed' ELSE status END, updated_at=now() WHERE id=c.id;
    ELSIF p_action='submit_approval' THEN
      UPDATE public.contracts SET pending_approval=true, rejection_reason=null, updated_at=now() WHERE id=c.id;
    ELSIF p_action='approve' THEN
      UPDATE public.contracts SET pending_approval=false, approved_at=now(), approved_by=auth.uid()::text, status=COALESCE(NULLIF(p_target_status,''),'approved'), rejection_reason=null, updated_at=now() WHERE id=c.id;
    ELSIF p_action='delete' THEN
      UPDATE public.contracts SET status='terminated', deleted_at=now(), deleted_by=auth.uid()::text, deletion_reason=nullif(trim(p_reason),''), deletion_confirmed_at=now(), deletion_confirmed_by=auth.uid()::text, updated_at=now() WHERE id=c.id;
    ELSIF p_action='status' THEN
      IF p_target_status NOT IN ('draft','pending_approval','approved','sent','pending_signature','signed','expired','terminated') THEN RAISE EXCEPTION 'Invalid contract status' USING ERRCODE='22023'; END IF;
      IF c.status IN ('signed','terminated','expired') AND p_target_status NOT IN (c.status) THEN RAISE EXCEPTION 'Terminal contract cannot be reopened' USING ERRCODE='55000'; END IF;
      UPDATE public.contracts SET status=p_target_status, updated_at=now(), deletion_reason=CASE WHEN p_target_status='terminated' THEN nullif(trim(p_reason),'') ELSE deletion_reason END, deleted_at=CASE WHEN p_target_status='terminated' THEN COALESCE(deleted_at,now()) ELSE deleted_at END WHERE id=c.id;
    END IF;
  ELSIF p_action IN ('tenant_sign','tenant_upload') THEN
    IF v_role <> 'tenant' OR v_tenant_id IS DISTINCT FROM c.tenant_id THEN RAISE EXCEPTION 'Tenant authorization required' USING ERRCODE='42501'; END IF;
    IF c.status IN ('terminated','expired','signed') THEN RAISE EXCEPTION 'Contract cannot be modified in its current state' USING ERRCODE='55000'; END IF;
    IF p_action='tenant_sign' THEN
      IF nullif(trim(p_signature),'') IS NULL THEN RAISE EXCEPTION 'Tenant signature is required' USING ERRCODE='22023'; END IF;
      UPDATE public.contracts SET tenant_signature=p_signature, tenant_signed_at=now(), status=CASE WHEN manager_signature IS NOT NULL THEN 'signed' ELSE 'pending_signature' END, updated_at=now() WHERE id=c.id;
    ELSE
      IF nullif(trim(p_document_url),'') IS NULL THEN RAISE EXCEPTION 'Document URL is required' USING ERRCODE='22023'; END IF;
      UPDATE public.contracts SET uploaded_contract_url=p_document_url, updated_at=now() WHERE id=c.id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported contract action' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('success',true,'contract_id',c.id,'action',p_action);
END; $$;

CREATE OR REPLACE FUNCTION public.transition_lease_atomic(p_lease_id uuid, p_target_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leases%ROWTYPE; v_manager uuid := public.get_effective_manager_id();
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_target_status NOT IN ('active','expiring','expired','pending','terminated') THEN RAISE EXCEPTION 'Invalid lease status' USING ERRCODE='22023'; END IF;
  SELECT * INTO l FROM public.leases WHERE id=p_lease_id FOR UPDATE;
  IF l.id IS NULL OR l.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Lease outside manager scope' USING ERRCODE='42501'; END IF;
  IF l.status IN ('terminated','expired') AND p_target_status<>l.status THEN RAISE EXCEPTION 'Terminal lease cannot be reopened' USING ERRCODE='55000'; END IF;
  UPDATE public.leases SET status=p_target_status,updated_at=now() WHERE id=l.id;
  RETURN jsonb_build_object('success',true,'lease_id',l.id,'status',p_target_status);
END; $$;

CREATE OR REPLACE FUNCTION public.attach_lease_document_atomic(p_lease_id uuid,p_document_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leases%ROWTYPE; v_manager uuid := public.get_effective_manager_id();
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_document_url),'') IS NULL THEN RAISE EXCEPTION 'Document URL is required' USING ERRCODE='22023'; END IF;
  SELECT * INTO l FROM public.leases WHERE id=p_lease_id FOR UPDATE;
  IF l.id IS NULL OR l.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Lease outside manager scope' USING ERRCODE='42501'; END IF;
  UPDATE public.leases SET document_url=p_document_url,updated_at=now() WHERE id=l.id;
  RETURN jsonb_build_object('success',true,'lease_id',l.id);
END; $$;

CREATE OR REPLACE FUNCTION public.assign_lease_tenant_atomic(p_lease_id uuid,p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leases%ROWTYPE; v_manager uuid := public.get_effective_manager_id();
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO l FROM public.leases WHERE id=p_lease_id FOR UPDATE;
  IF l.id IS NULL OR l.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Lease outside manager scope' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=p_tenant_id AND t.manager_id=v_manager AND (l.property_id IS NULL OR t.property_id=l.property_id)) THEN RAISE EXCEPTION 'Tenant outside manager/property scope' USING ERRCODE='42501'; END IF;
  UPDATE public.leases SET tenant_id=p_tenant_id,updated_at=now() WHERE id=l.id;
  RETURN jsonb_build_object('success',true,'lease_id',l.id,'tenant_id',p_tenant_id);
END; $$;

REVOKE ALL ON FUNCTION public.create_contract_atomic(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.transition_contract_atomic(uuid,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.transition_lease_atomic(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.attach_lease_document_atomic(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.assign_lease_tenant_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_contract_atomic(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_contract_atomic(uuid,text,text,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_lease_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.attach_lease_document_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.assign_lease_tenant_atomic(uuid,uuid) TO authenticated,service_role;

REVOKE INSERT,UPDATE,DELETE ON public.contracts FROM authenticated;
REVOKE UPDATE ON public.leases FROM authenticated;
