-- CALQULUS PMS — Complete payment receipt lifecycle for digital/bulk payments.
-- Keeps legacy payment_receipts (uploaded proofs) separate from issued receipts.

CREATE TABLE IF NOT EXISTS public.issued_payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  receipt_number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  payer_party_id uuid REFERENCES public.payment_parties(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issued_payment_receipts_payer_idx ON public.issued_payment_receipts(payer_party_id);

-- Make receipt access work for the actual tenant auth user, not tenant-row UUID assumptions.
DROP POLICY IF EXISTS issued_receipts_recipient_read ON public.issued_payment_receipts;
CREATE POLICY issued_receipts_recipient_read ON public.issued_payment_receipts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.payment_receipt_recipients pr WHERE pr.receipt_id=issued_payment_receipts.id AND pr.recipient_user_id=auth.uid())
);
ALTER TABLE public.issued_payment_receipts ENABLE ROW LEVEL SECURITY;

-- Secure payer profiles and unit links while allowing managers to administer their portfolio.
DROP POLICY IF EXISTS payment_parties_owner_read ON public.payment_parties;
CREATE POLICY payment_parties_owner_read ON public.payment_parties FOR SELECT USING (
  user_id=auth.uid() OR manager_id=auth.uid() OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=payment_parties.manager_id AND ms.submanager_user_id=auth.uid()
  )
);

-- Resolve the authenticated tenant user behind a tenant profile.
CREATE OR REPLACE FUNCTION public.resolve_tenant_auth_user(p_tenant_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT ur.user_id FROM public.user_roles ur WHERE ur.tenant_id=p_tenant_id AND ur.role='tenant' ORDER BY ur.created_at NULLS LAST LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_auth_user(uuid) TO authenticated,service_role;

-- Issue one canonical receipt after a successful transaction. Safe to call repeatedly.
CREATE OR REPLACE FUNCTION public.issue_payment_receipt_atomic(p_transaction_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  tx public.payment_transactions%ROWTYPE;
  existing public.issued_payment_receipts%ROWTYPE;
  party_id uuid;
  tenant_auth uuid;
  receipt_id uuid;
  receipt_no text;
  first_invoice uuid;
  mgr uuid;
  prop uuid;
BEGIN
  SELECT * INTO tx FROM public.payment_transactions WHERE id=p_transaction_id FOR UPDATE;
  IF tx.id IS NULL THEN RAISE EXCEPTION 'Payment transaction not found' USING ERRCODE='P0002'; END IF;
  IF tx.status <> 'completed' THEN RAISE EXCEPTION 'Only completed payments can receive an issued receipt' USING ERRCODE='22023'; END IF;

  SELECT * INTO existing FROM public.issued_payment_receipts WHERE transaction_id=tx.id;
  IF existing.id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'idempotent',true,'receipt_id',existing.id,'receipt_number',existing.receipt_number); END IF;

  party_id := tx.payer_party_id;
  IF party_id IS NULL AND tx.tenant_id IS NOT NULL THEN
    SELECT id INTO party_id FROM public.payment_parties WHERE party_type='tenant' AND user_id=public.resolve_tenant_auth_user(tx.tenant_id) ORDER BY created_at LIMIT 1;
    IF party_id IS NULL THEN
      INSERT INTO public.payment_parties(party_type,display_name,phone,user_id,manager_id)
      SELECT 'tenant',COALESCE(t.name,'Tenant'),t.phone,public.resolve_tenant_auth_user(t.id),COALESCE(t.manager_id,tx.manager_id)
      FROM public.tenants t WHERE t.id=tx.tenant_id
      RETURNING id INTO party_id;
    END IF;
    UPDATE public.payment_transactions SET payer_party_id=party_id WHERE id=tx.id;
  END IF;

  receipt_no := 'RCP-'||to_char(COALESCE(tx.completed_at,now()),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  INSERT INTO public.issued_payment_receipts(transaction_id,receipt_number,payer_party_id,total_amount)
  VALUES(tx.id,receipt_no,party_id,tx.amount) RETURNING id INTO receipt_id;

  INSERT INTO public.payment_receipt_recipients(receipt_id,recipient_type,recipient_user_id,delivery_channel)
  SELECT receipt_id,'payer',pp.user_id,'in_app' FROM public.payment_parties pp WHERE pp.id=party_id AND pp.user_id IS NOT NULL ON CONFLICT DO NOTHING;

  INSERT INTO public.payment_receipt_recipients(receipt_id,recipient_type,recipient_user_id,delivery_channel)
  SELECT receipt_id,'tenant',public.resolve_tenant_auth_user(i.tenant_id),'in_app'
  FROM public.payment_allocations pa JOIN public.invoices i ON i.id=pa.invoice_id
  WHERE pa.transaction_id=tx.id AND public.resolve_tenant_auth_user(i.tenant_id) IS NOT NULL
  GROUP BY i.tenant_id ON CONFLICT DO NOTHING;

  INSERT INTO public.payment_receipt_recipients(receipt_id,recipient_type,recipient_user_id,delivery_channel)
  SELECT DISTINCT receipt_id,'landlord',pl.landlord_user_id,'in_app'
  FROM public.payment_allocations pa JOIN public.property_landlords pl ON pl.property_id=pa.property_id
  WHERE pa.transaction_id=tx.id ON CONFLICT DO NOTHING;

  SELECT manager_id INTO mgr FROM public.payment_transactions WHERE id=tx.id;
  IF mgr IS NOT NULL THEN INSERT INTO public.payment_receipt_recipients(receipt_id,recipient_type,recipient_user_id,delivery_channel) VALUES(receipt_id,'manager',mgr,'in_app') ON CONFLICT DO NOTHING; END IF;

  PERFORM public.notify_payment_receipt_recipients_atomic(receipt_id);
  UPDATE public.issued_payment_receipts SET delivery_status='sent' WHERE id=receipt_id;

  RETURN jsonb_build_object('success',true,'receipt_id',receipt_id,'receipt_number',receipt_no);
END $$;
GRANT EXECUTE ON FUNCTION public.issue_payment_receipt_atomic(uuid) TO authenticated,service_role;

-- Complete payer-facing receipt data with unit-first allocations.
CREATE OR REPLACE FUNCTION public.get_payment_receipt(p_receipt_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'receipt',to_jsonb(r),
    'payer',to_jsonb(pp),
    'transaction',to_jsonb(pt),
    'allocations',COALESCE((SELECT jsonb_agg(jsonb_build_object('invoice_id',pa.invoice_id,'amount',pa.allocated_amount,'unit_id',pa.unit_id,'property_id',pa.property_id,'invoice_number',i.invoice_number,'unit_number',u.unit_number,'property_name',p.name,'tenant_id',i.tenant_id)) FROM public.payment_allocations pa JOIN public.invoices i ON i.id=pa.invoice_id LEFT JOIN public.units u ON u.id=pa.unit_id LEFT JOIN public.properties p ON p.id=pa.property_id WHERE pa.transaction_id=r.transaction_id),'[]'::jsonb)
  ) FROM public.issued_payment_receipts r LEFT JOIN public.payment_parties pp ON pp.id=r.payer_party_id JOIN public.payment_transactions pt ON pt.id=r.transaction_id
  WHERE r.id=p_receipt_id AND EXISTS (SELECT 1 FROM public.payment_receipt_recipients pr WHERE pr.receipt_id=r.id AND pr.recipient_user_id=auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.get_payment_receipt(uuid) TO authenticated,service_role;

-- Let managers/submanagers read issued receipts for their portfolio as well as recipients.
DROP POLICY IF EXISTS issued_receipts_manager_read ON public.issued_payment_receipts;
CREATE POLICY issued_receipts_manager_read ON public.issued_payment_receipts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.payment_transactions pt
    WHERE pt.id=issued_payment_receipts.transaction_id
      AND (pt.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=pt.manager_id AND ms.submanager_user_id=auth.uid()))
  )
);

-- Ensure payment receipt notifications use real auth users for tenant recipients.
CREATE OR REPLACE FUNCTION public.notify_payment_receipt_recipients_atomic(p_receipt_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.in_app_notifications(user_id,manager_id,title,body,type,action_url,action_label,reference_id,reference_type,source)
  SELECT pr.recipient_user_id,pt.manager_id,
    CASE pr.recipient_type WHEN 'payer' THEN 'Payment receipt' WHEN 'landlord' THEN 'Payment received for your property' WHEN 'manager' THEN 'Payment received' WHEN 'agency' THEN 'Payment received' ELSE 'Payment recorded for your unit' END,
    'Receipt '||r.receipt_number||' — '||to_char(r.total_amount,'FM999,999,990.00')||' received. Open the receipt to see the unit-by-unit allocation.',
    'payment','/billing/receipts','View receipt',r.id,'issued_payment_receipt','payment_engine'
  FROM public.payment_receipt_recipients pr JOIN public.issued_payment_receipts r ON r.id=pr.receipt_id JOIN public.payment_transactions pt ON pt.id=r.transaction_id
  WHERE pr.receipt_id=p_receipt_id AND pr.recipient_user_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.notify_payment_receipt_recipients_atomic(uuid) TO service_role;

-- Tenant prompts must target the tenant's auth account through user_roles.
CREATE OR REPLACE FUNCTION public.send_tenant_payment_prompts_atomic(p_as_of date DEFAULT CURRENT_DATE)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i record; a record; v_count integer:=0; v_user uuid; v_title text; v_type text; v_body text;
BEGIN
  IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Only the billing service may send payment prompts' USING ERRCODE='42501'; END IF;
  FOR i IN SELECT * FROM public.invoices WHERE status IN ('pending','partially_paid','overdue') AND COALESCE(balance_due,amount)>0 AND due_date<=p_as_of LOOP
    v_user:=public.resolve_tenant_auth_user(i.tenant_id);
    IF v_user IS NULL THEN CONTINUE; END IF;
    SELECT * INTO a FROM public.get_invoice_payment_instructions(i.id);
    IF i.status='overdue' OR COALESCE(i.overdue_date,i.due_date)<p_as_of THEN v_title:='Rent payment overdue'; v_type:='alert'; ELSE v_title:=CASE WHEN i.due_date=p_as_of THEN 'Rent payment due today' ELSE 'Rent payment reminder' END; v_type:='payment'; END IF;
    v_body:=format('Invoice %s: KES %s is due on %s. ',i.invoice_number,to_char(COALESCE(i.balance_due,i.amount),'FM999G999G990D00'),to_char(i.due_date,'DD Mon YYYY'));
    IF a.account_id IS NOT NULL THEN
      v_body:=v_body||CASE a.payment_method WHEN 'mpesa_till' THEN format('Pay via M-Pesa Till %s.',a.till_number) WHEN 'mpesa_paybill' THEN format('Pay via M-Pesa Paybill %s.',a.paybill_number) WHEN 'bank_transfer' THEN format('Bank: %s, Account: %s (%s).',a.bank_name,a.bank_account_number,coalesce(a.bank_account_name,'')) ELSE 'Use the payment instructions shown in your tenant portal.' END;
      IF a.payment_instructions IS NOT NULL THEN v_body:=v_body||' '||a.payment_instructions; END IF;
    ELSE v_body:=v_body||'No payment destination is configured yet; please contact your property manager.'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.in_app_notifications n WHERE n.user_id=v_user AND n.reference_id=i.id AND n.reference_type='invoice_payment_prompt' AND n.created_at::date=p_as_of) THEN
      INSERT INTO public.in_app_notifications(user_id,manager_id,title,body,type,action_url,action_label,reference_id,reference_type,priority,source)
      VALUES(v_user,i.manager_id,v_title,v_body,v_type,'/portal/invoices/'||i.id::text,'View & Pay',i.id,'invoice_payment_prompt',CASE WHEN i.status='overdue' THEN 'high' ELSE 'normal' END,'payment_engine');
      v_count:=v_count+1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.send_tenant_payment_prompts_atomic(date) TO service_role;


-- Final effective billing hierarchy: tenancy -> property+landlord -> property -> landlord -> manager.
CREATE OR REPLACE FUNCTION public.get_effective_billing_due_config(p_lease_id uuid)
RETURNS TABLE(due_day_of_month integer, overdue_after_days integer, reminder_before_days integer, overdue_reminder_interval_days integer, source_type text, source_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT c.due_day_of_month,c.overdue_after_days,c.reminder_before_days,c.overdue_reminder_interval_days,
    CASE WHEN c.lease_id IS NOT NULL THEN 'tenancy' WHEN c.property_id IS NOT NULL AND c.landlord_user_id IS NOT NULL THEN 'property_landlord' WHEN c.property_id IS NOT NULL THEN 'property' WHEN c.landlord_user_id IS NOT NULL THEN 'landlord' ELSE 'manager' END,c.id
  FROM (
    SELECT c.*,1 AS rank FROM public.billing_due_configurations c WHERE c.lease_id=p_lease_id AND c.is_active
    UNION ALL
    SELECT c.*,2 FROM public.billing_due_configurations c JOIN public.leases l ON l.id=p_lease_id WHERE c.property_id=l.property_id AND c.landlord_user_id=l.billing_landlord_user_id AND c.is_active AND c.lease_id IS NULL
    UNION ALL
    SELECT c.*,3 FROM public.billing_due_configurations c JOIN public.leases l ON l.id=p_lease_id WHERE c.property_id=l.property_id AND c.landlord_user_id IS NULL AND c.is_active AND c.lease_id IS NULL
    UNION ALL
    SELECT c.*,4 FROM public.billing_due_configurations c JOIN public.leases l ON l.id=p_lease_id WHERE c.landlord_user_id=l.billing_landlord_user_id AND c.property_id IS NULL AND c.is_active
    UNION ALL
    SELECT c.*,5 FROM public.billing_due_configurations c JOIN public.leases l ON l.id=p_lease_id WHERE c.manager_user_id=l.manager_id AND c.property_id IS NULL AND c.landlord_user_id IS NULL AND c.lease_id IS NULL AND c.is_active
  ) c ORDER BY c.rank LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_effective_billing_due_config(uuid) TO authenticated,service_role;

-- Combined STK completion uses the same canonical payment engine, which issues the
-- receipt and preserves the unit-by-unit allocations after Safaricom confirmation.
COMMENT ON FUNCTION public.issue_payment_receipt_atomic(uuid) IS 'Creates one idempotent payer receipt with unit/invoice allocation and recipient notifications for a completed payment.';
