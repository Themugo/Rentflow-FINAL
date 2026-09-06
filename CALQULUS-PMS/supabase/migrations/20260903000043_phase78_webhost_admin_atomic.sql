-- Phase 78 — Webhost administration / admin-permission convergence
-- All privileged admin mutations are server-authoritative and transactional.

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin_atomic()
RETURNS public.admin_permissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role public.user_roles;
DECLARE v_row public.admin_permissions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_role FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a webhost can bootstrap platform administration'; END IF;
  IF EXISTS (SELECT 1 FROM public.admin_permissions WHERE admin_level = 'super_admin') THEN
    RAISE EXCEPTION 'A super admin already exists';
  END IF;
  INSERT INTO public.admin_permissions(user_id,admin_level,can_create_webhosts,can_manage_billing,can_manage_managers,can_manage_properties,can_manage_tenants,can_view_activity_logs,created_by)
  VALUES(auth.uid(),'super_admin',true,true,true,true,false,true,auth.uid()::text)
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.admin_permissions WHERE user_id=auth.uid() LIMIT 1;
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_admin_permissions_atomic(
  p_id uuid,
  p_admin_level text,
  p_can_manage_managers boolean,
  p_can_manage_billing boolean,
  p_can_manage_properties boolean,
  p_can_manage_system_landlords boolean,
  p_can_view_activity_logs boolean,
  p_can_create_webhosts boolean
)
RETURNS public.admin_permissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_caller public.admin_permissions; v_target public.admin_permissions;
BEGIN
  SELECT * INTO v_caller FROM public.admin_permissions WHERE user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_caller.admin_level <> 'super_admin' THEN RAISE EXCEPTION 'Super admin authorization required'; END IF;
  IF p_admin_level NOT IN ('super_admin','admin','limited_admin') THEN RAISE EXCEPTION 'Invalid admin level'; END IF;
  SELECT * INTO v_target FROM public.admin_permissions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permission record not found'; END IF;
  IF v_target.user_id = auth.uid() AND p_admin_level <> 'super_admin' THEN RAISE EXCEPTION 'Cannot demote yourself'; END IF;
  IF p_admin_level='super_admin' AND v_target.user_id <> auth.uid() AND EXISTS (SELECT 1 FROM public.admin_permissions WHERE admin_level='super_admin' AND user_id<>v_target.user_id) THEN
    RAISE EXCEPTION 'A super admin already exists';
  END IF;
  UPDATE public.admin_permissions SET
    admin_level=p_admin_level,
    can_manage_managers=CASE WHEN p_admin_level IN ('super_admin','admin') THEN true ELSE coalesce(p_can_manage_managers,false) END,
    can_manage_billing=CASE WHEN p_admin_level IN ('super_admin','admin') THEN true ELSE coalesce(p_can_manage_billing,false) END,
    can_manage_properties=CASE WHEN p_admin_level IN ('super_admin','admin') THEN true ELSE coalesce(p_can_manage_properties,false) END,
    can_manage_tenants=false,
    can_view_activity_logs=CASE WHEN p_admin_level='super_admin' THEN true ELSE coalesce(p_can_view_activity_logs,true) END,
    can_create_webhosts=CASE WHEN p_admin_level='super_admin' THEN true ELSE false END,
    updated_at=now()
  WHERE id=p_id RETURNING * INTO v_target;
  RETURN v_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_super_admin_atomic(p_target_user_id uuid)
RETURNS public.admin_permissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_current public.admin_permissions; v_target public.admin_permissions;
BEGIN
  SELECT * INTO v_current FROM public.admin_permissions WHERE user_id=auth.uid() AND admin_level='super_admin' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Super admin authorization required'; END IF;
  SELECT * INTO v_target FROM public.admin_permissions WHERE user_id=p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target admin permission record not found'; END IF;
  IF v_target.user_id=auth.uid() THEN RAISE EXCEPTION 'Target is already super admin'; END IF;
  UPDATE public.admin_permissions SET admin_level='admin',can_create_webhosts=false,updated_at=now() WHERE id=v_current.id;
  UPDATE public.admin_permissions SET admin_level='super_admin',can_manage_managers=true,can_manage_billing=true,can_manage_properties=true,can_manage_tenants=false,can_manage_system_landlords=true,can_view_activity_logs=true,can_create_webhosts=true,updated_at=now() WHERE id=v_target.id RETURNING * INTO v_target;
  RETURN v_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_webhost_atomic(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_caller public.admin_permissions; v_target public.admin_permissions; v_role public.user_roles;
BEGIN
  SELECT * INTO v_caller FROM public.admin_permissions WHERE user_id=auth.uid() AND admin_level='super_admin' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Super admin authorization required'; END IF;
  SELECT * INTO v_target FROM public.admin_permissions WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Webhost permission record not found'; END IF;
  IF v_target.admin_level='super_admin' THEN RAISE EXCEPTION 'Transfer super admin rights before removal'; END IF;
  DELETE FROM public.admin_permissions WHERE id=v_target.id;
  DELETE FROM public.user_roles WHERE user_id=p_user_id AND role='webhost' RETURNING * INTO v_role;
  IF v_role.id IS NULL THEN RAISE EXCEPTION 'Webhost role not found'; END IF;
  RETURN v_role.id;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.admin_permissions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin_atomic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_permissions_atomic(uuid,text,boolean,boolean,boolean,boolean,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_super_admin_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_webhost_atomic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.provision_webhost_admin_atomic(p_user_id uuid, p_admin_level text DEFAULT 'limited_admin')
RETURNS public.admin_permissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_caller public.admin_permissions; v_row public.admin_permissions;
BEGIN
  SELECT * INTO v_caller FROM public.admin_permissions WHERE user_id=auth.uid() AND admin_level='super_admin' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Super admin authorization required'; END IF;
  IF p_admin_level NOT IN ('admin','limited_admin') THEN RAISE EXCEPTION 'Invalid webhost admin level'; END IF;
  INSERT INTO public.user_roles(user_id,role,approval_status) VALUES(p_user_id,'webhost','approved')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.admin_permissions(user_id,admin_level,can_create_webhosts,can_manage_billing,can_manage_managers,can_manage_properties,can_manage_tenants,can_view_activity_logs,created_by)
  VALUES(p_user_id,p_admin_level,false,p_admin_level='admin',p_admin_level='admin',p_admin_level='admin',false,true,auth.uid()::text)
  ON CONFLICT DO NOTHING;
  SELECT * INTO v_row FROM public.admin_permissions WHERE user_id=p_user_id LIMIT 1;
  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.provision_webhost_admin_atomic(uuid,text) TO authenticated;
