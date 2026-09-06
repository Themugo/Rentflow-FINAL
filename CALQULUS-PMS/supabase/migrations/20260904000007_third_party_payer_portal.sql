-- CALQULUS PMS — third-party payer portal and consolidated payer collections
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'payer';

CREATE OR REPLACE FUNCTION public.get_my_payer_portal()
RETURNS TABLE(payer_party_id uuid, party_type text, display_name text, email text, phone text, organisation_name text, reference_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT pp.id,pp.party_type,pp.display_name,pp.email,pp.phone,pp.organisation_name,pp.reference_code
  FROM public.payment_parties pp WHERE pp.user_id=auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_payer_portal() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_payer_obligations()
RETURNS TABLE(invoice_id uuid, invoice_number text, property_id uuid, property_name text, unit_id uuid, unit_number text, tenant_id uuid, due_date date, invoice_amount numeric, paid_amount numeric, balance_due numeric, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT i.id,i.invoice_number,p.id,p.name,u.id,u.unit_number,i.tenant_id,i.due_date,
    i.amount,COALESCE(i.paid_amount,0),GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0),i.status
  FROM public.payment_parties pp
  JOIN public.payer_unit_links pul ON pul.payer_party_id=pp.id AND pul.is_active
  JOIN public.units u ON u.id=pul.unit_id
  JOIN public.properties p ON p.id=u.property_id
  JOIN public.invoices i ON COALESCE(i.unit_id,(SELECT l.unit_id FROM public.leases l WHERE l.id=i.lease_id))=u.id
  WHERE pp.user_id=auth.uid() AND i.status IN ('pending','overdue','partially_paid')
  ORDER BY i.due_date NULLS LAST,p.name,u.unit_number,i.invoice_number;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_payer_obligations() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_payer_receipts()
RETURNS TABLE(receipt_id uuid, receipt_number text, issued_at timestamptz, total_amount numeric, delivery_status text, transaction_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT r.id,r.receipt_number,r.issued_at,r.total_amount,r.delivery_status,r.transaction_id
  FROM public.issued_payment_receipts r
  JOIN public.payment_parties pp ON pp.id=r.payer_party_id
  WHERE pp.user_id=auth.uid() ORDER BY r.issued_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_payer_receipts() TO authenticated;

-- Managers can bind an already-registered payer account by email without exposing auth.users to clients.
CREATE OR REPLACE FUNCTION public.assign_payer_account_atomic(p_payer_party_id uuid,p_email text)
RETURNS public.payment_parties
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.payment_parties%ROWTYPE; v_user uuid; v_manager uuid;
BEGIN
  SELECT * INTO v FROM public.payment_parties WHERE id=p_payer_party_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Payer not found' USING ERRCODE='P0002'; END IF;
  v_manager:=v.manager_id;
  IF auth.uid()<>v_manager AND NOT EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Payer account assignment unauthorized' USING ERRCODE='42501';
  END IF;
  SELECT id INTO v_user FROM auth.users WHERE lower(email)=lower(trim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'No registered account matches that email' USING ERRCODE='P0002'; END IF;
  UPDATE public.payment_parties SET user_id=v_user,email=trim(p_email),updated_at=now() WHERE id=v.id RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.assign_payer_account_atomic(uuid,text) TO authenticated;

-- Self-service payer profile for a newly registered payer account.
CREATE OR REPLACE FUNCTION public.ensure_my_payer_party_atomic(
  p_party_type text DEFAULT 'other', p_display_name text DEFAULT NULL, p_phone text DEFAULT NULL, p_organisation_name text DEFAULT NULL
)
RETURNS public.payment_parties
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.payment_parties%ROWTYPE; v_email text; v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_party_type NOT IN ('employer','family_member','company','institution','sponsor','well_wisher','landlord','other') THEN RAISE EXCEPTION 'Invalid payer type' USING ERRCODE='22023'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=auth.uid();
  SELECT * INTO v FROM public.payment_parties WHERE user_id=auth.uid() ORDER BY created_at LIMIT 1;
  IF v.id IS NOT NULL THEN RETURN v; END IF;
  v_name:=NULLIF(trim(p_display_name),'');
  IF v_name IS NULL THEN v_name:=COALESCE(v_email,'Payer'); END IF;
  INSERT INTO public.payment_parties(party_type,display_name,phone,organisation_name,email,user_id)
  VALUES(p_party_type,v_name,p_phone,p_organisation_name,v_email,auth.uid()) RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_my_payer_party_atomic(text,text,text,text) TO authenticated;

COMMENT ON FUNCTION public.get_my_payer_obligations() IS 'Payer-centric obligations across every unit explicitly linked to the payer.';

CREATE OR REPLACE FUNCTION public.backfill_payment_allocation_payer_atomic(p_transaction_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.payment_allocations pa
  SET payer_party_id=pt.payer_party_id,
      unit_id=COALESCE(pa.unit_id,pt.unit_id),
      property_id=COALESCE(pa.property_id,pt.property_id)
  FROM public.payment_transactions pt
  WHERE pt.id=p_transaction_id AND pa.transaction_id=pt.id AND pa.payer_party_id IS NULL AND pt.payer_party_id IS NOT NULL;
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.backfill_payment_allocation_payer_atomic(uuid) TO service_role;
