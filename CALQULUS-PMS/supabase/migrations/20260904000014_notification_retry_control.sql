-- CALQULUS PMS — Notification retry control
-- Adds a guarded one-click retry path for payment notification failures.

-- Submanagers must be able to operate their manager's failure queue, matching
-- the portfolio access model used by payment reconciliation.
CREATE OR REPLACE FUNCTION public.transition_notification_failure_atomic(
  p_id uuid,
  p_status text
) RETURNS public.notification_failures
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_row public.notification_failures%ROWTYPE;
  v_manager uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('pending','replayed','resolved','ignored') THEN RAISE EXCEPTION 'Invalid notification failure status' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.notification_failures WHERE id=p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Notification failure not found' USING ERRCODE='P0002'; END IF;
  v_manager := v_row.manager_id;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid LIMIT 1;
  IF v_role <> 'webhost' AND v_uid IS DISTINCT FROM v_manager AND NOT EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) THEN
    RAISE EXCEPTION 'Notification failure authorization required' USING ERRCODE='42501';
  END IF;

  UPDATE public.notification_failures
  SET status=p_status,
      resolved_at=CASE WHEN p_status IN ('resolved','ignored') THEN COALESCE(resolved_at,now()) ELSE NULL END,
      resolved_by=CASE WHEN p_status IN ('resolved','ignored') THEN v_uid ELSE NULL END,
      attempts=CASE WHEN p_status='replayed' THEN attempts+1 ELSE attempts END,
      last_retry_at=CASE WHEN p_status='replayed' THEN now() ELSE last_retry_at END
  WHERE id=p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.transition_notification_failure_atomic(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.transition_notification_failure_atomic(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_notification_failure_retry_atomic(p_id uuid)
RETURNS public.notification_failures
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.notification_failures%ROWTYPE;
  v_role text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_row FROM public.notification_failures WHERE id=p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Notification failure not found' USING ERRCODE='P0002'; END IF;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid LIMIT 1;
  IF v_role <> 'webhost' AND v_uid IS DISTINCT FROM v_row.manager_id AND NOT EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_row.manager_id AND ms.submanager_user_id=v_uid
  ) THEN
    RAISE EXCEPTION 'Notification failure authorization required' USING ERRCODE='42501';
  END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'Only pending failures can be retried' USING ERRCODE='22023'; END IF;
  IF v_row.attempts >= 3 THEN RAISE EXCEPTION 'Retry limit reached; resolve the failure manually' USING ERRCODE='42901'; END IF;
  IF v_row.last_retry_at IS NOT NULL AND v_row.last_retry_at > now()-interval '60 seconds' THEN
    RAISE EXCEPTION 'Please wait before retrying this notification' USING ERRCODE='42901';
  END IF;

  UPDATE public.notification_failures
  SET attempts=attempts+1, last_retry_at=now()
  WHERE id=p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_notification_failure_retry_atomic(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_notification_failure_retry_atomic(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_notification_failures_retry_queue
  ON public.notification_failures(manager_id, status, last_retry_at, created_at DESC);

COMMENT ON FUNCTION public.claim_notification_failure_retry_atomic(uuid) IS
'Authorizes and reserves a notification retry with a three-attempt cap and 60-second cooldown.';
