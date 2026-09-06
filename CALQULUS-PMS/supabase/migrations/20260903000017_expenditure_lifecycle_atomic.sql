-- CALQULUS Phase 34: manager expenditure lifecycle atomicity.
CREATE UNIQUE INDEX IF NOT EXISTS expenditures_manager_month_category_unique_idx ON public.expenditures(manager_id,month,category);

CREATE OR REPLACE FUNCTION public.save_expenditure_atomic(
  p_manager_id uuid,
  p_category text,
  p_amount numeric,
  p_month text,
  p_description text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_existing public.expenditures%ROWTYPE;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF public.get_effective_manager_id() IS DISTINCT FROM p_manager_id THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF p_category IS NULL OR nullif(trim(p_category),'') IS NULL THEN RAISE EXCEPTION 'Category is required' USING ERRCODE='22023'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive' USING ERRCODE='22023'; END IF;
  IF p_month !~ '^\\d{4}-\\d{2}$' OR substring(p_month,6,2)::int NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Month must be YYYY-MM' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_existing FROM public.expenditures WHERE manager_id=p_manager_id AND month=p_month AND category=trim(p_category) FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    UPDATE public.expenditures SET amount=round(p_amount,2),description=nullif(trim(p_description),''),updated_at=now() WHERE id=v_existing.id RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.expenditures(manager_id,category,amount,month,description) VALUES(p_manager_id,trim(p_category),round(p_amount,2),p_month,nullif(trim(p_description),'')) RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('success',true,'expenditure_id',v_id,'amount',round(p_amount,2),'month',p_month);
END; $$;

REVOKE ALL ON FUNCTION public.save_expenditure_atomic(uuid,text,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_expenditure_atomic(uuid,text,numeric,text,text) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.expenditures FROM authenticated;
