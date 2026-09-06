-- CALQULUS PMS — Phases 49–50
-- The physical invoice UI has always supported sending a digital copy; make that
-- state explicit on the invoice table before the protected transition RPC uses it.
ALTER TABLE public.physical_invoices
  ADD COLUMN IF NOT EXISTS digital_receipt_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digital_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_via text;

-- Payment capture, physical receivables and tenant payment-detail convergence.
-- All authenticated financial mutations now cross an explicit RPC boundary.

CREATE OR REPLACE FUNCTION public.save_tenant_payment_details_atomic(
  p_tenant_id uuid,
  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_monthly_rent numeric DEFAULT NULL,
  p_house_deposit numeric DEFAULT NULL,
  p_water_deposit numeric DEFAULT NULL,
  p_other_charges numeric DEFAULT NULL,
  p_other_charges_desc text DEFAULT NULL,
  p_payment_day integer DEFAULT 1,
  p_paybill text DEFAULT NULL,
  p_till text DEFAULT NULL,
  p_account_ref text DEFAULT NULL,
  p_tenancy_type text DEFAULT 'standard',
  p_grace_period_days integer DEFAULT 0,
  p_payment_method text DEFAULT 'mpesa'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_existing public.tenant_payment_details%ROWTYPE;
  v_is_authorized boolean := false;
BEGIN
  IF auth.role() NOT IN ('authenticated','service_role') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;
  IF v_tenant.id IS NULL THEN RAISE EXCEPTION 'Tenant not found' USING ERRCODE='P0002'; END IF;

  IF auth.role() = 'service_role' THEN
    v_is_authorized := true;
  ELSE
    v_is_authorized := v_tenant.manager_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = v_tenant.manager_id AND ms.submanager_user_id = auth.uid());
  END IF;
  IF NOT v_is_authorized THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;

  IF p_payment_day NOT BETWEEN 1 AND 28 THEN RAISE EXCEPTION 'Payment day must be between 1 and 28' USING ERRCODE='22023'; END IF;
  IF p_grace_period_days < 0 OR p_grace_period_days > 90 THEN RAISE EXCEPTION 'Invalid grace period' USING ERRCODE='22023'; END IF;
  IF p_monthly_rent IS NOT NULL AND p_monthly_rent < 0 THEN RAISE EXCEPTION 'Invalid monthly rent' USING ERRCODE='22023'; END IF;
  IF p_house_deposit IS NOT NULL AND p_house_deposit < 0 THEN RAISE EXCEPTION 'Invalid house deposit' USING ERRCODE='22023'; END IF;
  IF p_water_deposit IS NOT NULL AND p_water_deposit < 0 THEN RAISE EXCEPTION 'Invalid water deposit' USING ERRCODE='22023'; END IF;
  IF p_other_charges IS NOT NULL AND p_other_charges < 0 THEN RAISE EXCEPTION 'Invalid other charges' USING ERRCODE='22023'; END IF;

  INSERT INTO public.tenant_payment_details (
    tenant_id, manager_id, property_id, unit_id, monthly_rent, house_deposit,
    water_deposit, other_charges, other_charges_desc, deposit_balance,
    payment_day, grace_period_days, payment_method, paybill_number, till_number,
    account_reference, tenancy_type
  ) VALUES (
    p_tenant_id, v_tenant.manager_id, COALESCE(p_property_id,v_tenant.property_id),
    COALESCE(p_unit_id,v_tenant.unit_id), p_monthly_rent, p_house_deposit,
    p_water_deposit, p_other_charges, p_other_charges_desc,
    COALESCE(p_house_deposit,0) + COALESCE(p_water_deposit,0),
    p_payment_day, p_grace_period_days, COALESCE(NULLIF(p_payment_method,''),'mpesa'),
    p_paybill, p_till, p_account_ref, COALESCE(NULLIF(p_tenancy_type,''),'standard')
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    manager_id = EXCLUDED.manager_id,
    property_id = EXCLUDED.property_id,
    unit_id = EXCLUDED.unit_id,
    monthly_rent = COALESCE(EXCLUDED.monthly_rent, tenant_payment_details.monthly_rent),
    house_deposit = COALESCE(EXCLUDED.house_deposit, tenant_payment_details.house_deposit),
    water_deposit = COALESCE(EXCLUDED.water_deposit, tenant_payment_details.water_deposit),
    other_charges = COALESCE(EXCLUDED.other_charges, tenant_payment_details.other_charges),
    other_charges_desc = COALESCE(EXCLUDED.other_charges_desc, tenant_payment_details.other_charges_desc),
    deposit_balance = CASE WHEN EXCLUDED.house_deposit IS NOT NULL OR EXCLUDED.water_deposit IS NOT NULL
      THEN COALESCE(EXCLUDED.house_deposit, tenant_payment_details.house_deposit,0) + COALESCE(EXCLUDED.water_deposit, tenant_payment_details.water_deposit,0)
      ELSE tenant_payment_details.deposit_balance END,
    payment_day = EXCLUDED.payment_day,
    grace_period_days = EXCLUDED.grace_period_days,
    payment_method = EXCLUDED.payment_method,
    paybill_number = COALESCE(EXCLUDED.paybill_number, tenant_payment_details.paybill_number),
    till_number = COALESCE(EXCLUDED.till_number, tenant_payment_details.till_number),
    account_reference = COALESCE(EXCLUDED.account_reference, tenant_payment_details.account_reference),
    tenancy_type = EXCLUDED.tenancy_type,
    updated_at = now();

  SELECT * INTO v_existing FROM public.tenant_payment_details WHERE tenant_id = p_tenant_id;
  RETURN jsonb_build_object('success',true,'tenant_id',p_tenant_id,'payment_details_id',v_existing.id);
END; $$;

-- Keep the legacy sync entry point only for trusted backend jobs. Authenticated UI
-- callers must use the scoped save RPC above.
REVOKE ALL ON FUNCTION public.sync_tenant_payment_details FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_tenant_payment_details TO service_role;
REVOKE ALL ON FUNCTION public.save_tenant_payment_details_atomic(uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,integer,text,text,text,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tenant_payment_details_atomic(uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,integer,text,text,text,text,integer,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_physical_invoice_atomic(
  p_tenant_id uuid,
  p_invoice_number text,
  p_invoice_date date,
  p_due_date date,
  p_description text,
  p_amount numeric,
  p_tax_amount numeric DEFAULT 0,
  p_line_items jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_document_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant public.tenants%ROWTYPE; v_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_amount <= 0 OR NULLIF(trim(p_invoice_number),'') IS NULL OR NULLIF(trim(p_description),'') IS NULL THEN RAISE EXCEPTION 'Tenant, invoice number, description and positive amount are required' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=p_tenant_id FOR SHARE;
  IF v_tenant.id IS NULL OR NOT (v_tenant.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_tenant.manager_id AND ms.submanager_user_id=auth.uid())) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.physical_invoices WHERE manager_id=v_tenant.manager_id AND invoice_number=p_invoice_number) THEN RAISE EXCEPTION 'Physical invoice number already exists' USING ERRCODE='23505'; END IF;
  INSERT INTO public.physical_invoices(manager_id,tenant_id,unit_id,property_id,invoice_number,invoice_date,due_date,description,amount,tax_amount,total_amount,line_items,notes,document_url,recorded_by)
  VALUES(v_tenant.manager_id,p_tenant_id,v_tenant.unit_id,v_tenant.property_id,p_invoice_number,COALESCE(p_invoice_date,current_date),p_due_date,p_description,round(p_amount,2),round(COALESCE(p_tax_amount,0),2),round(p_amount+COALESCE(p_tax_amount,0),2),p_line_items,p_notes,p_document_url,auth.uid()) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.create_physical_receipt_atomic(
  p_tenant_id uuid,
  p_receipt_number text,
  p_receipt_date date,
  p_amount numeric,
  p_payment_method text,
  p_reference text DEFAULT NULL,
  p_description text DEFAULT 'Rent payment',
  p_received_by text DEFAULT NULL,
  p_line_items jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_document_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tenant public.tenants%ROWTYPE; v_id uuid;
BEGIN
  IF auth.role() <> 'authenticated' OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_amount <= 0 OR NULLIF(trim(p_receipt_number),'') IS NULL THEN RAISE EXCEPTION 'Tenant, receipt number and positive amount are required' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=p_tenant_id FOR SHARE;
  IF v_tenant.id IS NULL OR NOT (v_tenant.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_tenant.manager_id AND ms.submanager_user_id=auth.uid())) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.physical_receipts WHERE manager_id=v_tenant.manager_id AND receipt_number=p_receipt_number) THEN RAISE EXCEPTION 'Physical receipt number already exists' USING ERRCODE='23505'; END IF;
  INSERT INTO public.physical_receipts(manager_id,tenant_id,unit_id,property_id,receipt_number,receipt_date,amount,payment_method,reference,description,received_by,line_items,notes,document_url,recorded_by)
  VALUES(v_tenant.manager_id,p_tenant_id,v_tenant.unit_id,v_tenant.property_id,p_receipt_number,COALESCE(p_receipt_date,current_date),round(p_amount,2),COALESCE(NULLIF(p_payment_method,''),'cash'),NULLIF(p_reference,''),COALESCE(NULLIF(p_description,''),'Rent payment'),p_received_by,p_line_items,p_notes,p_document_url,auth.uid()) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.mark_physical_document_sent_atomic(
  p_document_id uuid,
  p_document_type text,
  p_sent_via text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid; v_rows integer;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_document_type='receipt' THEN
    SELECT manager_id INTO v_manager FROM public.physical_receipts WHERE id=p_document_id FOR UPDATE;
    IF v_manager IS NULL OR v_manager<>auth.uid() AND NOT EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
    UPDATE public.physical_receipts SET digital_receipt_sent=true,digital_sent_at=now(),sent_via=p_sent_via WHERE id=p_document_id;
  ELSIF p_document_type='invoice' THEN
    SELECT manager_id INTO v_manager FROM public.physical_invoices WHERE id=p_document_id FOR UPDATE;
    IF v_manager IS NULL OR v_manager<>auth.uid() AND NOT EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
    UPDATE public.physical_invoices SET digital_receipt_sent=true,digital_sent_at=now(),sent_via=p_sent_via WHERE id=p_document_id;
  ELSE RAISE EXCEPTION 'Invalid document type' USING ERRCODE='22023'; END IF;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('success',v_rows=1,'id',p_document_id);
END; $$;

CREATE OR REPLACE FUNCTION public.link_physical_receipt_payment_atomic(
  p_receipt_id uuid,
  p_invoice_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.physical_receipts%ROWTYPE; t public.tenants%ROWTYPE; pay jsonb;
BEGIN
  IF auth.role() <> 'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.physical_receipts WHERE id=p_receipt_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Physical receipt not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO t FROM public.tenants WHERE id=r.tenant_id FOR UPDATE;
  IF t.id IS NULL OR NOT (r.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=r.manager_id AND ms.submanager_user_id=auth.uid())) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF r.linked_transaction_id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'idempotent',true,'transaction_id',r.linked_transaction_id); END IF;
  pay := public.process_payment_atomic(r.tenant_id,r.manager_id,r.amount,r.payment_method,r.receipt_date,COALESCE(NULLIF(p_reference,''),NULLIF(r.reference,''),r.receipt_number),p_invoice_id,NULL,r.unit_id,r.property_id,NULL,NULL,auth.uid(),'Physical receipt verification',NULL);
  UPDATE public.physical_receipts SET linked_transaction_id=(pay->>'transaction_id')::uuid,linked_invoice_id=p_invoice_id WHERE id=r.id;
  RETURN pay || jsonb_build_object('success',true,'receipt_id',r.id);
END; $$;

REVOKE ALL ON FUNCTION public.create_physical_invoice_atomic(uuid,text,date,date,text,numeric,numeric,jsonb,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_physical_receipt_atomic(uuid,text,date,numeric,text,text,text,text,jsonb,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.mark_physical_document_sent_atomic(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.link_physical_receipt_payment_atomic(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_physical_invoice_atomic(uuid,text,date,date,text,numeric,numeric,jsonb,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_physical_receipt_atomic(uuid,text,date,numeric,text,text,text,text,jsonb,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mark_physical_document_sent_atomic(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.link_physical_receipt_payment_atomic(uuid,uuid,text) TO authenticated,service_role;

REVOKE INSERT,UPDATE,DELETE ON public.physical_invoices FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.physical_receipts FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.tenant_payment_details FROM authenticated;
