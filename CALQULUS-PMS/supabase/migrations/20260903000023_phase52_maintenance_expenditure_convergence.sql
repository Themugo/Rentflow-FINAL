-- CALQULUS Phase 52: maintenance financial + property expenditure convergence.
-- Keep maintenance completion, agreed cost and expenditure recording on atomic paths.

ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS expenditure_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS expenditure_recorded_at timestamptz;

-- Property-scoped expenditures need property in their idempotency key.
DROP INDEX IF EXISTS public.expenditures_manager_month_category_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS expenditures_manager_month_category_property_unique_idx
  ON public.expenditures(manager_id, month, category, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE OR REPLACE FUNCTION public.save_property_expenditure_atomic(
  p_property_id uuid,
  p_category text,
  p_amount numeric,
  p_month text,
  p_description text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_manager uuid;
  v_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  v_manager := public.get_effective_manager_id();
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=v_manager) THEN
    RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_category IS NULL OR nullif(trim(p_category),'') IS NULL THEN RAISE EXCEPTION 'Category is required' USING ERRCODE='22023'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive' USING ERRCODE='22023'; END IF;
  IF p_month !~ '^\\d{4}-\\d{2}$' OR substring(p_month,6,2)::int NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Month must be YYYY-MM' USING ERRCODE='22023'; END IF;

  INSERT INTO public.expenditures(manager_id, property_id, category, amount, month, description)
  VALUES(v_manager, p_property_id, trim(p_category), round(p_amount,2), p_month, nullif(trim(p_description),''))
  ON CONFLICT (manager_id, month, category, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET amount=round(EXCLUDED.amount,2), description=EXCLUDED.description, updated_at=now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success',true,'expenditure_id',v_id,'property_id',p_property_id,'amount',round(p_amount,2),'month',p_month);
END; $$;

CREATE OR REPLACE FUNCTION public.save_maintenance_financials_atomic(
  p_request_id uuid,
  p_quoted_amount numeric DEFAULT NULL,
  p_agreed_amount numeric DEFAULT NULL,
  p_provider_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  r public.maintenance_requests%ROWTYPE;
  v_manager uuid;
  v_is_manager boolean;
  v_is_provider boolean;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Maintenance request not found' USING ERRCODE='P0002'; END IF;
  v_manager := public.get_effective_manager_id();
  v_is_manager := v_manager IS NOT NULL AND r.manager_id=v_manager;
  v_is_provider := r.assigned_provider_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.service_providers sp WHERE sp.id=r.assigned_provider_id AND sp.user_id=auth.uid()
  );

  IF NOT v_is_manager AND NOT v_is_provider THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_quoted_amount IS NOT NULL AND p_quoted_amount < 0 THEN RAISE EXCEPTION 'Quote cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_agreed_amount IS NOT NULL AND p_agreed_amount < 0 THEN RAISE EXCEPTION 'Agreed amount cannot be negative' USING ERRCODE='22023'; END IF;
  IF p_agreed_amount IS NOT NULL AND p_quoted_amount IS NOT NULL AND p_agreed_amount > 0 AND p_quoted_amount > 0 AND p_agreed_amount < p_quoted_amount THEN
    -- A lower negotiated price is valid; this branch intentionally documents that no upward-only rule is imposed.
    NULL;
  END IF;

  IF (p_quoted_amount IS NOT NULL OR p_agreed_amount IS NOT NULL) AND NOT v_is_manager THEN
    RAISE EXCEPTION 'Only the manager may set quote or agreed amount' USING ERRCODE='42501';
  END IF;
  IF p_provider_notes IS NOT NULL AND NOT v_is_provider AND NOT v_is_manager THEN
    RAISE EXCEPTION 'Only assigned provider or manager may update provider notes' USING ERRCODE='42501';
  END IF;

  UPDATE public.maintenance_requests
  SET quoted_amount=CASE WHEN p_quoted_amount IS NULL THEN quoted_amount ELSE round(p_quoted_amount,2) END,
      agreed_amount=CASE WHEN p_agreed_amount IS NULL THEN agreed_amount ELSE round(p_agreed_amount,2) END,
      provider_notes=CASE WHEN p_provider_notes IS NULL THEN provider_notes ELSE nullif(trim(p_provider_notes),'') END,
      updated_at=now()
  WHERE id=r.id;

  RETURN jsonb_build_object('success',true,'request_id',r.id,'quoted_amount',COALESCE(p_quoted_amount,r.quoted_amount),'agreed_amount',COALESCE(p_agreed_amount,r.agreed_amount));
END; $$;

CREATE OR REPLACE FUNCTION public.record_maintenance_expenditure_atomic(
  p_request_id uuid,
  p_amount numeric DEFAULT NULL,
  p_month text DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  r public.maintenance_requests%ROWTYPE;
  v_manager uuid;
  v_property_id uuid;
  v_amount numeric;
  v_month text := COALESCE(p_month, to_char(current_date,'YYYY-MM'));
  v_exp_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  v_manager := public.get_effective_manager_id();
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL OR r.manager_id IS DISTINCT FROM v_manager THEN RAISE EXCEPTION 'Maintenance request outside manager scope' USING ERRCODE='42501'; END IF;
  IF r.status <> 'completed' THEN RAISE EXCEPTION 'Maintenance must be completed before recording expenditure' USING ERRCODE='55000'; END IF;
  IF r.expenditure_recorded_at IS NOT NULL THEN RAISE EXCEPTION 'Maintenance expenditure already recorded' USING ERRCODE='23505'; END IF;
  v_amount := COALESCE(p_amount, r.agreed_amount, r.quoted_amount, r.budget);
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'A positive maintenance cost is required' USING ERRCODE='22023'; END IF;
  IF v_month !~ '^\\d{4}-\\d{2}$' OR substring(v_month,6,2)::int NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Month must be YYYY-MM' USING ERRCODE='22023'; END IF;

  SELECT property_id INTO v_property_id FROM public.units WHERE id=r.unit_id;
  IF v_property_id IS NULL THEN
    SELECT id INTO v_property_id FROM public.properties WHERE manager_id=v_manager AND name=r.property_name ORDER BY created_at LIMIT 1;
  END IF;
  IF v_property_id IS NULL THEN RAISE EXCEPTION 'Unable to resolve maintenance property' USING ERRCODE='P0002'; END IF;

  INSERT INTO public.expenditures(manager_id, property_id, category, amount, month, description)
  VALUES(v_manager, v_property_id, 'maintenance', round(v_amount,2), v_month,
         COALESCE(nullif(trim(p_description),''), 'Maintenance: ' || r.title))
  ON CONFLICT (manager_id, month, category, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET amount=round(public.expenditures.amount + EXCLUDED.amount,2), updated_at=now()
  RETURNING id INTO v_exp_id;

  UPDATE public.maintenance_requests
  SET expenditure_amount=round(v_amount,2), expenditure_recorded_at=now(), updated_at=now()
  WHERE id=r.id;

  RETURN jsonb_build_object('success',true,'request_id',r.id,'expenditure_id',v_exp_id,'amount',round(v_amount,2),'month',v_month);
END; $$;

REVOKE ALL ON FUNCTION public.save_property_expenditure_atomic(uuid,text,numeric,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_maintenance_financials_atomic(uuid,numeric,numeric,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.record_maintenance_expenditure_atomic(uuid,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_property_expenditure_atomic(uuid,text,numeric,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_maintenance_financials_atomic(uuid,numeric,numeric,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_maintenance_expenditure_atomic(uuid,numeric,text,text) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.expenditures FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.maintenance_requests FROM authenticated;
