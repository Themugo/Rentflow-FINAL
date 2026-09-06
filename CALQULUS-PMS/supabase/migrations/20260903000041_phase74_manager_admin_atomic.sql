-- CALQULUS PMS Phase 74: manager administration mutation convergence
-- All manager approval/status/tier mutations are server-authorized and atomic.

CREATE OR REPLACE FUNCTION public.provision_manager_account_atomic(
  p_manager_user_id uuid,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_actor AND role = 'webhost'
  ) THEN
    RAISE EXCEPTION 'Only webhost administrators may provision manager accounts';
  END IF;
  IF p_manager_user_id IS NULL THEN RAISE EXCEPTION 'Manager user id is required'; END IF;

  INSERT INTO public.user_roles (user_id, role, approval_status)
  VALUES (p_manager_user_id, 'manager', 'approved')
  ON CONFLICT (user_id, role) DO UPDATE SET approval_status = 'approved';

  INSERT INTO public.manager_profiles (
    manager_user_id, status, approved_at, approved_by
  ) VALUES (
    p_manager_user_id, 'approved', now(), v_actor
  )
  ON CONFLICT (manager_user_id) DO UPDATE SET
    status = 'approved', approved_at = now(), approved_by = v_actor,
    updated_at = now();

  RETURN jsonb_build_object('manager_user_id', p_manager_user_id, 'status', 'approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_manager_admin_atomic(
  p_manager_user_id uuid,
  p_action text,
  p_reason text DEFAULT NULL,
  p_subscription_tier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old_status text;
  v_new_status text;
  v_tier text;
  v_max_properties integer;
  v_max_units integer;
  v_platform_rate numeric;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_actor AND role = 'webhost'
  ) THEN
    RAISE EXCEPTION 'Only webhost administrators may manage managers';
  END IF;
  IF p_manager_user_id IS NULL THEN RAISE EXCEPTION 'Manager user id is required'; END IF;

  SELECT approval_status INTO v_old_status
  FROM public.user_roles
  WHERE user_id = p_manager_user_id AND role = 'manager'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Manager role not found'; END IF;

  IF p_action IN ('reject','suspend') AND NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION '% reason is required', p_action;
  END IF;

  IF p_action = 'approve' THEN
    v_new_status := 'approved';
    UPDATE public.user_roles SET approval_status = v_new_status WHERE user_id = p_manager_user_id AND role = 'manager';
    INSERT INTO public.manager_profiles (manager_user_id, status, approval_notes, approved_at, approved_by)
    VALUES (p_manager_user_id, 'approved', NULLIF(trim(p_reason), ''), now(), v_actor)
    ON CONFLICT (manager_user_id) DO UPDATE SET
      status='approved', approval_notes=NULLIF(trim(p_reason), ''), rejection_reason=NULL,
      suspension_reason=NULL, suspended_at=NULL, suspended_by=NULL, approved_at=now(), approved_by=v_actor, updated_at=now();
  ELSIF p_action = 'reject' THEN
    v_new_status := 'rejected';
    UPDATE public.user_roles SET approval_status = v_new_status WHERE user_id = p_manager_user_id AND role = 'manager';
    INSERT INTO public.manager_profiles (manager_user_id, status, rejection_reason)
    VALUES (p_manager_user_id, 'rejected', trim(p_reason))
    ON CONFLICT (manager_user_id) DO UPDATE SET
      status='rejected', rejection_reason=trim(p_reason), suspension_reason=NULL, updated_at=now();
  ELSIF p_action = 'suspend' THEN
    v_new_status := 'suspended';
    UPDATE public.user_roles SET approval_status = v_new_status WHERE user_id = p_manager_user_id AND role = 'manager';
    INSERT INTO public.manager_profiles (manager_user_id, status, suspension_reason, suspended_at, suspended_by)
    VALUES (p_manager_user_id, 'suspended', trim(p_reason), now(), v_actor)
    ON CONFLICT (manager_user_id) DO UPDATE SET
      status='suspended', suspension_reason=trim(p_reason), suspended_at=now(), suspended_by=v_actor, updated_at=now();
  ELSIF p_action = 'reinstate' THEN
    v_new_status := 'approved';
    UPDATE public.user_roles SET approval_status = v_new_status WHERE user_id = p_manager_user_id AND role = 'manager';
    INSERT INTO public.manager_profiles (manager_user_id, status)
    VALUES (p_manager_user_id, 'approved')
    ON CONFLICT (manager_user_id) DO UPDATE SET
      status='approved', suspension_reason=NULL, suspended_at=NULL, suspended_by=NULL, rejection_reason=NULL, updated_at=now();
  ELSIF p_action = 'set_tier' THEN
    v_tier := lower(trim(COALESCE(p_subscription_tier, '')));
    IF v_tier = 'starter' THEN v_max_properties:=5; v_max_units:=50; v_platform_rate:=500;
    ELSIF v_tier = 'growth' THEN v_max_properties:=20; v_max_units:=200; v_platform_rate:=450;
    ELSIF v_tier = 'professional' THEN v_max_properties:=50; v_max_units:=500; v_platform_rate:=400;
    ELSIF v_tier = 'enterprise' THEN v_max_properties:=999; v_max_units:=9999; v_platform_rate:=350;
    ELSE RAISE EXCEPTION 'Unsupported subscription tier'; END IF;
    INSERT INTO public.manager_profiles (manager_user_id, status, subscription_tier, max_properties, max_units, platform_rate)
    VALUES (p_manager_user_id, v_old_status, v_tier, v_max_properties, v_max_units, v_platform_rate)
    ON CONFLICT (manager_user_id) DO UPDATE SET
      subscription_tier=v_tier, max_properties=v_max_properties, max_units=v_max_units,
      platform_rate=v_platform_rate, updated_at=now();
    v_new_status := v_old_status;
  ELSE
    RAISE EXCEPTION 'Unsupported manager action: %', p_action;
  END IF;

  IF p_action <> 'set_tier' THEN
    INSERT INTO public.manager_status_log (
      manager_user_id, changed_by, changed_by_role, old_status, new_status, reason, notify_manager
    ) VALUES (
      p_manager_user_id, v_actor, 'webhost', v_old_status, v_new_status, NULLIF(trim(p_reason), ''), true
    );
  END IF;

  RETURN jsonb_build_object('manager_user_id', p_manager_user_id, 'action', p_action, 'status', v_new_status);
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.manager_status_log FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.manager_profiles FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.provision_manager_account_atomic(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_manager_admin_atomic(uuid,text,text,text) TO authenticated;
