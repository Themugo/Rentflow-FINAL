-- CALQULUS PMS — Phase 17: platform invoice management atomicity
-- Webhost-issued manager invoices and manual settlement must not use direct
-- table writes. All financial state changes are authorized and transactional.

CREATE OR REPLACE FUNCTION public.create_manager_invoice_atomic(
  p_manager_user_id uuid,
  p_amount numeric,
  p_due_date date,
  p_description text DEFAULT NULL,
  p_invoice_type text DEFAULT 'other',
  p_invoice_number text DEFAULT NULL,
  p_property_count integer DEFAULT NULL,
  p_rate_per_property numeric DEFAULT NULL,
  p_net_collection numeric DEFAULT NULL,
  p_commission_rate numeric DEFAULT NULL,
  p_subscription_tier text DEFAULT NULL,
  p_billing_period_start date DEFAULT NULL,
  p_billing_period_end date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_number text; v_status text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('webhost','platform_admin')
  ) THEN RAISE EXCEPTION 'Unauthorized platform invoice creation' USING ERRCODE='42501'; END IF;
  IF p_manager_user_id IS NULL OR p_amount <= 0 OR p_due_date IS NULL THEN
    RAISE EXCEPTION 'Invalid manager invoice parameters' USING ERRCODE='22023';
  END IF;
  IF p_invoice_type NOT IN ('registration','subscription','penalty','other') THEN
    RAISE EXCEPTION 'Invalid platform invoice type' USING ERRCODE='22023';
  END IF;
  IF p_invoice_number IS NULL OR btrim(p_invoice_number) = '' THEN
    v_number := 'PLAT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  ELSE v_number := btrim(p_invoice_number); END IF;
  IF EXISTS (SELECT 1 FROM public.manager_invoices WHERE invoice_number = v_number) THEN
    RAISE EXCEPTION 'Platform invoice number already exists' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.manager_invoices (
    manager_user_id, invoice_number, amount, description, due_date, status,
    invoice_type, property_count, rate_per_property, net_collection,
    commission_rate, subscription_tier, billing_period_start, billing_period_end
  ) VALUES (
    p_manager_user_id, v_number, round(p_amount,2), p_description, p_due_date, 'pending',
    p_invoice_type, p_property_count, p_rate_per_property, p_net_collection,
    p_commission_rate, p_subscription_tier, p_billing_period_start, p_billing_period_end
  ) RETURNING id, status INTO v_id, v_status;
  RETURN jsonb_build_object('success',true,'idempotent',false,'invoice_id',v_id,'invoice_number',v_number,'status',v_status);
END; $$;

CREATE OR REPLACE FUNCTION public.record_platform_invoice_payment_atomic(
  p_manager_invoice_id uuid,
  p_manager_user_id uuid,
  p_amount numeric,
  p_reference text,
  p_payment_method text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invoice record; v_existing record; v_tx_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('webhost','platform_admin')
  ) THEN RAISE EXCEPTION 'Unauthorized platform invoice settlement' USING ERRCODE='42501'; END IF;
  IF p_amount <= 0 OR p_reference IS NULL OR btrim(p_reference) = '' THEN
    RAISE EXCEPTION 'Invalid platform payment amount or reference' USING ERRCODE='22023';
  END IF;
  SELECT id, manager_user_id, amount, status INTO v_invoice
  FROM public.manager_invoices WHERE id=p_manager_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL OR v_invoice.manager_user_id IS DISTINCT FROM p_manager_user_id THEN
    RAISE EXCEPTION 'Platform invoice ownership mismatch' USING ERRCODE='42501';
  END IF;
  IF round(v_invoice.amount,2) <> round(p_amount,2) THEN RAISE EXCEPTION 'Payment amount does not match invoice' USING ERRCODE='22003'; END IF;
  IF v_invoice.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled platform invoice cannot be paid' USING ERRCODE='55000'; END IF;
  SELECT id, manager_invoice_id, manager_user_id, amount, status INTO v_existing
  FROM public.platform_payment_transactions WHERE reference=p_reference FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.manager_invoice_id IS DISTINCT FROM p_manager_invoice_id OR v_existing.manager_user_id IS DISTINCT FROM p_manager_user_id OR round(v_existing.amount,2) <> round(p_amount,2) THEN
      RAISE EXCEPTION 'Platform payment reference collision' USING ERRCODE='23505';
    END IF;
    IF v_existing.status = 'success' AND v_invoice.status <> 'paid' THEN
      UPDATE public.manager_invoices SET status='paid', paid_date=COALESCE(paid_date,CURRENT_DATE), updated_at=now() WHERE id=v_invoice.id;
    END IF;
    RETURN jsonb_build_object('success',true,'idempotent',true,'transaction_id',v_existing.id,'status','success');
  END IF;
  INSERT INTO public.platform_payment_transactions (
    manager_invoice_id, manager_user_id, provider, payment_method, reference,
    amount, currency, status, metadata, completed_at
  ) VALUES (
    p_manager_invoice_id, p_manager_user_id, 'internal', p_payment_method, btrim(p_reference),
    round(p_amount,2), 'KES', 'success', jsonb_build_object('source','webhost_manual'), now()
  ) RETURNING id INTO v_tx_id;
  UPDATE public.manager_invoices
  SET status='paid', paid_date=COALESCE(paid_date,CURRENT_DATE), updated_at=now()
  WHERE id=v_invoice.id;
  PERFORM public.reinstate_manager_on_payment(v_invoice.id);
  RETURN jsonb_build_object('success',true,'idempotent',false,'transaction_id',v_tx_id,'status','success');
END; $$;

REVOKE ALL ON FUNCTION public.create_manager_invoice_atomic(uuid,numeric,date,text,text,text,integer,numeric,numeric,numeric,text,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_manager_invoice_atomic(uuid,numeric,date,text,text,text,integer,numeric,numeric,numeric,text,date,date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_platform_invoice_payment_atomic(uuid,uuid,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_platform_invoice_payment_atomic(uuid,uuid,numeric,text,text) TO authenticated, service_role;
