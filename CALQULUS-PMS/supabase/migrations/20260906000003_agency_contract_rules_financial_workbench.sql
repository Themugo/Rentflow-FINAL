-- CALQULUS PMS — Agency Contract Rules + Financial Workbench
-- Agencies are independent operators/customers of the platform. CALQULUS
-- provides the system of record; each agency chooses its own contractual rules.

-- ---------------------------------------------------------------------------
-- 1. Agency staff permissions: agency owner/admin controls the permission set.
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS agency_members_permissions_gin_idx
  ON public.agency_members USING gin (permissions);

-- ---------------------------------------------------------------------------
-- 2. Flexible contract/rules layer per agency-property-client relationship.
-- service_model remains the compatibility/authority baseline; rule_config is
-- the agency-owned operating contract and can represent custom combinations.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_contract_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  property_landlord_id uuid NOT NULL REFERENCES public.property_landlords(id) ON DELETE CASCADE,
  contract_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','superseded','expired')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  collection_destination text NOT NULL DEFAULT 'agency'
    CHECK (collection_destination IN ('agency','landlord','tenant_direct','external','split')),
  service_model text,
  management_modules jsonb NOT NULL DEFAULT '{}'::jsonb,
  financial_modules jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  enforcement_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  settlement_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS agency_contract_rules_agency_idx ON public.agency_contract_rules(agency_id,status,effective_from DESC);
CREATE INDEX IF NOT EXISTS agency_contract_rules_link_idx ON public.agency_contract_rules(property_landlord_id,status,effective_from DESC);
CREATE UNIQUE INDEX IF NOT EXISTS agency_contract_rules_active_link_uidx
  ON public.agency_contract_rules(property_landlord_id)
  WHERE status='active';

ALTER TABLE public.agency_contract_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_contract_rules_read ON public.agency_contract_rules;
CREATE POLICY agency_contract_rules_read ON public.agency_contract_rules FOR SELECT TO authenticated
  USING (agency_id IN (
    SELECT a.id FROM public.agencies a
    WHERE a.manager_id=auth.uid()
       OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=a.id AND am.member_user_id=auth.uid() AND am.is_active)
  ));

-- ---------------------------------------------------------------------------
-- 3. Agency charge catalogue: income/expense categories used for human
-- readable invoice, receipt and period-close breakdowns.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_charge_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  category text NOT NULL CHECK (category IN ('income','expense','pass_through')),
  charge_type text NOT NULL,
  calculation_method text NOT NULL DEFAULT 'fixed'
    CHECK (calculation_method IN ('fixed','per_unit','metered','percentage','manual')),
  default_rate numeric(14,2) NOT NULL DEFAULT 0 CHECK (default_rate >= 0),
  unit_label text,
  payer text NOT NULL DEFAULT 'tenant' CHECK (payer IN ('tenant','landlord','agency','third_party','shared')),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, code)
);
CREATE INDEX IF NOT EXISTS agency_charge_catalog_agency_idx ON public.agency_charge_catalog(agency_id,is_active,display_order);
ALTER TABLE public.agency_charge_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_charge_catalog_read ON public.agency_charge_catalog;
CREATE POLICY agency_charge_catalog_read ON public.agency_charge_catalog FOR SELECT TO authenticated
  USING (agency_id IN (
    SELECT a.id FROM public.agencies a
    WHERE a.manager_id=auth.uid()
       OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=a.id AND am.member_user_id=auth.uid() AND am.is_active)
  ));

-- ---------------------------------------------------------------------------
-- 4. Agency operating defaults: editable global rules for how this Agency
-- runs its own book. These are defaults; a client contract can override them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_operating_defaults (
  agency_id uuid PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agency_operating_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_operating_defaults_read ON public.agency_operating_defaults;
CREATE POLICY agency_operating_defaults_read ON public.agency_operating_defaults FOR SELECT TO authenticated
  USING (agency_id IN (
    SELECT a.id FROM public.agencies a
    WHERE a.manager_id=auth.uid()
       OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=a.id AND am.member_user_id=auth.uid() AND am.is_active)
  ));

-- ---------------------------------------------------------------------------
-- 5. Agency evidence queue: manual receipt/bank/direct-to-owner submissions.
-- External/direct evidence is intentionally separate from agency cash collected.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_payment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  property_landlord_id uuid REFERENCES public.property_landlords(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  reported_amount numeric(14,2) NOT NULL CHECK (reported_amount > 0),
  payment_date date NOT NULL,
  payment_method text NOT NULL,
  reference text,
  payer_name text,
  destination_type text NOT NULL DEFAULT 'agency'
    CHECK (destination_type IN ('agency','landlord','tenant_direct','external','split')),
  source_type text NOT NULL DEFAULT 'agent_manual'
    CHECK (source_type IN ('agent_manual','tenant_upload','bank_statement','external_consolidation','landlord_confirmation')),
  proof_url text,
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','needs_review')),
  discrepancy_amount numeric(14,2) NOT NULL DEFAULT 0,
  review_notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agency_payment_evidence_queue_idx ON public.agency_payment_evidence(agency_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS agency_payment_evidence_invoice_idx ON public.agency_payment_evidence(invoice_id,status);
CREATE INDEX IF NOT EXISTS agency_payment_evidence_tenant_idx ON public.agency_payment_evidence(tenant_id,created_at DESC);
ALTER TABLE public.agency_payment_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_payment_evidence_read ON public.agency_payment_evidence;
CREATE POLICY agency_payment_evidence_read ON public.agency_payment_evidence FOR SELECT TO authenticated
  USING (agency_id IN (
    SELECT a.id FROM public.agencies a
    WHERE a.manager_id=auth.uid()
       OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=a.id AND am.member_user_id=auth.uid() AND am.is_active)
  ));

-- Private evidence bucket. Only agency members/owners may read/write their own
-- agency prefix. This is not a public marketing bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('agency-payment-evidence','agency-payment-evidence',false,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS agency_payment_evidence_objects_read ON storage.objects;
CREATE POLICY agency_payment_evidence_objects_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='agency-payment-evidence'
  AND EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id=(storage.foldername(name))[1]::uuid
      AND (a.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=a.id AND am.member_user_id=auth.uid() AND am.is_active))
  )
);
DROP POLICY IF EXISTS agency_payment_evidence_objects_write ON storage.objects;
CREATE POLICY agency_payment_evidence_objects_write ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id='agency-payment-evidence'
  AND EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id=(storage.foldername(name))[1]::uuid
      AND (a.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=a.id AND am.member_user_id=auth.uid() AND am.is_active AND lower(am.role_in_agency) IN ('owner','admin','manager')))
  )
)
WITH CHECK (
  bucket_id='agency-payment-evidence'
  AND EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id=(storage.foldername(name))[1]::uuid
      AND (a.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=a.id AND am.member_user_id=auth.uid() AND am.is_active AND lower(am.role_in_agency) IN ('owner','admin','manager')))
  )
);

-- ---------------------------------------------------------------------------
-- 5. Agency financial close periods — same concept as manager close but scoped
-- to the Agency's own book and external evidence queue.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','reopened')),
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  snapshot jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_start <= period_end),
  UNIQUE (agency_id,period_start,period_end)
);
ALTER TABLE public.agency_financial_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_financial_periods_read ON public.agency_financial_periods;
CREATE POLICY agency_financial_periods_read ON public.agency_financial_periods FOR SELECT TO authenticated
USING (agency_id IN (SELECT a.id FROM public.agencies a WHERE a.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.agency_members am WHERE am.agency_id=a.id AND am.member_user_id=auth.uid() AND am.is_active)));

-- ---------------------------------------------------------------------------
-- 6. Shared authorization helpers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agency_id_for_user(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    (SELECT mp.agency_id FROM public.manager_profiles mp WHERE mp.manager_user_id=p_user_id AND mp.agency_id IS NOT NULL LIMIT 1),
    (SELECT a.id FROM public.agencies a WHERE a.manager_id=p_user_id LIMIT 1),
    (SELECT am.agency_id FROM public.agency_members am WHERE am.member_user_id=p_user_id AND am.is_active ORDER BY am.joined_at LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_agency_admin(p_agency_id uuid, p_permission text DEFAULT 'manage_settings')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_permissions jsonb;
BEGIN
  IF v_uid IS NULL OR p_agency_id IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=p_agency_id AND a.manager_id=v_uid) THEN RETURN true; END IF;
  SELECT lower(am.role_in_agency), COALESCE(am.permissions,'{}'::jsonb)
  INTO v_role,v_permissions
  FROM public.agency_members am
  WHERE am.agency_id=p_agency_id AND am.member_user_id=v_uid AND am.is_active
  LIMIT 1;
  IF v_role IN ('owner','admin') THEN RETURN true; END IF;
  RETURN COALESCE((v_permissions->>p_permission)::boolean,false);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_agency_property(p_agency_id uuid, p_property_landlord_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.property_landlords pl
    JOIN public.properties p ON p.id=pl.property_id
    WHERE pl.id=p_property_landlord_id
      AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=p_agency_id AND (a.manager_id=pl.manager_id OR a.manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)))
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. Configuration read/write RPCs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_operations_config(p_agency_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_agency uuid:=COALESCE(p_agency_id,public.agency_id_for_user()); v_uid uuid:=auth.uid();
BEGIN
  IF v_agency IS NULL THEN RAISE EXCEPTION 'Agency not found' USING ERRCODE='P0002'; END IF;
  IF NOT public.can_manage_agency_admin(v_agency,'view_settings') AND NOT public.can_manage_agency_admin(v_agency,'view_financials') THEN RAISE EXCEPTION 'Agency access denied' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'agency_id',v_agency,
    'contract_rules',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.effective_from DESC,r.created_at DESC) FROM public.agency_contract_rules r WHERE r.agency_id=v_agency AND r.status='active'),'[]'::jsonb),
    'charge_catalog',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.display_order,c.label) FROM public.agency_charge_catalog c WHERE c.agency_id=v_agency),'[]'::jsonb),
    'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',am.id,'member_user_id',am.member_user_id,'role_in_agency',am.role_in_agency,'permissions',am.permissions,'is_active',am.is_active) ORDER BY am.joined_at) FROM public.agency_members am WHERE am.agency_id=v_agency),'[]'::jsonb),
    'defaults',COALESCE((SELECT config FROM public.agency_operating_defaults WHERE agency_id=v_agency),jsonb_build_object(
      'payment_methods',jsonb_build_array('mpesa_paybill','mpesa_till','bank_transfer','cash'),
      'collection_destination','agency',
      'proof_required_for_manual',true,
      'auto_allocate_rent',true,
      'allow_external_consolidation',true,
      'allow_partial_payments',true,
      'manual_payment_requires_approval',true,
      'month_close_day',1,
      'dispute_window_days',30
    )),
    'viewer',jsonb_build_object('user_id',v_uid,'is_admin',public.can_manage_agency_admin(v_agency,'manage_settings'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_agency_member_permissions_atomic(
  p_agency_id uuid,
  p_member_id uuid,
  p_role_in_agency text,
  p_permissions jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb:=COALESCE(p_permissions,'{}'::jsonb); v_id uuid;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'manage_team') THEN RAISE EXCEPTION 'Agency admin permission required' USING ERRCODE='42501'; END IF;
  IF p_member_id IS NULL OR p_member_id=auth.uid() THEN RAISE EXCEPTION 'Select a different team member'; END IF;
  INSERT INTO public.agency_members(agency_id,manager_id,member_user_id,role_in_agency,permissions,is_active)
  SELECT p_agency_id,a.manager_id,p_member_id,COALESCE(NULLIF(trim(p_role_in_agency),''),'staff'),v,true FROM public.agencies a WHERE a.id=p_agency_id
  ON CONFLICT (agency_id,member_user_id) DO UPDATE SET role_in_agency=EXCLUDED.role_in_agency,permissions=EXCLUDED.permissions,is_active=true
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_agency_contract_rule_atomic(
  p_rule_id uuid,
  p_agency_id uuid,
  p_property_landlord_id uuid,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.agency_contract_rules%ROWTYPE; v_id uuid; v jsonb:=COALESCE(p_payload,'{}'::jsonb); v_prop uuid; v_model text; v_destination text;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'manage_contract_rules') THEN RAISE EXCEPTION 'Agency contract configuration permission required' USING ERRCODE='42501'; END IF;
  IF NOT public.can_manage_agency_property(p_agency_id,p_property_landlord_id) THEN RAISE EXCEPTION 'Property/client relationship is outside this Agency' USING ERRCODE='42501'; END IF;
  SELECT property_id INTO v_prop FROM public.property_landlords WHERE id=p_property_landlord_id;
  v_model:=NULLIF(trim(v->>'service_model'),'');
  v_destination:=COALESCE(NULLIF(trim(v->>'collection_destination'),''),'agency');
  IF v_destination NOT IN ('agency','landlord','tenant_direct','external','split') THEN RAISE EXCEPTION 'Invalid collection destination'; END IF;
  IF p_rule_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.agency_contract_rules WHERE id=p_rule_id AND agency_id=p_agency_id FOR UPDATE;
    IF v_old.id IS NULL THEN RAISE EXCEPTION 'Contract rule not found' USING ERRCODE='P0002'; END IF;
    UPDATE public.agency_contract_rules SET status='superseded',effective_to=LEAST(COALESCE(effective_to,CURRENT_DATE),COALESCE(NULLIF(v->>'effective_from','')::date,CURRENT_DATE)-1),updated_by=auth.uid(),updated_at=now() WHERE id=v_old.id;
  END IF;
  INSERT INTO public.agency_contract_rules(
    agency_id,property_landlord_id,contract_name,status,effective_from,effective_to,collection_destination,service_model,
    management_modules,financial_modules,payment_rules,enforcement_rules,settlement_rules,approval_rules,notes,created_by,updated_by
  ) VALUES (
    p_agency_id,p_property_landlord_id,COALESCE(NULLIF(trim(v->>'contract_name'),''),'Client operating agreement'),'active',
    COALESCE(NULLIF(v->>'effective_from','')::date,CURRENT_DATE),NULLIF(v->>'effective_to','')::date,v_destination,v_model,
    COALESCE(v->'management_modules','{}'::jsonb),COALESCE(v->'financial_modules','{}'::jsonb),COALESCE(v->'payment_rules','{}'::jsonb),COALESCE(v->'enforcement_rules','{}'::jsonb),COALESCE(v->'settlement_rules','{}'::jsonb),COALESCE(v->'approval_rules','{}'::jsonb),NULLIF(trim(COALESCE(v->>'notes','')),''),auth.uid(),auth.uid()
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'property_id',v_prop);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_agency_charge_catalog_item_atomic(
  p_item_id uuid,
  p_agency_id uuid,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb:=COALESCE(p_payload,'{}'::jsonb); v_id uuid;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'manage_billing_rules') THEN RAISE EXCEPTION 'Agency billing configuration permission required' USING ERRCODE='42501'; END IF;
  IF NULLIF(trim(v->>'code'),'') IS NULL OR NULLIF(trim(v->>'label'),'') IS NULL THEN RAISE EXCEPTION 'Charge code and label are required'; END IF;
  INSERT INTO public.agency_charge_catalog(id,agency_id,code,label,category,charge_type,calculation_method,default_rate,unit_label,payer,is_active,display_order,notes,created_by,updated_by)
  VALUES(coalesce(p_item_id,gen_random_uuid()),p_agency_id,upper(trim(v->>'code')),trim(v->>'label'),coalesce(v->>'category','income'),coalesce(v->>'charge_type','other'),coalesce(v->>'calculation_method','fixed'),coalesce((v->>'default_rate')::numeric,0),NULLIF(trim(v->>'unit_label'),''),coalesce(v->>'payer','tenant'),coalesce((v->>'is_active')::boolean,true),coalesce((v->>'display_order')::integer,0),NULLIF(trim(v->>'notes'),''),auth.uid(),auth.uid())
  ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code,label=EXCLUDED.label,category=EXCLUDED.category,charge_type=EXCLUDED.charge_type,calculation_method=EXCLUDED.calculation_method,default_rate=EXCLUDED.default_rate,unit_label=EXCLUDED.unit_label,payer=EXCLUDED.payer,is_active=EXCLUDED.is_active,display_order=EXCLUDED.display_order,notes=EXCLUDED.notes,updated_by=auth.uid(),updated_at=now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_agency_operating_defaults_atomic(p_agency_id uuid,p_config jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb:=COALESCE(p_config,'{}'::jsonb); v_id uuid;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'manage_settings') THEN RAISE EXCEPTION 'Agency settings permission required' USING ERRCODE='42501'; END IF;
  IF COALESCE(v->>'collection_destination','agency') NOT IN ('agency','landlord','tenant_direct','external','split') THEN RAISE EXCEPTION 'Invalid default collection destination'; END IF;
  INSERT INTO public.agency_operating_defaults(agency_id,config,updated_by,updated_at)
  VALUES(p_agency_id,v,auth.uid(),now())
  ON CONFLICT (agency_id) DO UPDATE SET config=EXCLUDED.config,updated_by=auth.uid(),updated_at=now()
  RETURNING agency_id INTO v_id;
  RETURN jsonb_build_object('ok',true,'agency_id',v_id,'config',v);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Financial breakdown: invoice lines + allocated cash + external evidence.
-- Collected is distributed to line items proportionally so the result always
-- reconciles to the invoice-level payment allocations.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_financial_breakdown(
  p_agency_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_agency uuid:=p_agency_id; v_uid uuid:=auth.uid();
BEGIN
  IF NOT public.can_manage_agency_admin(v_agency,'view_financials') THEN RAISE EXCEPTION 'Agency financial access denied' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'agency_id',v_agency,'period_start',p_period_start,'period_end',p_period_end,
    'rows',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'charge_type',x.charge_type,'label',x.label,
        'billed',round(x.billed,2),'collected',round(x.collected,2),
        'outstanding',round(GREATEST(x.billed-x.collected,0),2),
        'external_confirmed',round(x.external_confirmed,2),
        'expenses',round(x.expenses,2),'net',round(x.collected+x.external_confirmed-x.expenses,2)
      ) ORDER BY x.category_order,x.label)
      FROM (
        SELECT li.charge_type,COALESCE(NULLIF(max(li.charge_label),''),initcap(replace(li.charge_type,'_',' '))) label,
               SUM(li.amount)::numeric billed,
               SUM(COALESCE(a.allocated,0) * CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END)::numeric collected,
               0::numeric external_confirmed,0::numeric expenses,10 category_order
        FROM public.invoice_line_items li
        JOIN public.invoices i ON i.id=li.invoice_id AND i.status<>'cancelled'
        JOIN LATERAL (SELECT SUM(il2.amount)::numeric line_total FROM public.invoice_line_items il2 WHERE il2.invoice_id=i.id) inv ON true
        LEFT JOIN LATERAL (SELECT SUM(pa.allocated_amount)::numeric allocated FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' WHERE pa.invoice_id=i.id AND pa.created_at::date BETWEEN p_period_start AND p_period_end) a ON true
        WHERE i.manager_id IN (SELECT a3.manager_id FROM public.agencies a3 WHERE a3.id=v_agency)
          AND i.created_at::date BETWEEN p_period_start AND p_period_end
        GROUP BY li.charge_type
        UNION ALL
        SELECT 'expense:'||e.category,initcap(replace(e.category,'_',' ')),0,0,0,SUM(e.amount),50
        FROM public.expenditures e
        WHERE e.manager_id IN (SELECT a4.manager_id FROM public.agencies a4 WHERE a4.id=v_agency)
          AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
        GROUP BY e.category
        UNION ALL
        SELECT 'external:'||COALESCE(e.payment_method,'external'),initcap(replace(COALESCE(e.payment_method,'external'),'_',' ')),0,0,SUM(e.reported_amount),0,30
        FROM public.agency_payment_evidence e
        WHERE e.agency_id=v_agency AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end
        GROUP BY COALESCE(e.payment_method,'external')
      ) x
    ),'[]'::jsonb),
    'totals',jsonb_build_object(
      'billed',COALESCE((SELECT SUM(COALESCE(i.original_amount,i.amount)) FROM public.invoices i WHERE i.manager_id IN (SELECT a5.manager_id FROM public.agencies a5 WHERE a5.id=v_agency) AND i.created_at::date BETWEEN p_period_start AND p_period_end AND i.status<>'cancelled'),0),
      'collected',COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' WHERE pa.manager_id IN (SELECT a6.manager_id FROM public.agencies a6 WHERE a6.id=v_agency) AND pa.created_at::date BETWEEN p_period_start AND p_period_end),0),
      'external_confirmed',COALESCE((SELECT SUM(e.reported_amount) FROM public.agency_payment_evidence e WHERE e.agency_id=v_agency AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end),0),
      'expenses',COALESCE((SELECT SUM(e.amount) FROM public.expenditures e WHERE e.manager_id IN (SELECT a7.manager_id FROM public.agencies a7 WHERE a7.id=v_agency) AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end),0)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Evidence submit/review. Accepted agency collection creates a real
-- payment transaction + allocation; direct/external evidence remains external
-- proof, never misrepresented as Agency cash.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_agency_payment_evidence_atomic(p_agency_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb:=COALESCE(p_payload,'{}'::jsonb); v_id uuid; v_link uuid;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'record_payments') THEN RAISE EXCEPTION 'Agency payment permission required' USING ERRCODE='42501'; END IF;
  v_link:=NULLIF(v->>'property_landlord_id','')::uuid;
  IF v_link IS NOT NULL AND NOT public.can_manage_agency_property(p_agency_id,v_link) THEN RAISE EXCEPTION 'Property/client relationship outside Agency'; END IF;
  IF COALESCE((v->>'reported_amount')::numeric,0)<=0 THEN RAISE EXCEPTION 'Payment amount must be positive'; END IF;
  INSERT INTO public.agency_payment_evidence(agency_id,property_landlord_id,property_id,unit_id,tenant_id,invoice_id,reported_amount,payment_date,payment_method,reference,payer_name,destination_type,source_type,proof_url,notes,status,created_by)
  VALUES(p_agency_id,v_link,NULLIF(v->>'property_id','')::uuid,NULLIF(v->>'unit_id','')::uuid,NULLIF(v->>'tenant_id','')::uuid,NULLIF(v->>'invoice_id','')::uuid,round((v->>'reported_amount')::numeric,2),COALESCE(NULLIF(v->>'payment_date','')::date,CURRENT_DATE),COALESCE(v->>'payment_method','bank_transfer'),NULLIF(trim(v->>'reference'),''),NULLIF(trim(v->>'payer_name'),''),COALESCE(v->>'destination_type','agency'),COALESCE(v->>'source_type','agent_manual'),NULLIF(v->>'proof_url',''),NULLIF(trim(v->>'notes'),''),'pending',auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'status','pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.review_agency_payment_evidence_atomic(p_evidence_id uuid, p_decision text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.agency_payment_evidence%ROWTYPE; v_manager uuid; v_tx uuid; v_alloc numeric; v_balance numeric; v_status text;
BEGIN
  SELECT * INTO e FROM public.agency_payment_evidence WHERE id=p_evidence_id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Evidence not found' USING ERRCODE='P0002'; END IF;
  IF NOT public.can_manage_agency_admin(e.agency_id,'verify_payment_evidence') THEN RAISE EXCEPTION 'Agency verification permission required' USING ERRCODE='42501'; END IF;
  IF e.status NOT IN ('pending','needs_review') THEN RETURN jsonb_build_object('ok',true,'idempotent',true,'status',e.status); END IF;
  IF p_decision NOT IN ('accepted','rejected','needs_review') THEN RAISE EXCEPTION 'Invalid evidence decision'; END IF;
  IF p_decision='rejected' THEN
    UPDATE public.agency_payment_evidence SET status='rejected',review_notes=left(trim(COALESCE(p_reason,'')),500),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('ok',true,'status','rejected');
  ELSIF p_decision='needs_review' THEN
    UPDATE public.agency_payment_evidence SET status='needs_review',review_notes=left(trim(COALESCE(p_reason,'')),500),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('ok',true,'status','needs_review');
  END IF;

  SELECT a.manager_id INTO v_manager FROM public.agencies a WHERE a.id=e.agency_id;
  IF e.destination_type='agency' THEN
    IF e.invoice_id IS NULL OR e.tenant_id IS NULL THEN RAISE EXCEPTION 'Agency-collected evidence requires tenant and invoice'; END IF;
    IF NOT public.agency_service_capability(COALESCE(e.property_id,(SELECT property_id FROM public.invoices WHERE id=e.invoice_id)),'collect') THEN RAISE EXCEPTION 'Agency contract does not permit collection for this property' USING ERRCODE='42501'; END IF;
    SELECT balance_due INTO v_balance FROM public.invoices WHERE id=e.invoice_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance <= 0 THEN RAISE EXCEPTION 'Invoice has no remaining balance'; END IF;
    INSERT INTO public.payment_transactions(tenant_id,manager_id,unit_id,property_id,amount,payment_type,payment_method,phone_number,bank_reference,status,initiated_at,completed_at,recorded_by,notes)
    VALUES(e.tenant_id,v_manager,e.unit_id,e.property_id,round(e.reported_amount,2),e.payment_method,e.payment_method,'',e.reference,'completed',now(),now(),auth.uid(),'Agency evidence accepted')
    RETURNING id INTO v_tx;
    SELECT public.process_invoice_payment(e.invoice_id,v_tx,e.reported_amount) INTO v_alloc;
    UPDATE public.payment_transactions SET allocated_amount=COALESCE(v_alloc,0),is_partial=(v_alloc < e.reported_amount),updated_at=now() WHERE id=v_tx;
  END IF;
  v_status:='accepted';
  UPDATE public.agency_payment_evidence SET status=v_status,review_notes=left(trim(COALESCE(p_reason,'')),500),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() WHERE id=e.id;
  RETURN jsonb_build_object('ok',true,'status',v_status,'transaction_id',v_tx,'allocated_amount',COALESCE(v_alloc,0),'external',(e.destination_type<>'agency'));
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Agency monthly close. Close checks are based on agency evidence + cash
-- records. No numbers are manually copied into the close snapshot.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_financial_close(p_agency_id uuid,p_period_start date,p_period_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_close public.agency_financial_periods; v_unreviewed integer; v_unmatched integer; v_pending integer; v_breakdown jsonb;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'view_financials') THEN RAISE EXCEPTION 'Agency financial access denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_close FROM public.agency_financial_periods WHERE agency_id=p_agency_id AND period_start=p_period_start AND period_end=p_period_end;
  SELECT count(*) INTO v_unreviewed FROM public.agency_payment_evidence e WHERE e.agency_id=p_agency_id AND e.created_at::date BETWEEN p_period_start AND p_period_end AND e.status IN ('pending','needs_review');
  SELECT count(*) INTO v_unmatched FROM public.bank_transactions b WHERE b.manager_id IN (SELECT a.manager_id FROM public.agencies a WHERE a.id=p_agency_id) AND b.transaction_date BETWEEN p_period_start AND p_period_end AND b.matched=false;
  SELECT count(*) INTO v_pending FROM public.payment_transactions t WHERE t.manager_id IN (SELECT a.manager_id FROM public.agencies a WHERE a.id=p_agency_id) AND t.created_at::date BETWEEN p_period_start AND p_period_end AND t.status IN ('pending','processing');
  v_breakdown:=public.get_agency_financial_breakdown(p_agency_id,p_period_start,p_period_end);
  RETURN jsonb_build_object('agency_id',p_agency_id,'period_start',p_period_start,'period_end',p_period_end,'status',coalesce(v_close.status,'open'),'closed_at',v_close.closed_at,'checks',jsonb_build_object('pending_evidence',v_unreviewed,'unmatched_bank_transactions',v_unmatched,'pending_payments',v_pending),'ready_to_close',(v_unreviewed=0 AND v_unmatched=0 AND v_pending=0),'breakdown',v_breakdown);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_agency_financial_period_atomic(p_agency_id uuid,p_period_start date,p_period_end date,p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_state jsonb; v_id uuid;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'close_books') THEN RAISE EXCEPTION 'Agency close-books permission required' USING ERRCODE='42501'; END IF;
  v_state:=public.get_agency_financial_close(p_agency_id,p_period_start,p_period_end);
  IF COALESCE((v_state->'checks'->>'pending_evidence')::integer,0)>0 OR COALESCE((v_state->'checks'->>'unmatched_bank_transactions')::integer,0)>0 OR COALESCE((v_state->'checks'->>'pending_payments')::integer,0)>0 THEN
    RAISE EXCEPTION 'Agency financial period is not ready to close' USING ERRCODE='55000';
  END IF;
  INSERT INTO public.agency_financial_periods(agency_id,period_start,period_end,status,closed_at,closed_by,snapshot,notes,updated_at)
  VALUES(p_agency_id,p_period_start,p_period_end,'closed',now(),auth.uid(),v_state,NULLIF(trim(COALESCE(p_notes,'')),''),now())
  ON CONFLICT (agency_id,period_start,period_end) DO UPDATE SET status='closed',closed_at=now(),closed_by=auth.uid(),snapshot=EXCLUDED.snapshot,notes=EXCLUDED.notes,updated_at=now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'status','closed','snapshot',v_state);
END;
$$;

REVOKE ALL ON FUNCTION public.agency_id_for_user(uuid), public.can_manage_agency_admin(uuid,text), public.can_manage_agency_property(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_agency_operations_config(uuid), public.save_agency_operating_defaults_atomic(uuid,jsonb), public.save_agency_member_permissions_atomic(uuid,uuid,text,jsonb), public.save_agency_contract_rule_atomic(uuid,uuid,uuid,jsonb), public.save_agency_charge_catalog_item_atomic(uuid,uuid,jsonb), public.get_agency_financial_breakdown(uuid,date,date), public.submit_agency_payment_evidence_atomic(uuid,jsonb), public.review_agency_payment_evidence_atomic(uuid,text,text), public.get_agency_financial_close(uuid,date,date), public.close_agency_financial_period_atomic(uuid,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agency_id_for_user(uuid), public.can_manage_agency_admin(uuid,text), public.can_manage_agency_property(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_operations_config(uuid), public.save_agency_operating_defaults_atomic(uuid,jsonb), public.save_agency_member_permissions_atomic(uuid,uuid,text,jsonb), public.save_agency_contract_rule_atomic(uuid,uuid,uuid,jsonb), public.save_agency_charge_catalog_item_atomic(uuid,uuid,jsonb), public.get_agency_financial_breakdown(uuid,date,date), public.submit_agency_payment_evidence_atomic(uuid,jsonb), public.review_agency_payment_evidence_atomic(uuid,text,text), public.get_agency_financial_close(uuid,date,date), public.close_agency_financial_period_atomic(uuid,date,date,text) TO authenticated,service_role;
