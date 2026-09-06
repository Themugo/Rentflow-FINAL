-- PHASE 90: Tenant self-registration + cross-role isolation
-- Collapse tenant self-registration into one server-side transaction.
CREATE OR REPLACE FUNCTION public.self_register_tenant_atomic(p_name text, p_phone text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_tenant uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF length(btrim(p_name)) > 160 THEN RAISE EXCEPTION 'Name is too long'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id=v_user;
  IF v_email IS NULL OR btrim(v_email)='' THEN RAISE EXCEPTION 'Authenticated email is required'; END IF;

  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id=v_user AND role='tenant') THEN
    RAISE EXCEPTION 'You are already registered as a tenant';
  END IF;

  INSERT INTO tenants(name,email,phone,manager_id,status,source)
  VALUES(btrim(p_name),lower(btrim(v_email)),NULLIF(btrim(p_phone),''),NULL,'active','self_registered')
  RETURNING id INTO v_tenant;

  INSERT INTO user_roles(user_id,tenant_id,role,approval_status)
  VALUES(v_user,v_tenant,'tenant','approved');

  INSERT INTO profiles(id,email,full_name,phone)
  VALUES(v_user,lower(btrim(v_email)),btrim(p_name),NULLIF(btrim(p_phone),''))
  ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,full_name=EXCLUDED.full_name,phone=COALESCE(EXCLUDED.phone,profiles.phone);

  INSERT INTO tenant_transfer_log(tenant_id,from_manager_id,to_manager_id,transfer_type,transferred_by,notes)
  VALUES(v_tenant,NULL,NULL,'self_register',v_user,'Self-registered via tenant portal');

  RETURN v_tenant;
END $$;

REVOKE ALL ON FUNCTION public.self_register_tenant_atomic(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.self_register_tenant_atomic(text,text) TO authenticated,service_role;
