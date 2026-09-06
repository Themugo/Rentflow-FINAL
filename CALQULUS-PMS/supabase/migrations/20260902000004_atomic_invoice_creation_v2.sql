-- CALQULUS Phase 10: canonical atomic invoice creation for manual, water and penalty invoices.
CREATE OR REPLACE FUNCTION public.create_invoice_atomic_v2(
  p_generation_key text,
  p_lease_id uuid DEFAULT NULL,
  p_tenant_id uuid,
  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_manager_id uuid,
  p_amount numeric,
  p_description text,
  p_due_date date,
  p_invoice_type text DEFAULT 'rent',
  p_line_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_existing public.invoices%ROWTYPE;
  v_tenant_manager uuid;
  v_property_manager uuid;
  v_lease public.leases%ROWTYPE;
  v_item jsonb;
  v_line_total numeric := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only the invoice service may create invoices' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(trim(p_generation_key), '') IS NULL THEN
    RAISE EXCEPTION 'generation_key is required' USING ERRCODE = '22023';
  END IF;
  IF p_tenant_id IS NULL OR p_manager_id IS NULL THEN
    RAISE EXCEPTION 'Tenant and manager are required' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invoice amount must be positive' USING ERRCODE = '22023';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Invoice due date is required' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(SUM(COALESCE((x->>'amount')::numeric, 0)), 0) INTO v_line_total
  FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS x;
  IF jsonb_array_length(COALESCE(p_line_items, '[]'::jsonb)) > 0 AND round(v_line_total, 2) <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Invoice line items do not equal invoice total' USING ERRCODE = '22023';
  END IF;

  SELECT manager_id INTO v_tenant_manager FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;
  IF v_tenant_manager IS NULL OR v_tenant_manager <> p_manager_id THEN
    RAISE EXCEPTION 'Tenant does not belong to manager' USING ERRCODE = '42501';
  END IF;
  IF p_property_id IS NOT NULL THEN
    SELECT manager_id INTO v_property_manager FROM public.properties WHERE id = p_property_id FOR UPDATE;
    IF v_property_manager IS NULL OR v_property_manager <> p_manager_id THEN
      RAISE EXCEPTION 'Property does not belong to manager' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF p_lease_id IS NOT NULL THEN
    SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id AND tenant_id = p_tenant_id AND manager_id = p_manager_id
      AND (p_property_id IS NULL OR property_id = p_property_id) AND (p_unit_id IS NULL OR unit_id = p_unit_id) FOR UPDATE;
    IF v_lease.id IS NULL THEN
      RAISE EXCEPTION 'Lease does not belong to supplied tenant, property, unit and manager' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.invoices (invoice_number, lease_id, tenant_id, unit_id, property_id, manager_id, amount, original_amount, balance_due, paid_amount, description, due_date, status, generation_key, invoice_type)
  VALUES ('', p_lease_id, p_tenant_id, p_unit_id, p_property_id, p_manager_id, round(p_amount,2), round(p_amount,2), round(p_amount,2), 0, p_description, p_due_date, 'pending', p_generation_key, p_invoice_type)
  ON CONFLICT (generation_key) WHERE generation_key IS NOT NULL DO NOTHING
  RETURNING * INTO v_invoice;

  IF v_invoice.id IS NULL THEN
    SELECT * INTO v_existing FROM public.invoices WHERE generation_key = p_generation_key FOR UPDATE;
    IF v_existing.id IS NULL THEN RAISE EXCEPTION 'Invoice idempotency conflict could not be resolved' USING ERRCODE = '40001'; END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'invoice_number', v_existing.invoice_number, 'created', false);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) LOOP
    INSERT INTO public.invoice_line_items (invoice_id, unit_charge_id, charge_type, charge_label, quantity, unit_price, amount, is_manual)
    VALUES (v_invoice.id, NULLIF(v_item->>'unit_charge_id','')::uuid, COALESCE(v_item->>'charge_type','other'), COALESCE(v_item->>'charge_label','Charge'), COALESCE((v_item->>'quantity')::numeric,1), COALESCE((v_item->>'unit_price')::numeric,0), COALESCE((v_item->>'amount')::numeric,0), COALESCE((v_item->>'is_manual')::boolean,false));
  END LOOP;
  RETURN jsonb_build_object('id', v_invoice.id, 'invoice_number', v_invoice.invoice_number, 'created', true);
END;
$$;
REVOKE ALL ON FUNCTION public.create_invoice_atomic_v2(text, uuid, uuid, uuid, uuid, uuid, numeric, text, date, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic_v2(text, uuid, uuid, uuid, uuid, uuid, numeric, text, date, text, jsonb) TO service_role;
