-- Phase 80 — Notification + push subscription mutation convergence
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_uidx ON public.push_subscriptions(user_id, endpoint);
-- User identity is always derived/validated server-side; clients cannot mutate these rows directly.

CREATE OR REPLACE FUNCTION public.create_in_app_notification_atomic(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text DEFAULT 'info',
  p_action_url text DEFAULT NULL,
  p_action_label text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_source text DEFAULT 'system',
  p_manager_id uuid DEFAULT NULL
)
RETURNS public.in_app_notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.in_app_notifications;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_user_id IS NULL OR p_title IS NULL OR btrim(p_title)='' OR p_body IS NULL OR btrim(p_body)='' THEN
    RAISE EXCEPTION 'Notification user, title and body are required';
  END IF;
  IF p_type NOT IN ('info','payment','maintenance','notice','alert','reminder','broadcast','tenant') THEN RAISE EXCEPTION 'Invalid notification type'; END IF;
  IF p_priority NOT IN ('low','normal','high','urgent') THEN RAISE EXCEPTION 'Invalid notification priority'; END IF;
  IF p_manager_id IS NULL OR p_manager_id <> auth.uid() THEN RAISE EXCEPTION 'Manager authorization required'; END IF;
  IF p_user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.tenants t ON t.id=ur.tenant_id
    WHERE ur.user_id=p_user_id AND ur.role='tenant' AND t.manager_id=auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.submanager_property_assignments spa ON spa.submanager_user_id=ur.user_id
    WHERE ur.user_id=p_user_id AND ur.role='submanager' AND spa.manager_id=auth.uid()
  ) THEN RAISE EXCEPTION 'Recipient is outside the current management scope'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('manager','submanager') AND approval_status='approved')
     AND NOT EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id=auth.uid() AND admin_level IN ('super_admin','admin')) THEN
    RAISE EXCEPTION 'Notification creation not authorized';
  END IF;
  INSERT INTO public.in_app_notifications(user_id,manager_id,title,body,type,action_url,action_label,reference_id,reference_type,priority,source)
  VALUES(p_user_id,p_manager_id,btrim(p_title),btrim(p_body),p_type,p_action_url,p_action_label,p_reference_id,p_reference_type,p_priority,p_source)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_in_app_notification_read_atomic(p_notification_id uuid)
RETURNS public.in_app_notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.in_app_notifications;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.in_app_notifications
  SET is_read=true, read_at=COALESCE(read_at,now())
  WHERE id=p_notification_id AND user_id=auth.uid()
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification not found or not owned by current user'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_in_app_notifications_read_atomic()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.in_app_notifications
  SET is_read=true, read_at=COALESCE(read_at,now())
  WHERE user_id=auth.uid() AND is_read=false AND is_dismissed=false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_in_app_notification_atomic(p_notification_id uuid)
RETURNS public.in_app_notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.in_app_notifications;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.in_app_notifications
  SET is_dismissed=true, dismissed_at=COALESCE(dismissed_at,now())
  WHERE id=p_notification_id AND user_id=auth.uid()
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification not found or not owned by current user'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_push_subscription_atomic(
  p_endpoint text,
  p_p256dh_key text,
  p_auth_key text
)
RETURNS public.push_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.push_subscriptions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_endpoint IS NULL OR btrim(p_endpoint)='' OR p_p256dh_key IS NULL OR btrim(p_p256dh_key)='' OR p_auth_key IS NULL OR btrim(p_auth_key)='' THEN
    RAISE EXCEPTION 'Complete push subscription is required';
  END IF;
  INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh_key,auth_key,updated_at)
  VALUES(auth.uid(),p_endpoint,p_p256dh_key,p_auth_key,now())
  ON CONFLICT (user_id,endpoint) DO UPDATE SET p256dh_key=EXCLUDED.p256dh_key,auth_key=EXCLUDED.auth_key,updated_at=now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_push_subscription_atomic(p_endpoint text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.push_subscriptions WHERE user_id=auth.uid() AND endpoint=p_endpoint;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.in_app_notifications FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.push_subscriptions FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_in_app_notification_atomic(uuid,text,text,text,text,text,uuid,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_in_app_notification_read_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_in_app_notifications_read_atomic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_in_app_notification_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_push_subscription_atomic(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription_atomic(text) TO authenticated;
