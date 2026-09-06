-- CALQULUS PMS — Phase 20: bank integration settings atomicity
-- Configuration mutations are kept behind one authorized DB boundary so a
-- manager cannot bind an integration to another manager's property.

CREATE OR REPLACE FUNCTION public.create_bank_integration_atomic(
  p_manager_id uuid,
  p_bank_name text,
  p_account_number text DEFAULT NULL,
  p_account_name text DEFAULT NULL,
  p_paybill_number text DEFAULT NULL,
  p_webhook_secret text DEFAULT NULL,
  p_auto_reconcile boolean DEFAULT true,
  p_match_by text DEFAULT 'amount_and_unit',
  p_property_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_secret text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'manager'
  ) THEN RAISE EXCEPTION 'Unauthorized bank integration creation' USING ERRCODE='42501'; END IF;
  IF p_manager_id IS NULL THEN RAISE EXCEPTION 'Manager context required' USING ERRCODE='22023'; END IF;
  IF auth.role() <> 'service_role' AND p_manager_id <> auth.uid() THEN RAISE EXCEPTION 'Manager context mismatch' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_manager_id AND role = 'manager') THEN RAISE EXCEPTION 'Invalid manager context' USING ERRCODE='42501'; END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.properties WHERE id = p_property_id AND manager_id = p_manager_id
  ) THEN RAISE EXCEPTION 'Property ownership mismatch' USING ERRCODE='42501'; END IF;
  IF p_bank_name NOT IN ('equity','kcb','ncba','coop','absa','stanbic','other') THEN RAISE EXCEPTION 'Invalid bank' USING ERRCODE='22023'; END IF;
  IF p_match_by NOT IN ('amount_and_unit','reference','amount_only','manual') THEN RAISE EXCEPTION 'Invalid matching mode' USING ERRCODE='22023'; END IF;
  IF p_webhook_secret IS NULL OR length(btrim(p_webhook_secret)) < 16 THEN
    v_secret := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  ELSE v_secret := btrim(p_webhook_secret); END IF;

  INSERT INTO public.bank_integration_settings (
    manager_id, property_id, bank_name, account_number, account_name,
    paybill_number, webhook_secret, auto_reconcile, match_by
  ) VALUES (
    p_manager_id,
    p_property_id, lower(btrim(p_bank_name)), NULLIF(btrim(p_account_number),''),
    NULLIF(btrim(p_account_name),''), NULLIF(btrim(p_paybill_number),''),
    v_secret, COALESCE(p_auto_reconcile,true), p_match_by
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success',true,'id',v_id,'webhook_secret',v_secret);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'A bank integration for this bank and property already exists' USING ERRCODE='23505';
END; $$;

-- Service-role calls must supply the manager context through the existing
-- authenticated wrapper in normal UI use. Internal service callers should
-- not use this mutation unless auth.uid() is meaningful.
REVOKE ALL ON FUNCTION public.create_bank_integration_atomic(uuid,text,text,text,text,text,boolean,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bank_integration_atomic(uuid,text,text,text,text,text,boolean,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_bank_integration_active_atomic(
  p_bank_integration_id uuid, p_is_active boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid;
BEGIN
  SELECT manager_id INTO v_manager FROM public.bank_integration_settings WHERE id=p_bank_integration_id FOR UPDATE;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Bank integration not found' USING ERRCODE='P0002'; END IF;
  IF auth.role() <> 'service_role' AND v_manager <> auth.uid() THEN RAISE EXCEPTION 'Unauthorized bank integration update' USING ERRCODE='42501'; END IF;
  UPDATE public.bank_integration_settings SET is_active=COALESCE(p_is_active,false), updated_at=now() WHERE id=p_bank_integration_id;
  RETURN jsonb_build_object('success',true,'id',p_bank_integration_id,'is_active',COALESCE(p_is_active,false));
END; $$;

CREATE OR REPLACE FUNCTION public.delete_bank_integration_atomic(p_bank_integration_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid;
BEGIN
  SELECT manager_id INTO v_manager FROM public.bank_integration_settings WHERE id=p_bank_integration_id FOR UPDATE;
  IF v_manager IS NULL THEN RETURN jsonb_build_object('success',true,'idempotent',true,'deleted',false); END IF;
  IF auth.role() <> 'service_role' AND v_manager <> auth.uid() THEN RAISE EXCEPTION 'Unauthorized bank integration deletion' USING ERRCODE='42501'; END IF;
  DELETE FROM public.bank_integration_settings WHERE id=p_bank_integration_id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'deleted',true);
END; $$;

REVOKE ALL ON FUNCTION public.set_bank_integration_active_atomic(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bank_integration_active_atomic(uuid,boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_bank_integration_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_bank_integration_atomic(uuid) TO authenticated, service_role;
