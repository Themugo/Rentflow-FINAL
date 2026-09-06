-- Phase 81 — Profile identity + audit-log mutation convergence
-- Clients may change only explicitly allowed profile preferences; audit identity is server-derived.

CREATE OR REPLACE FUNCTION public.update_profile_currency_atomic(p_currency text)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF upper(p_currency) NOT IN ('KES','USD','EUR','GBP') THEN RAISE EXCEPTION 'Unsupported currency'; END IF;
  UPDATE public.profiles SET currency=upper(p_currency) WHERE id=auth.uid() RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_activity_log_atomic(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.activity_logs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.activity_logs; v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_action IS NULL OR btrim(p_action)='' OR p_entity_type IS NULL OR btrim(p_entity_type)='' THEN RAISE EXCEPTION 'Audit action and entity type are required'; END IF;
  IF p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' THEN RAISE EXCEPTION 'Audit metadata must be an object'; END IF;
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id=auth.uid() AND approval_status='approved' ORDER BY CASE role::text WHEN 'webhost' THEN 1 WHEN 'manager' THEN 2 WHEN 'submanager' THEN 3 WHEN 'tenant' THEN 4 ELSE 5 END LIMIT 1;
  INSERT INTO public.activity_logs(actor_id,actor_email,actor_role,action,entity_type,entity_id,metadata)
  VALUES(auth.uid(),auth.jwt()->>'email',v_role,btrim(p_action),btrim(p_entity_type),p_entity_id,p_metadata)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE INSERT, DELETE ON public.profiles FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_currency_atomic(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_activity_log_atomic(text,text,uuid,jsonb) TO authenticated;
