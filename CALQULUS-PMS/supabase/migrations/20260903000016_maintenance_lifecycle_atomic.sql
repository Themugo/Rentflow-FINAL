-- CALQULUS Phase 33: maintenance request lifecycle atomicity.
-- All authenticated maintenance writes go through manager/tenant/provider-scoped RPCs.

CREATE OR REPLACE FUNCTION public.create_maintenance_request_atomic(
  p_title text,
  p_description text,
  p_property_name text,
  p_unit_number text DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_tenant_name text DEFAULT '',
  p_tenant_email text DEFAULT '',
  p_priority text DEFAULT 'medium',
  p_category text DEFAULT 'other',
  p_expected_completion_date date DEFAULT NULL,
  p_budget numeric DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_created_by_role text DEFAULT 'manager'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_manager uuid; v_role text; v_unit_property uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_title IS NULL OR nullif(trim(p_title),'') IS NULL OR p_description IS NULL OR nullif(trim(p_description),'') IS NULL THEN RAISE EXCEPTION 'Title and description are required' USING ERRCODE='22023'; END IF;
  IF p_priority NOT IN ('low','medium','high','urgent') THEN RAISE EXCEPTION 'Invalid priority' USING ERRCODE='22023'; END IF;
  IF p_budget IS NOT NULL AND p_budget < 0 THEN RAISE EXCEPTION 'Budget cannot be negative' USING ERRCODE='22023'; END IF;

  SELECT COALESCE(ur.role::text,''), ur.tenant_id INTO v_role, v_unit_property
  FROM public.user_roles ur WHERE ur.user_id=auth.uid() ORDER BY CASE WHEN ur.role='tenant' THEN 0 ELSE 1 END LIMIT 1;

  IF v_role='tenant' THEN
    IF p_manager_id IS NOT NULL THEN
      SELECT t.manager_id INTO v_manager FROM public.tenants t WHERE t.id=v_unit_property;
      IF v_manager IS DISTINCT FROM p_manager_id THEN RAISE EXCEPTION 'Invalid manager scope' USING ERRCODE='42501'; END IF;
    ELSE
      SELECT t.manager_id INTO v_manager FROM public.tenants t WHERE t.id=v_unit_property;
    END IF;
    IF v_manager IS NULL THEN RAISE EXCEPTION 'Tenant manager not found' USING ERRCODE='42501'; END IF;
    IF p_tenant_email IS DISTINCT FROM (SELECT email FROM public.tenants WHERE id=v_unit_property) THEN RAISE EXCEPTION 'Tenant identity mismatch' USING ERRCODE='42501'; END IF;
    IF p_created_by_role <> 'tenant' THEN RAISE EXCEPTION 'Invalid creator role' USING ERRCODE='42501'; END IF;
  ELSE
    v_manager := public.get_effective_manager_id();
    IF v_manager IS NULL OR p_manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
    IF v_role NOT IN ('manager','submanager','agency') THEN RAISE EXCEPTION 'Maintenance creation not permitted' USING ERRCODE='42501'; END IF;
    IF p_created_by_role <> 'manager' THEN RAISE EXCEPTION 'Invalid creator role' USING ERRCODE='42501'; END IF;
  END IF;

  IF p_unit_id IS NOT NULL THEN
    SELECT property_id INTO v_unit_property FROM public.units WHERE id=p_unit_id;
    IF v_unit_property IS NULL OR NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=v_unit_property AND p.manager_id=v_manager) THEN
      RAISE EXCEPTION 'Unit is outside manager portfolio' USING ERRCODE='42501';
    END IF;
  END IF;

  INSERT INTO public.maintenance_requests(title,description,property_name,unit_number,unit_id,tenant_name,tenant_email,priority,category,requested_date,expected_completion_date,budget,created_by_role,manager_id,status)
  VALUES(trim(p_title),trim(p_description),trim(p_property_name),nullif(trim(p_unit_number),''),p_unit_id,trim(p_tenant_name),trim(p_tenant_email),p_priority,p_category,CURRENT_DATE,p_expected_completion_date,p_budget,p_created_by_role,v_manager,'open')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'request_id',v_id,'status','open');
END; $$;

CREATE OR REPLACE FUNCTION public.transition_maintenance_request_atomic(
  p_request_id uuid,
  p_target_status text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.maintenance_requests%ROWTYPE; v_manager uuid; v_role text; v_provider uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_target_status NOT IN ('open','in_progress','completed','cancelled') THEN RAISE EXCEPTION 'Invalid maintenance status' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Maintenance request not found' USING ERRCODE='P0002'; END IF;
  v_manager := public.get_effective_manager_id();
  SELECT ur.role::text INTO v_role FROM public.user_roles ur WHERE ur.user_id=auth.uid() ORDER BY CASE WHEN ur.role='manager' THEN 0 ELSE 1 END LIMIT 1;

  IF v_role IN ('manager','submanager','agency') AND r.manager_id=v_manager THEN
    IF r.status IN ('completed','cancelled') AND p_target_status<>r.status THEN RAISE EXCEPTION 'Terminal maintenance request cannot be reopened' USING ERRCODE='55000'; END IF;
    IF r.status='open' AND p_target_status NOT IN ('open','in_progress','cancelled') THEN RAISE EXCEPTION 'Invalid status transition' USING ERRCODE='55000'; END IF;
    IF r.status='in_progress' AND p_target_status NOT IN ('in_progress','completed','cancelled') THEN RAISE EXCEPTION 'Invalid status transition' USING ERRCODE='55000'; END IF;
    UPDATE public.maintenance_requests SET status=p_target_status, completion_date=CASE WHEN p_target_status='completed' THEN CURRENT_DATE ELSE completion_date END, updated_at=now() WHERE id=r.id;
  ELSIF EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.id=r.assigned_provider_id AND sp.user_id=auth.uid()) THEN
    IF p_target_status='in_progress' AND r.status='open' THEN UPDATE public.maintenance_requests SET status='in_progress',provider_started_at=now(),updated_at=now() WHERE id=r.id;
    ELSIF p_target_status='completed' AND r.status='in_progress' THEN UPDATE public.maintenance_requests SET status='completed',provider_completed_at=now(),completion_date=CURRENT_DATE,updated_at=now() WHERE id=r.id;
    ELSE RAISE EXCEPTION 'Provider may only start open jobs or complete active jobs' USING ERRCODE='55000'; END IF;
  ELSE
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN jsonb_build_object('success',true,'request_id',r.id,'status',p_target_status);
END; $$;

CREATE OR REPLACE FUNCTION public.assign_maintenance_request_atomic(
  p_request_id uuid,
  p_assigned_to text,
  p_provider_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.maintenance_requests%ROWTYPE; v_manager uuid;
BEGIN
  IF auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  v_manager:=public.get_effective_manager_id();
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL OR r.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Maintenance request outside manager scope' USING ERRCODE='42501'; END IF;
  IF p_provider_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.id=p_provider_id AND sp.status='active') THEN RAISE EXCEPTION 'Invalid service provider' USING ERRCODE='22023'; END IF;
  UPDATE public.maintenance_requests SET assigned_to=nullif(trim(p_assigned_to),''),assigned_provider_id=p_provider_id,updated_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'request_id',r.id,'assigned_provider_id',p_provider_id);
END; $$;

REVOKE ALL ON FUNCTION public.create_maintenance_request_atomic(text,text,text,text,uuid,text,text,text,text,date,numeric,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.transition_maintenance_request_atomic(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.assign_maintenance_request_atomic(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_maintenance_request_atomic(text,text,text,text,uuid,text,text,text,text,date,numeric,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_maintenance_request_atomic(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.assign_maintenance_request_atomic(uuid,text,uuid) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.maintenance_requests FROM authenticated;
