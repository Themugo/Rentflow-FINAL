-- CALQULUS PMS — Unit-first obligations, multi-payer payments, bulk allocation & receipts
-- One payment may cover many unit invoices and may come from a tenant or third party.

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS payer_party_id uuid;

CREATE TABLE IF NOT EXISTS public.payment_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type text NOT NULL CHECK (party_type IN ('tenant','employer','family_member','company','institution','sponsor','well_wisher','landlord','other')),
  display_name text NOT NULL,
  phone text,
  email text,
  organisation_name text,
  reference_code text,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_parties_manager_idx ON public.payment_parties(manager_id);
CREATE INDEX IF NOT EXISTS payment_parties_user_idx ON public.payment_parties(user_id);
CREATE INDEX IF NOT EXISTS payment_parties_reference_idx ON public.payment_parties(reference_code);

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_payer_party_fk;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_payer_party_fk
  FOREIGN KEY (payer_party_id) REFERENCES public.payment_parties(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.payer_unit_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_party_id uuid NOT NULL REFERENCES public.payment_parties(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  relationship text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payer_party_id, unit_id)
);
CREATE INDEX IF NOT EXISTS payer_unit_links_unit_idx ON public.payer_unit_links(unit_id, is_active);
CREATE INDEX IF NOT EXISTS payer_unit_links_payer_idx ON public.payer_unit_links(payer_party_id, is_active);

ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS payer_party_id uuid REFERENCES public.payment_parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payment_allocations_unit_idx ON public.payment_allocations(unit_id);
CREATE INDEX IF NOT EXISTS payment_allocations_payer_idx ON public.payment_allocations(payer_party_id);

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

CREATE TABLE IF NOT EXISTS public.payment_receipt_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.issued_payment_receipts(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('payer','tenant','landlord','manager','agency')),
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text,
  recipient_phone text,
  delivery_channel text NOT NULL DEFAULT 'in_app' CHECK (delivery_channel IN ('in_app','email','sms')),
  sent_at timestamptz,
  UNIQUE(receipt_id, recipient_type, recipient_user_id, delivery_channel)
);

-- Return all units a portal user is linked to through active tenant leases and explicit payer links.
CREATE OR REPLACE FUNCTION public.get_portal_billing_units(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(unit_id uuid, property_id uuid, unit_number text, property_name text, lease_id uuid, tenant_id uuid, payer_party_id uuid, relationship text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT DISTINCT u.id, u.property_id, u.unit_number, p.name, l.id, l.tenant_id, NULL::uuid, 'tenant'::text
  FROM public.leases l
  JOIN public.units u ON u.id=l.unit_id
  JOIN public.properties p ON p.id=u.property_id
  WHERE l.tenant_id=p_user_id AND l.status IN ('active','Active')
  UNION
  SELECT DISTINCT u.id, u.property_id, u.unit_number, p.name, l.id, l.tenant_id, pul.payer_party_id, pul.relationship
  FROM public.payer_unit_links pul
  JOIN public.units u ON u.id=pul.unit_id
  JOIN public.properties p ON p.id=u.property_id
  LEFT JOIN public.leases l ON l.unit_id=u.id AND l.status IN ('active','Active')
  JOIN public.payment_parties pp ON pp.id=pul.payer_party_id
  WHERE pul.is_active AND pp.user_id=p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_portal_billing_units(uuid) TO authenticated;

-- Create/update a payer profile and optionally link it to one or more units.
CREATE OR REPLACE FUNCTION public.save_payment_party_atomic(
  p_id uuid,
  p_party_type text,
  p_display_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_organisation_name text DEFAULT NULL,
  p_reference_code text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.payment_parties
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.payment_parties%ROWTYPE; v_manager uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_party_type NOT IN ('tenant','employer','family_member','company','institution','sponsor','well_wisher','landlord','other') THEN RAISE EXCEPTION 'Invalid payer type' USING ERRCODE='22023'; END IF;
  SELECT manager_id INTO v_manager FROM public.payment_parties WHERE id=p_id;
  IF p_id IS NOT NULL AND v_manager IS NOT NULL AND v_manager<>auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Payer profile unauthorized' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.payment_parties(id,party_type,display_name,phone,email,organisation_name,reference_code,notes,user_id,manager_id)
  VALUES(COALESCE(p_id,gen_random_uuid()),p_party_type,trim(p_display_name),p_phone,p_email,p_organisation_name,p_reference_code,p_notes,
         CASE WHEN p_party_type='tenant' THEN auth.uid() ELSE NULL END,auth.uid())
  ON CONFLICT(id) DO UPDATE SET party_type=EXCLUDED.party_type,display_name=EXCLUDED.display_name,phone=EXCLUDED.phone,email=EXCLUDED.email,organisation_name=EXCLUDED.organisation_name,reference_code=EXCLUDED.reference_code,notes=EXCLUDED.notes,updated_at=now()
  RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.save_payment_party_atomic(uuid,text,text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.link_payer_to_unit_atomic(
  p_payer_party_id uuid, p_unit_id uuid, p_relationship text DEFAULT NULL
)
RETURNS public.payer_unit_links
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.payer_unit_links%ROWTYPE; v_property uuid; v_manager uuid;
BEGIN
  SELECT property_id INTO v_property FROM public.units WHERE id=p_unit_id;
  SELECT manager_id INTO v_manager FROM public.properties WHERE id=v_property;
  IF v_property IS NULL OR v_manager IS NULL THEN RAISE EXCEPTION 'Unit not found' USING ERRCODE='P0002'; END IF;
  IF auth.uid()<>v_manager AND NOT EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=auth.uid()) AND NOT EXISTS (SELECT 1 FROM public.payment_parties pp WHERE pp.id=p_payer_party_id AND pp.user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Unit payer link unauthorized' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.payer_unit_links(payer_party_id,unit_id,property_id,tenant_id,relationship)
  VALUES(p_payer_party_id,p_unit_id,v_property,(SELECT tenant_id FROM public.leases WHERE unit_id=p_unit_id AND status IN ('active','Active') ORDER BY start_date DESC LIMIT 1),p_relationship)
  ON CONFLICT(payer_party_id,unit_id) DO UPDATE SET is_active=true,relationship=EXCLUDED.relationship,tenant_id=EXCLUDED.tenant_id,property_id=EXCLUDED.property_id
  RETURNING * INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.link_payer_to_unit_atomic(uuid,uuid,text) TO authenticated;

-- One transaction, many invoices/units. Explicit allocations prevent silent guessing.
CREATE OR REPLACE FUNCTION public.process_payer_payment_atomic(
  p_payer_party_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_reference text,
  p_allocations jsonb,
  p_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_tx uuid; v_receipt uuid; v_receipt_no text; v_total numeric:=0; v_item jsonb; v_invoice record; v_alloc numeric; v_party public.payment_parties%ROWTYPE; v_unit uuid; v_property uuid;
BEGIN
  SELECT * INTO v_party FROM public.payment_parties WHERE id=p_payer_party_id;
  IF v_party.id IS NULL THEN RAISE EXCEPTION 'Payer not found' USING ERRCODE='P0002'; END IF;
  IF auth.role() <> 'service_role' AND NOT (v_party.user_id=auth.uid() OR v_party.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_party.manager_id AND ms.submanager_user_id=auth.uid())) THEN
    RAISE EXCEPTION 'Payer is not accessible to this user' USING ERRCODE='42501';
  END IF;
  IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero' USING ERRCODE='22003'; END IF;
  IF jsonb_typeof(p_allocations)<>'array' OR jsonb_array_length(p_allocations)=0 THEN RAISE EXCEPTION 'At least one invoice allocation is required' USING ERRCODE='22023'; END IF;

  INSERT INTO public.payment_transactions(tenant_id,manager_id,unit_id,property_id,unit_number,amount,payment_type,payment_method,phone_number,bank_reference,status,initiated_at,completed_at,recorded_by,notes,payer_party_id)
  SELECT NULL, p.manager_id, NULL, NULL, NULL, round(p_amount,2), p_payment_method,p_payment_method,COALESCE(p_phone,''),p_reference,'completed',now(),now(),auth.uid(),p_notes,p_payer_party_id
  FROM public.payment_parties p WHERE p.id=p_payer_party_id
  RETURNING id INTO v_tx;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    SELECT i.* INTO v_invoice FROM public.invoices i WHERE i.id=(v_item->>'invoice_id')::uuid FOR UPDATE;
    IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice % not found',(v_item->>'invoice_id'); END IF;
    IF auth.role() <> 'service_role' AND NOT (v_invoice.manager_id=v_party.manager_id OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_invoice.manager_id AND ms.submanager_user_id=auth.uid()) OR (v_party.user_id=auth.uid() AND v_party.party_type='tenant' AND v_invoice.tenant_id=auth.uid()) OR EXISTS (SELECT 1 FROM public.payer_unit_links pul WHERE pul.payer_party_id=p_payer_party_id AND pul.unit_id=(SELECT unit_id FROM public.leases WHERE id=v_invoice.lease_id) AND pul.is_active)) THEN
      RAISE EXCEPTION 'Payer is not authorised for invoice %',v_invoice.invoice_number USING ERRCODE='42501';
    END IF;
    v_alloc:=round((v_item->>'amount')::numeric,2);
    IF v_alloc<=0 OR v_alloc>round(COALESCE(v_invoice.balance_due,v_invoice.amount),2) THEN RAISE EXCEPTION 'Invalid allocation for invoice %',(v_invoice.invoice_number); END IF;
    v_unit:=NULL; v_property:=NULL;
    SELECT l.unit_id,l.property_id INTO v_unit,v_property FROM public.leases l WHERE l.id=v_invoice.lease_id;
    UPDATE public.invoices SET paid_amount=round(COALESCE(paid_amount,0)+v_alloc,2),balance_due=GREATEST(round(COALESCE(balance_due,amount)-v_alloc,2),0),status=CASE WHEN round(COALESCE(balance_due,amount)-v_alloc,2)<=0 THEN 'paid' ELSE 'partially_paid' END,paid_date=CASE WHEN round(COALESCE(balance_due,amount)-v_alloc,2)<=0 THEN COALESCE(p_payment_date,current_date) ELSE paid_date END,updated_at=now() WHERE id=v_invoice.id;
    INSERT INTO public.payment_allocations(transaction_id,invoice_id,tenant_id,manager_id,allocated_amount,closes_invoice,payer_party_id,unit_id,property_id)
    VALUES(v_tx,v_invoice.id,v_invoice.tenant_id,v_invoice.manager_id,v_alloc,round(COALESCE(v_invoice.balance_due,v_invoice.amount)-v_alloc,2)<=0,p_payer_party_id,v_unit,v_property);
    v_total:=v_total+v_alloc;
  END LOOP;

  IF round(v_total,2)<>round(p_amount,2) THEN RAISE EXCEPTION 'Payment total % does not equal allocation total %',p_amount,v_total; END IF;

  v_receipt_no:='RCP-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  INSERT INTO public.issued_payment_receipts(transaction_id,receipt_number,payer_party_id,total_amount) VALUES(v_tx,v_receipt_no,p_payer_party_id,p_amount) RETURNING id INTO v_receipt;
  INSERT INTO public.payment_receipt_recipients(receipt_id,recipient_type,recipient_user_id,delivery_channel) VALUES(v_receipt,'payer',v_party.user_id,'in_app') ON CONFLICT DO NOTHING;
  INSERT INTO public.payment_receipt_recipients(receipt_id,recipient_type,recipient_user_id,delivery_channel)
  SELECT v_receipt,'tenant',l.tenant_id,'in_app' FROM public.payment_allocations pa JOIN public.invoices i ON i.id=pa.invoice_id JOIN public.leases l ON l.id=i.lease_id WHERE pa.transaction_id=v_tx AND l.tenant_id IS NOT NULL GROUP BY l.tenant_id ON CONFLICT DO NOTHING;
  INSERT INTO public.payment_receipt_recipients(receipt_id,recipient_type,recipient_user_id,delivery_channel)
  SELECT DISTINCT v_receipt,'landlord',pl.landlord_user_id,'in_app' FROM public.payment_allocations pa JOIN public.properties p ON p.id=pa.property_id JOIN public.property_landlords pl ON pl.property_id=p.id WHERE pa.transaction_id=v_tx ON CONFLICT DO NOTHING;
  INSERT INTO public.payment_receipt_recipients(receipt_id,recipient_type,recipient_user_id,delivery_channel)
  SELECT v_receipt,'manager',p.manager_id,'in_app' FROM public.payment_allocations pa JOIN public.properties p ON p.id=pa.property_id WHERE pa.transaction_id=v_tx AND p.manager_id IS NOT NULL GROUP BY p.manager_id ON CONFLICT DO NOTHING;

  PERFORM public.notify_payment_receipt_recipients_atomic(v_receipt);

  RETURN jsonb_build_object('success',true,'transaction_id',v_tx,'receipt_id',v_receipt,'receipt_number',v_receipt_no,'total_allocated',v_total,'allocation_count',(SELECT count(*) FROM public.payment_allocations WHERE transaction_id=v_tx));
END $$;
GRANT EXECUTE ON FUNCTION public.process_payer_payment_atomic(uuid,numeric,text,date,text,jsonb,text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_payment_receipt(p_receipt_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'receipt',to_jsonb(r),
    'payer',to_jsonb(pp),
    'transaction',to_jsonb(pt),
    'allocations',COALESCE((SELECT jsonb_agg(jsonb_build_object('invoice_id',pa.invoice_id,'amount',pa.allocated_amount,'unit_id',pa.unit_id,'property_id',pa.property_id,'invoice_number',i.invoice_number,'unit_number',u.unit_number,'property_name',p.name)) FROM public.payment_allocations pa JOIN public.invoices i ON i.id=pa.invoice_id LEFT JOIN public.units u ON u.id=pa.unit_id LEFT JOIN public.properties p ON p.id=pa.property_id WHERE pa.transaction_id=r.transaction_id),'[]'::jsonb)
  ) FROM public.issued_payment_receipts r LEFT JOIN public.payment_parties pp ON pp.id=r.payer_party_id JOIN public.payment_transactions pt ON pt.id=r.transaction_id WHERE r.id=p_receipt_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_payment_receipt(uuid) TO authenticated;


-- Manager/landlord unit-first view: bulk or individual payments resolve to the same unit status.
CREATE OR REPLACE FUNCTION public.get_unit_billing_summary(p_property_id uuid)
RETURNS TABLE(unit_id uuid, unit_number text, tenant_count bigint, invoice_count bigint, invoiced_amount numeric, paid_amount numeric, balance_due numeric, paid_units boolean, overdue_amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT u.id,u.unit_number,
         count(DISTINCT l.tenant_id),count(i.id),
         round(COALESCE(sum(i.amount),0),2),round(COALESCE(sum(i.paid_amount),0),2),round(COALESCE(sum(i.balance_due),0),2),
         COALESCE(sum(CASE WHEN i.status='paid' THEN 1 ELSE 0 END),0)>0,
         round(COALESCE(sum(CASE WHEN i.status='overdue' THEN i.balance_due ELSE 0 END),0),2)
  FROM public.units u
  LEFT JOIN public.leases l ON l.unit_id=u.id
  LEFT JOIN public.invoices i ON i.lease_id=l.id
  WHERE u.property_id=p_property_id
    AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id=u.property_id AND (p.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=auth.uid()) OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p.id AND pl.landlord_user_id=auth.uid())))
  GROUP BY u.id,u.unit_number
  ORDER BY u.unit_number;
$$;
GRANT EXECUTE ON FUNCTION public.get_unit_billing_summary(uuid) TO authenticated;

-- Receipt notifications are generated at payment time for the payer and every affected tenant/owner.
CREATE OR REPLACE FUNCTION public.notify_payment_receipt_recipients_atomic(p_receipt_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.in_app_notifications(user_id,manager_id,title,body,type,action_url,action_label,reference_id,reference_type,source)
  SELECT pr.recipient_user_id,pt.manager_id,
         CASE pr.recipient_type WHEN 'payer' THEN 'Payment receipt' WHEN 'landlord' THEN 'Payment received for your property' WHEN 'manager' THEN 'Payment received' ELSE 'Payment recorded for your unit' END,
         'Receipt '||r.receipt_number||' — '||to_char(r.total_amount,'FM999,999,990.00')||' received and allocated to the selected unit invoice(s).',
         'payment','/billing/receipts','View receipt',r.id,'receipt','payment_engine'
  FROM public.payment_receipt_recipients pr JOIN public.issued_payment_receipts r ON r.id=pr.receipt_id JOIN public.payment_transactions pt ON pt.id=r.transaction_id
  WHERE pr.receipt_id=p_receipt_id AND pr.recipient_user_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.notify_payment_receipt_recipients_atomic(uuid) TO service_role;

-- Secure reads for payer/manager/landlord/tenant-facing receipt data.
ALTER TABLE public.payment_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payer_unit_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issued_payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipt_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_parties_owner_read ON public.payment_parties;
CREATE POLICY payment_parties_owner_read ON public.payment_parties FOR SELECT USING (user_id=auth.uid() OR manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=payment_parties.manager_id AND ms.submanager_user_id=auth.uid()));
DROP POLICY IF EXISTS payer_unit_links_owner_read ON public.payer_unit_links;
CREATE POLICY payer_unit_links_owner_read ON public.payer_unit_links FOR SELECT USING (EXISTS (SELECT 1 FROM public.payment_parties pp WHERE pp.id=payer_unit_links.payer_party_id AND (pp.user_id=auth.uid() OR pp.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=pp.manager_id AND ms.submanager_user_id=auth.uid()))));
DROP POLICY IF EXISTS payment_receipts_recipient_read ON public.issued_payment_receipts;
CREATE POLICY payment_receipts_recipient_read ON public.issued_payment_receipts FOR SELECT USING (EXISTS (SELECT 1 FROM public.payment_receipt_recipients pr WHERE pr.receipt_id=issued_payment_receipts.id AND pr.recipient_user_id=auth.uid()));
DROP POLICY IF EXISTS payment_receipt_recipients_self_read ON public.payment_receipt_recipients;
CREATE POLICY payment_receipt_recipients_self_read ON public.payment_receipt_recipients FOR SELECT USING (recipient_user_id=auth.uid());
