-- Phase 62: platform billing configuration mutation convergence.
-- Browser clients may read configuration, but all financial configuration writes
-- are now server-authorized and validated through SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.save_webhost_payment_settings_atomic(p_payload jsonb)
RETURNS public.webhost_payment_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_row public.webhost_payment_settings%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin_active() THEN
    RAISE EXCEPTION 'Platform administrator authorization required';
  END IF;

  IF COALESCE((p_payload->>'registration_fee')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'Registration fee must be non-negative';
  END IF;
  IF COALESCE((p_payload->>'subscription_rate')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'Subscription rate must be non-negative';
  END IF;

  SELECT * INTO v_row FROM public.webhost_payment_settings ORDER BY created_at, id LIMIT 1 FOR UPDATE;

  IF v_row.id IS NULL THEN
    INSERT INTO public.webhost_payment_settings (
      registration_fee, subscription_rate, bank_name, bank_account_name,
      bank_account_number, bank_branch, bank_swift_code, mpesa_paybill_number,
      mpesa_paybill_account, mpesa_till_number, mpesa_phone_number, payment_instructions
    ) VALUES (
      COALESCE((p_payload->>'registration_fee')::numeric, 3000),
      COALESCE((p_payload->>'subscription_rate')::numeric, 0.01),
      NULLIF(p_payload->>'bank_name',''), NULLIF(p_payload->>'bank_account_name',''),
      NULLIF(p_payload->>'bank_account_number',''), NULLIF(p_payload->>'bank_branch',''),
      NULLIF(p_payload->>'bank_swift_code',''), NULLIF(p_payload->>'mpesa_paybill_number',''),
      NULLIF(p_payload->>'mpesa_paybill_account',''), NULLIF(p_payload->>'mpesa_till_number',''),
      NULLIF(p_payload->>'mpesa_phone_number',''), NULLIF(p_payload->>'payment_instructions','')
    ) RETURNING * INTO v_row;
  ELSE
    UPDATE public.webhost_payment_settings SET
      registration_fee = COALESCE((p_payload->>'registration_fee')::numeric, registration_fee),
      subscription_rate = COALESCE((p_payload->>'subscription_rate')::numeric, subscription_rate),
      bank_name = NULLIF(p_payload->>'bank_name',''), bank_account_name = NULLIF(p_payload->>'bank_account_name',''),
      bank_account_number = NULLIF(p_payload->>'bank_account_number',''), bank_branch = NULLIF(p_payload->>'bank_branch',''),
      bank_swift_code = NULLIF(p_payload->>'bank_swift_code',''), mpesa_paybill_number = NULLIF(p_payload->>'mpesa_paybill_number',''),
      mpesa_paybill_account = NULLIF(p_payload->>'mpesa_paybill_account',''), mpesa_till_number = NULLIF(p_payload->>'mpesa_till_number',''),
      mpesa_phone_number = NULLIF(p_payload->>'mpesa_phone_number',''), payment_instructions = NULLIF(p_payload->>'payment_instructions',''),
      updated_at = now()
    WHERE id = v_row.id RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_platform_billing_rule_atomic(p_rule_id uuid, p_payload jsonb)
RETURNS public.platform_billing_rules
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_row public.platform_billing_rules%ROWTYPE; v_model text;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required'; END IF;
  v_model := COALESCE(p_payload->>'billing_model','per_property');
  IF p_payload->>'rule_name' IS NULL OR btrim(p_payload->>'rule_name') = '' THEN RAISE EXCEPTION 'Rule name is required'; END IF;
  IF COALESCE((p_payload->>'rate_amount')::numeric,0) < 0 OR COALESCE((p_payload->>'registration_fee')::numeric,0) < 0 THEN RAISE EXCEPTION 'Rates and fees must be non-negative'; END IF;
  IF COALESCE((p_payload->>'free_trial_days')::integer,0) < 0 THEN RAISE EXCEPTION 'Free trial days must be non-negative'; END IF;
  IF v_model = 'commission' AND (COALESCE((p_payload->>'rate_pct')::numeric,0) < 0 OR COALESCE((p_payload->>'rate_pct')::numeric,0) > 100) THEN RAISE EXCEPTION 'Commission rate must be between 0 and 100'; END IF;
  IF p_rule_id IS NULL THEN
    INSERT INTO public.platform_billing_rules(rule_name,client_type,billing_model,rate_amount,rate_pct,applies_to_tier,registration_fee,free_trial_days,is_active,notes)
    VALUES (btrim(p_payload->>'rule_name'),p_payload->>'client_type',v_model,COALESCE((p_payload->>'rate_amount')::numeric,0),COALESCE((p_payload->>'rate_pct')::numeric,0),NULLIF(btrim(p_payload->>'applies_to_tier'),''),COALESCE((p_payload->>'registration_fee')::numeric,0),COALESCE((p_payload->>'free_trial_days')::integer,30),COALESCE((p_payload->>'is_active')::boolean,true),NULLIF(p_payload->>'notes','')) RETURNING * INTO v_row;
  ELSE
    UPDATE public.platform_billing_rules SET rule_name=btrim(p_payload->>'rule_name'),client_type=p_payload->>'client_type',billing_model=v_model,rate_amount=COALESCE((p_payload->>'rate_amount')::numeric,0),rate_pct=COALESCE((p_payload->>'rate_pct')::numeric,0),applies_to_tier=NULLIF(btrim(p_payload->>'applies_to_tier'),''),registration_fee=COALESCE((p_payload->>'registration_fee')::numeric,0),free_trial_days=COALESCE((p_payload->>'free_trial_days')::integer,30),is_active=COALESCE((p_payload->>'is_active')::boolean,true),notes=NULLIF(p_payload->>'notes','') WHERE id=p_rule_id RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Billing rule not found'; END IF;
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_platform_billing_rule_atomic(p_rule_id uuid, p_is_active boolean)
RETURNS public.platform_billing_rules
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_row public.platform_billing_rules%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin_active() THEN RAISE EXCEPTION 'Platform administrator authorization required'; END IF;
  UPDATE public.platform_billing_rules SET is_active=p_is_active WHERE id=p_rule_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing rule not found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_platform_billing_rule_atomic(p_rule_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_platform_admin_active('owner') THEN RAISE EXCEPTION 'Owner authorization required'; END IF;
  DELETE FROM public.platform_billing_rules WHERE id=p_rule_id;
END; $$;

REVOKE INSERT, UPDATE, DELETE ON public.webhost_payment_settings FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.platform_billing_rules FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.save_webhost_payment_settings_atomic(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_platform_billing_rule_atomic(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_platform_billing_rule_atomic(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_platform_billing_rule_atomic(uuid) TO authenticated;
