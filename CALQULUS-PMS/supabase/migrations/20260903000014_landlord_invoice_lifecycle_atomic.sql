-- CALQULUS Phase 31: landlord invoice lifecycle atomicity.
-- Webhost billing writes are centralized in SECURITY DEFINER RPCs with row locks and state guards.
CREATE OR REPLACE FUNCTION public.create_landlord_invoice_atomic(
  p_landlord_user_id uuid,
  p_amount numeric,
  p_invoice_type text DEFAULT 'portal_access',
  p_description text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_manager_user_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv_id uuid; inv_no text; effective_due date := COALESCE(p_due_date, CURRENT_DATE + 14); landlord_exists boolean;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF auth.role()<>'service_role' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='webhost') THEN RAISE EXCEPTION 'Webhost access required' USING ERRCODE='42501'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive' USING ERRCODE='22023'; END IF;
  IF p_invoice_type NOT IN ('portal_access','property_listing','document_storage','premium_reports','one_time','annual_membership') THEN RAISE EXCEPTION 'Invalid invoice type' USING ERRCODE='22023'; END IF;
  IF effective_due IS NULL THEN RAISE EXCEPTION 'Due date is required' USING ERRCODE='22023'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_landlord_user_id AND role='landlord') INTO landlord_exists;
  IF NOT landlord_exists THEN RAISE EXCEPTION 'Target user is not a landlord' USING ERRCODE='42501'; END IF;
  IF p_manager_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_manager_user_id AND role IN ('manager','submanager')) THEN RAISE EXCEPTION 'Invalid manager' USING ERRCODE='22023'; END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND (p_manager_user_id IS NULL OR manager_id=p_manager_user_id)) THEN RAISE EXCEPTION 'Property does not belong to manager' USING ERRCODE='42501'; END IF;
  inv_no := 'LAND-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO public.landlord_invoices(landlord_user_id,webhost_user_id,invoice_number,invoice_type,amount,description,due_date,status,manager_user_id,property_id,period_start,period_end)
  VALUES(p_landlord_user_id,CASE WHEN auth.role()='service_role' THEN NULL ELSE auth.uid() END,inv_no,p_invoice_type,round(p_amount,2),nullif(trim(p_description),''),effective_due,'pending',p_manager_user_id,p_property_id,p_period_start,p_period_end)
  RETURNING id INTO inv_id;
  RETURN jsonb_build_object('success',true,'invoice_id',inv_id,'invoice_number',inv_no,'status','pending');
END; $$;

CREATE OR REPLACE FUNCTION public.transition_landlord_invoice_atomic(
  p_invoice_id uuid,
  p_target_status text,
  p_payment_method text DEFAULT NULL,
  p_payment_reference text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv public.landlord_invoices%ROWTYPE;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF auth.role()<>'service_role' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='webhost') THEN RAISE EXCEPTION 'Webhost access required' USING ERRCODE='42501'; END IF;
  SELECT * INTO inv FROM public.landlord_invoices WHERE id=p_invoice_id FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='P0002'; END IF;
  IF p_target_status NOT IN ('paid','waived','cancelled','overdue','pending') THEN RAISE EXCEPTION 'Invalid target status' USING ERRCODE='22023'; END IF;
  IF inv.status='paid' AND p_target_status<>'paid' THEN RAISE EXCEPTION 'Paid invoices are terminal' USING ERRCODE='55000'; END IF;
  IF inv.status='waived' AND p_target_status<>'waived' THEN RAISE EXCEPTION 'Waived invoices are terminal' USING ERRCODE='55000'; END IF;
  IF inv.status='cancelled' AND p_target_status<>'cancelled' THEN RAISE EXCEPTION 'Cancelled invoices are terminal' USING ERRCODE='55000'; END IF;
  IF p_target_status='paid' THEN
    IF inv.status='paid' THEN RETURN jsonb_build_object('success',true,'idempotent',true,'invoice_id',inv.id,'status','paid'); END IF;
    IF inv.status NOT IN ('pending','overdue') THEN RAISE EXCEPTION 'Only pending or overdue invoices can be paid' USING ERRCODE='55000'; END IF;
    IF nullif(trim(p_payment_reference),'') IS NULL THEN RAISE EXCEPTION 'Payment reference is required' USING ERRCODE='22023'; END IF;
    UPDATE public.landlord_invoices SET status='paid',paid_date=CURRENT_DATE,payment_method=nullif(trim(p_payment_method),''),payment_reference=nullif(trim(p_payment_reference),'') WHERE id=inv.id;
  ELSIF p_target_status='waived' THEN
    IF inv.status NOT IN ('pending','overdue') THEN RAISE EXCEPTION 'Only pending or overdue invoices can be waived' USING ERRCODE='55000'; END IF;
    UPDATE public.landlord_invoices SET status='waived' WHERE id=inv.id;
  ELSIF p_target_status='cancelled' THEN
    IF inv.status NOT IN ('pending','overdue') THEN RAISE EXCEPTION 'Only pending or overdue invoices can be cancelled' USING ERRCODE='55000'; END IF;
    UPDATE public.landlord_invoices SET status='cancelled' WHERE id=inv.id;
  ELSE
    IF inv.status NOT IN ('pending','overdue') THEN RAISE EXCEPTION 'Only pending or overdue invoices can change to pending/overdue' USING ERRCODE='55000'; END IF;
    UPDATE public.landlord_invoices SET status=p_target_status WHERE id=inv.id;
  END IF;
  RETURN jsonb_build_object('success',true,'idempotent',false,'invoice_id',inv.id,'status',p_target_status);
END; $$;

REVOKE ALL ON FUNCTION public.create_landlord_invoice_atomic(uuid,numeric,text,text,date,uuid,uuid,date,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.transition_landlord_invoice_atomic(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_landlord_invoice_atomic(uuid,numeric,text,text,date,uuid,uuid,date,date) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_landlord_invoice_atomic(uuid,text,text,text) TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE ON public.landlord_invoices FROM authenticated;
