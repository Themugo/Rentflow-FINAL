-- Phase 79 — Role administration boundary
-- Manager-facing role management must not be able to mint/delete manager roles.
-- Manager delegation belongs to the dedicated submanager RPC workflow.

CREATE OR REPLACE FUNCTION public.assign_manager_role_atomic(p_user_id uuid)
RETURNS public.user_roles
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_caller_role public.user_roles; v_existing public.user_roles; v_result public.user_roles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_caller_role FROM public.user_roles WHERE user_id=auth.uid() AND role='webhost' AND approval_status='approved' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Webhost authorization required'; END IF;
  SELECT * INTO v_existing FROM public.user_roles WHERE user_id=p_user_id AND role='manager' LIMIT 1;
  IF FOUND THEN RETURN v_existing; END IF;
  INSERT INTO public.user_roles(user_id,role,approval_status) VALUES(p_user_id,'manager','approved') RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_manager_role_atomic(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_caller_role public.user_roles; v_id uuid;
BEGIN
  SELECT * INTO v_caller_role FROM public.user_roles WHERE user_id=auth.uid() AND role='webhost' AND approval_status='approved' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Webhost authorization required'; END IF;
  DELETE FROM public.user_roles WHERE user_id=p_user_id AND role='manager' RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Manager role not found'; END IF;
  RETURN v_id;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.assign_manager_role_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_manager_role_atomic(uuid) TO authenticated;
