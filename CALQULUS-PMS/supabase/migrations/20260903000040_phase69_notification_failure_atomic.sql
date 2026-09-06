-- Phase 69: Notification failure lifecycle integrity
DROP POLICY IF EXISTS "manager_updates_own_notification_failures" ON public.notification_failures;
DROP POLICY IF EXISTS "webhost_updates_all_notification_failures" ON public.notification_failures;

CREATE OR REPLACE FUNCTION public.transition_notification_failure_atomic(
  p_id uuid,
  p_status text
) RETURNS public.notification_failures
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_row public.notification_failures%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('pending','replayed','resolved','ignored') THEN RAISE EXCEPTION 'Invalid notification failure status' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.notification_failures WHERE id=p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Notification failure not found' USING ERRCODE='P0002'; END IF;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid LIMIT 1;
  IF v_role<>'webhost' AND v_row.manager_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Notification failure authorization required' USING ERRCODE='42501'; END IF;
  UPDATE public.notification_failures SET status=p_status, resolved_at=CASE WHEN p_status IN ('resolved','ignored') THEN COALESCE(resolved_at,now()) ELSE NULL END, resolved_by=CASE WHEN p_status IN ('resolved','ignored') THEN v_uid ELSE NULL END, attempts=CASE WHEN p_status='replayed' THEN attempts+1 ELSE attempts END, last_retry_at=CASE WHEN p_status='replayed' THEN now() ELSE last_retry_at END WHERE id=p_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.notification_failures FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.transition_notification_failure_atomic(uuid,text) TO authenticated;
