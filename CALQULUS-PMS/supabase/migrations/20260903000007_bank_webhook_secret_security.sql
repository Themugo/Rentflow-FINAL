-- CALQULUS PMS — Phase 22: bank webhook secret security
-- Keep the signing secret out of normal PostgREST reads. Managers explicitly
-- reveal or rotate it through SECURITY DEFINER RPCs when configuration requires it.

REVOKE SELECT (webhook_secret), INSERT (webhook_secret), UPDATE (webhook_secret)
  ON public.bank_integration_settings FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_bank_webhook_secret_atomic(
  p_bank_integration_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_manager uuid; v_secret text;
BEGIN
  SELECT manager_id, webhook_secret INTO v_manager, v_secret
  FROM public.bank_integration_settings
  WHERE id = p_bank_integration_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Bank integration not found' USING ERRCODE='P0002'; END IF;
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> v_manager) THEN
    RAISE EXCEPTION 'Unauthorized bank secret access' USING ERRCODE='42501';
  END IF;
  IF v_secret IS NULL OR length(v_secret) < 16 THEN
    RAISE EXCEPTION 'Bank webhook secret is not configured' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('success', true, 'webhook_secret', v_secret);
END; $$;

CREATE OR REPLACE FUNCTION public.rotate_bank_webhook_secret_atomic(
  p_bank_integration_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_manager uuid; v_secret text;
BEGIN
  SELECT manager_id INTO v_manager
  FROM public.bank_integration_settings
  WHERE id = p_bank_integration_id FOR UPDATE;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Bank integration not found' USING ERRCODE='P0002'; END IF;
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> v_manager) THEN
    RAISE EXCEPTION 'Unauthorized bank secret rotation' USING ERRCODE='42501';
  END IF;
  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_secret := substr(v_secret, 1, 48);
  UPDATE public.bank_integration_settings
  SET webhook_secret = v_secret, updated_at = now()
  WHERE id = p_bank_integration_id;
  RETURN jsonb_build_object('success', true, 'webhook_secret', v_secret, 'rotated_at', now());
END; $$;

REVOKE ALL ON FUNCTION public.get_bank_webhook_secret_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_bank_webhook_secret_atomic(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rotate_bank_webhook_secret_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_bank_webhook_secret_atomic(uuid) TO authenticated, service_role;
