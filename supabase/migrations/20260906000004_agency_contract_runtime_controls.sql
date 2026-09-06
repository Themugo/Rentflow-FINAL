-- CALQULUS PMS — Agency contract runtime controls + reconciliation detail
-- The Agency defines its client contract. CALQULUS provides the system that
-- enforces the resulting permissions, routes, evidence and financial record.

-- ---------------------------------------------------------------------------
-- 1. Effective contract rule overrides
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agency_service_capability(
  p_property_id uuid,
  p_action text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_link public.property_landlords%ROWTYPE;
  v_model text;
  v_rule public.agency_contract_rules%ROWTYPE;
  v_agency uuid;
  v_modules jsonb;
  v_payment jsonb;
  v_enforcement jsonb;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN RETURN false; END IF;
  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id=v_uid
  ORDER BY CASE WHEN ur.role='agency' THEN 0 WHEN ur.role='manager' THEN 1 ELSE 2 END
  LIMIT 1;
  IF v_role <> 'agency' THEN RETURN false; END IF;

  SELECT pl.* INTO v_link
  FROM public.property_landlords pl
  WHERE pl.property_id=p_property_id
    AND (pl.manager_id=v_uid OR EXISTS (
      SELECT 1
      FROM public.manager_profiles mp
      WHERE mp.manager_user_id=pl.manager_id
        AND mp.agency_id=public.agency_id_for_user(v_uid)
    ))
  ORDER BY pl.updated_at DESC
  LIMIT 1;

  IF v_link.id IS NULL THEN
    -- Preserve legacy agency relationships that predate explicit contract rules.
    RETURN true;
  END IF;

  v_agency:=public.agency_id_for_user(v_uid);
  SELECT r.* INTO v_rule
  FROM public.agency_contract_rules r
  WHERE r.agency_id=v_agency
    AND r.property_landlord_id=v_link.id
    AND r.status='active'
    AND r.effective_from <= CURRENT_DATE
    AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
  ORDER BY r.effective_from DESC,r.updated_at DESC
  LIMIT 1;

  IF v_rule.id IS NULL THEN
    v_model:=COALESCE(v_link.agency_service_model,public.agency_service_model_from_operating_model(v_link.operating_model));
    IF v_model IS NULL THEN RETURN true; END IF;
    IF p_action IN ('view','financial','tenant_contact','reports') THEN RETURN true; END IF;
    IF p_action='collect' THEN RETURN v_model <> 'collections_enforcement_only' OR COALESCE(v_link.payment_destination,'agency')='agency'; END IF;
    IF p_action IN ('enforce','payment_arrangement') THEN RETURN true; END IF;
    IF v_model IN ('full_management','managed_direct_landlord_collection') AND p_action IN ('property_write','unit_write','lease_write','tenant_write','maintenance_write','caretaker_write') THEN RETURN true; END IF;
    RETURN false;
  END IF;

  v_modules:=COALESCE(v_rule.management_modules,'{}'::jsonb);
  v_payment:=COALESCE(v_rule.payment_rules,'{}'::jsonb);
  v_enforcement:=COALESCE(v_rule.enforcement_rules,'{}'::jsonb);

  IF p_action='collect' THEN
    RETURN CASE
      WHEN COALESCE(v_payment->>'agency_collects','')<>'' THEN COALESCE((v_payment->>'agency_collects')::boolean,false)
      WHEN v_rule.collection_destination IN ('agency','split') THEN true
      ELSE false
    END;
  END IF;
  IF p_action='enforce' THEN
    RETURN COALESCE((v_enforcement->>'enabled')::boolean,true);
  END IF;
  IF p_action='payment_arrangement' THEN
    RETURN COALESCE((v_payment->>'allow_payment_arrangements')::boolean,false);
  END IF;
  IF p_action IN ('view','financial','tenant_contact','reports') THEN RETURN true; END IF;

  -- Fine-grained contract modules override the coarse legacy service model.
  RETURN CASE p_action
    WHEN 'property_write' THEN COALESCE((v_modules->>'property_operations')::boolean,false)
    WHEN 'unit_write' THEN COALESCE((v_modules->>'unit_operations')::boolean,false)
    WHEN 'lease_write' THEN COALESCE((v_modules->>'lease_operations')::boolean,false)
    WHEN 'tenant_write' THEN COALESCE((v_modules->>'tenant_operations')::boolean,false)
    WHEN 'maintenance_write' THEN COALESCE((v_modules->>'maintenance_operations')::boolean,false)
    WHEN 'caretaker_write' THEN COALESCE((v_modules->>'caretaker_operations')::boolean,false)
    WHEN 'inspection_write' THEN COALESCE((v_modules->>'inspection_operations')::boolean,false)
    WHEN 'utility_write' THEN COALESCE((v_modules->>'utility_operations')::boolean,false)
    WHEN 'compliance_write' THEN COALESCE((v_modules->>'compliance_operations')::boolean,false)
    WHEN 'vendor_write' THEN COALESCE((v_modules->>'vendor_operations')::boolean,false)
    ELSE false
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Seed a practical charge catalog for agencies that have not created one.
-- Agencies can edit, disable or replace every row in their own catalog.
-- ---------------------------------------------------------------------------
INSERT INTO public.agency_charge_catalog (
  agency_id, code, label, category, charge_type, calculation_method,
  default_rate, unit_label, payer, is_active, display_order, notes, created_by
)
SELECT a.id, seed.code, seed.label, seed.category, seed.charge_type,
       seed.calculation_method, seed.default_rate, seed.unit_label,
       seed.payer, true, seed.display_order, seed.notes, a.manager_id
FROM public.agencies a
CROSS JOIN (VALUES
  ('RENT','Rent','income','rent','fixed',0::numeric,NULL,'tenant',10,'Core monthly rent'),
  ('WATER','Water','pass_through','water','metered',0::numeric,'unit','tenant',20,'Metered or apportioned water'),
  ('SECURITY','Security','pass_through','security','fixed',0::numeric,'unit','tenant',30,'Security/estate access charge'),
  ('GARBAGE','Garbage','pass_through','garbage','fixed',0::numeric,'unit','tenant',40,'Waste collection'),
  ('SERVICE','Service Charge','income','service_charge','fixed',0::numeric,'unit','tenant',50,'Estate/service charge'),
  ('ELECTRICITY','Electricity','pass_through','electricity','metered',0::numeric,'unit','tenant',60,'Prepaid or metered electricity'),
  ('PARKING','Parking','income','parking','fixed',0::numeric,'unit','tenant',70,'Parking allocation'),
  ('PENALTY','Late Payment / Penalty','income','penalty','percentage',0::numeric,'invoice','tenant',80,'Contractual penalties only'),
  ('DEPOSIT','Deposit','pass_through','deposit','manual',0::numeric,NULL,'tenant',90,'Security deposit movements'),
  ('MAINTENANCE','Maintenance Charge','pass_through','maintenance','manual',0::numeric,NULL,'tenant',100,'Tenant-borne maintenance where contracted'),
  ('OTHER','Other','income','other','manual',0::numeric,NULL,'tenant',110,'Agency-defined miscellaneous charge')
) AS seed(code,label,category,charge_type,calculation_method,default_rate,unit_label,payer,display_order,notes)
WHERE a.manager_id IS NOT NULL
ON CONFLICT (agency_id,code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Reconciliation-friendly evidence fields and indexes
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_payment_evidence
  ADD COLUMN IF NOT EXISTS expected_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS evidence_checksum text;
CREATE INDEX IF NOT EXISTS agency_payment_evidence_review_idx
  ON public.agency_payment_evidence(agency_id,status,payment_date DESC,created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Atomic evidence submit: calculate a helpful expected amount from the
-- selected invoice without treating it as a hard acceptance rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_agency_payment_evidence_atomic(p_agency_id uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v jsonb:=COALESCE(p_payload,'{}'::jsonb);
  v_id uuid;
  v_link uuid;
  v_expected numeric:=NULL;
  v_invoice uuid:=NULLIF(v->>'invoice_id','')::uuid;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'record_payments') THEN
    RAISE EXCEPTION 'Agency payment permission required' USING ERRCODE='42501';
  END IF;
  v_link:=NULLIF(v->>'property_landlord_id','')::uuid;
  IF v_link IS NOT NULL AND NOT public.can_manage_agency_property(p_agency_id,v_link) THEN
    RAISE EXCEPTION 'Property/client relationship outside Agency' USING ERRCODE='42501';
  END IF;
  IF COALESCE((v->>'reported_amount')::numeric,0)<=0 THEN RAISE EXCEPTION 'Payment amount must be positive'; END IF;
  IF v_invoice IS NOT NULL THEN
    SELECT COALESCE(balance_due,original_amount,amount) INTO v_expected FROM public.invoices WHERE id=v_invoice;
  END IF;
  INSERT INTO public.agency_payment_evidence(
    agency_id,property_landlord_id,property_id,unit_id,tenant_id,invoice_id,
    reported_amount,expected_amount,payment_date,payment_method,reference,payer_name,
    destination_type,source_type,proof_url,notes,evidence_checksum,status,created_by
  ) VALUES(
    p_agency_id,v_link,NULLIF(v->>'property_id','')::uuid,NULLIF(v->>'unit_id','')::uuid,
    NULLIF(v->>'tenant_id','')::uuid,v_invoice,round((v->>'reported_amount')::numeric,2),v_expected,
    COALESCE(NULLIF(v->>'payment_date','')::date,CURRENT_DATE),COALESCE(v->>'payment_method','bank_transfer'),
    NULLIF(trim(v->>'reference'),''),NULLIF(trim(v->>'payer_name'),''),
    COALESCE(v->>'destination_type','agency'),COALESCE(v->>'source_type','agent_manual'),
    NULLIF(v->>'proof_url',''),NULLIF(trim(v->>'notes'),''),NULLIF(trim(v->>'evidence_checksum'),''),'pending',auth.uid()
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'status','pending','expected_amount',v_expected,'difference',CASE WHEN v_expected IS NULL THEN NULL ELSE round((v->>'reported_amount')::numeric-v_expected,2) END);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Financial detail rows: one row per invoice line/payment evidence/expense
-- so the Agency can export an Excel-compatible ledger while summary totals stay
-- automatically tied to the source records.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_financial_ledger(
  p_agency_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid;
BEGIN
  IF NOT (public.can_manage_agency_admin(p_agency_id,'view_financials') OR public.can_manage_agency_admin(p_agency_id,'close_books')) THEN
    RAISE EXCEPTION 'Agency financial access denied' USING ERRCODE='42501';
  END IF;
  SELECT manager_id INTO v_manager FROM public.agencies WHERE id=p_agency_id;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.event_date,x.reference)
    FROM (
      SELECT i.created_at::date event_date,
             'invoice'::text event_type,
             i.invoice_number reference,
             COALESCE(t.name,'Tenant') counterparty,
             COALESCE(li.charge_label,initcap(replace(li.charge_type,'_',' '))) category,
             li.amount billed,
             0::numeric collected,
             0::numeric external_confirmed,
             0::numeric expense,
             i.id source_id
      FROM public.invoice_line_items li
      JOIN public.invoices i ON i.id=li.invoice_id AND i.status<>'cancelled'
      LEFT JOIN public.tenants t ON t.id=i.tenant_id
      WHERE i.manager_id=v_manager AND i.created_at::date BETWEEN p_period_start AND p_period_end
      UNION ALL
      SELECT pa.created_at::date,'payment',COALESCE(pt.bank_reference,pt.mpesa_receipt_number,pt.id::text),
             COALESCE(t.name,'Tenant'),COALESCE(li.charge_label,initcap(replace(li.charge_type,'_',' '))),
             0,round(pa.allocated_amount * CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END,2),0,0,pa.id
      FROM public.payment_allocations pa
      JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed'
      JOIN public.invoices i ON i.id=pa.invoice_id
      LEFT JOIN public.tenants t ON t.id=pa.tenant_id
      JOIN public.invoice_line_items li ON li.invoice_id=i.id
      JOIN LATERAL (SELECT SUM(il2.amount)::numeric line_total FROM public.invoice_line_items il2 WHERE il2.invoice_id=i.id) inv ON true
      WHERE pa.manager_id=v_manager AND pa.created_at::date BETWEEN p_period_start AND p_period_end
      UNION ALL
      SELECT e.payment_date,'external',COALESCE(e.reference,e.id::text),COALESCE(e.payer_name,'External'),
             COALESCE(e.payment_method,'external'),0,0,e.reported_amount,0,e.id
      FROM public.agency_payment_evidence e
      WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency'
        AND e.payment_date BETWEEN p_period_start AND p_period_end
      UNION ALL
      SELECT to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD'),
             'expense',e.id::text,'Expense',initcap(replace(e.category,'_',' ')),0,0,0,e.amount,e.id
      FROM public.expenditures e
      WHERE e.manager_id=v_manager AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
    ) x
  ),'[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Monthly close remains automatic, but the readiness report also surfaces
-- evidence age and the period ledger for dispute resolution.
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_financial_periods
  ADD COLUMN IF NOT EXISTS reopen_reason text;

REVOKE ALL ON FUNCTION public.agency_service_capability(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agency_service_capability(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_financial_ledger(uuid,date,date) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_agency_financial_ledger(uuid,date,date) FROM PUBLIC,anon;

-- ---------------------------------------------------------------------------
-- 7. Tighten configuration visibility: a staff user may read the Agency
-- configuration when they have any relevant read/manage permission.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_operations_config(p_agency_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_agency uuid:=COALESCE(p_agency_id,public.agency_id_for_user()); v_uid uuid:=auth.uid();
BEGIN
  IF v_agency IS NULL THEN RAISE EXCEPTION 'Agency not found' USING ERRCODE='P0002'; END IF;
  IF NOT (
    public.can_manage_agency_admin(v_agency,'view_settings') OR
    public.can_manage_agency_admin(v_agency,'view_financials') OR
    public.can_manage_agency_admin(v_agency,'manage_contract_rules') OR
    public.can_manage_agency_admin(v_agency,'manage_billing_rules') OR
    public.can_manage_agency_admin(v_agency,'manage_team') OR
    public.can_manage_agency_admin(v_agency,'record_payments') OR
    public.can_manage_agency_admin(v_agency,'verify_payment_evidence') OR
    public.can_manage_agency_admin(v_agency,'close_books')
  ) THEN RAISE EXCEPTION 'Agency access denied' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'agency_id',v_agency,
    'contract_rules',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.effective_from DESC,r.created_at DESC) FROM public.agency_contract_rules r WHERE r.agency_id=v_agency AND r.status='active'),'[]'::jsonb),
    'charge_catalog',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.display_order,c.label) FROM public.agency_charge_catalog c WHERE c.agency_id=v_agency),'[]'::jsonb),
    'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',am.id,'member_user_id',am.member_user_id,'role_in_agency',am.role_in_agency,'permissions',am.permissions,'is_active',am.is_active) ORDER BY am.joined_at) FROM public.agency_members am WHERE am.agency_id=v_agency),'[]'::jsonb),
    'defaults',COALESCE((SELECT config FROM public.agency_operating_defaults WHERE agency_id=v_agency),jsonb_build_object(
      'payment_methods',jsonb_build_array('mpesa_paybill','mpesa_till','bank_transfer','cash'),
      'collection_destination','agency','proof_required_for_manual',true,'auto_allocate_rent',true,
      'allow_external_consolidation',true,'allow_partial_payments',true,'manual_payment_requires_approval',true,
      'month_close_day',1,'dispute_window_days',30
    )),
    'viewer',jsonb_build_object(
      'user_id',v_uid,
      'is_admin',public.can_manage_agency_admin(v_agency,'manage_settings'),
      'can_manage_contract_rules',public.can_manage_agency_admin(v_agency,'manage_contract_rules'),
      'can_manage_billing_rules',public.can_manage_agency_admin(v_agency,'manage_billing_rules'),
      'can_manage_team',public.can_manage_agency_admin(v_agency,'manage_team'),
      'can_view_financials',public.can_manage_agency_admin(v_agency,'view_financials'),
      'can_record_payments',public.can_manage_agency_admin(v_agency,'record_payments'),
      'can_verify_payment_evidence',public.can_manage_agency_admin(v_agency,'verify_payment_evidence'),
      'can_close_books',public.can_manage_agency_admin(v_agency,'close_books')
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Saving a contract rule automatically versions any existing active rule
-- when the user starts a new version without explicitly passing its id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_agency_contract_rule_atomic(
  p_rule_id uuid,
  p_agency_id uuid,
  p_property_landlord_id uuid,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v jsonb:=COALESCE(p_payload,'{}'::jsonb); v_id uuid; v_prop uuid; v_rule_date date;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'manage_contract_rules') THEN RAISE EXCEPTION 'Agency contract configuration permission required' USING ERRCODE='42501'; END IF;
  IF NOT public.can_manage_agency_property(p_agency_id,p_property_landlord_id) THEN RAISE EXCEPTION 'Property/client relationship is outside this Agency' USING ERRCODE='42501'; END IF;
  SELECT property_id INTO v_prop FROM public.property_landlords WHERE id=p_property_landlord_id;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Agency client relationship not found' USING ERRCODE='P0002'; END IF;
  v_rule_date:=COALESCE(NULLIF(v->>'effective_from','')::date,CURRENT_DATE);
  IF COALESCE(v->>'collection_destination','agency') NOT IN ('agency','landlord','tenant_direct','external','split') THEN RAISE EXCEPTION 'Invalid collection destination'; END IF;

  IF p_rule_id IS NOT NULL THEN
    UPDATE public.agency_contract_rules
    SET status='superseded', effective_to=LEAST(COALESCE(effective_to,v_rule_date-1),v_rule_date-1), updated_by=auth.uid(), updated_at=now()
    WHERE id=p_rule_id AND agency_id=p_agency_id AND property_landlord_id=p_property_landlord_id AND status='active';
  ELSE
    UPDATE public.agency_contract_rules
    SET status='superseded', effective_to=LEAST(COALESCE(effective_to,v_rule_date-1),v_rule_date-1), updated_by=auth.uid(), updated_at=now()
    WHERE agency_id=p_agency_id AND property_landlord_id=p_property_landlord_id AND status='active';
  END IF;

  INSERT INTO public.agency_contract_rules(
    agency_id,property_landlord_id,contract_name,status,effective_from,effective_to,collection_destination,service_model,
    management_modules,financial_modules,payment_rules,enforcement_rules,settlement_rules,approval_rules,notes,created_by,updated_by
  ) VALUES (
    p_agency_id,p_property_landlord_id,COALESCE(NULLIF(trim(v->>'contract_name'),''),'Client operating agreement'),'active',
    v_rule_date,NULLIF(v->>'effective_to','')::date,COALESCE(v->>'collection_destination','agency'),NULLIF(trim(v->>'service_model'),''),
    COALESCE(v->'management_modules','{}'::jsonb),COALESCE(v->'financial_modules','{}'::jsonb),COALESCE(v->'payment_rules','{}'::jsonb),
    COALESCE(v->'enforcement_rules','{}'::jsonb),COALESCE(v->'settlement_rules','{}'::jsonb),COALESCE(v->'approval_rules','{}'::jsonb),
    NULLIF(trim(COALESCE(v->>'notes','')),''),auth.uid(),auth.uid()
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'property_id',v_prop);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Agency financial breakdown scoped to Agency-linked properties only.
-- Invoice-level payments are allocated proportionally to charge lines so Rent,
-- Water, Security, Garbage, Service Charge, etc. reconcile to real cash.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_financial_breakdown(
  p_agency_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_agency uuid:=p_agency_id; v_manager uuid;
BEGIN
  IF NOT (public.can_manage_agency_admin(v_agency,'view_financials') OR public.can_manage_agency_admin(v_agency,'close_books')) THEN RAISE EXCEPTION 'Agency financial access denied' USING ERRCODE='42501'; END IF;
  SELECT manager_id INTO v_manager FROM public.agencies WHERE id=v_agency;
  RETURN jsonb_build_object(
    'agency_id',v_agency,'period_start',p_period_start,'period_end',p_period_end,
    'rows',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'charge_type',x.charge_type,'label',x.label,'billed',round(x.billed,2),'collected',round(x.collected,2),
        'outstanding',round(GREATEST(x.billed-x.collected,0),2),'external_confirmed',round(x.external_confirmed,2),
        'expenses',round(x.expenses,2),'net',round(x.collected+x.external_confirmed-x.expenses,2)
      ) ORDER BY x.category_order,x.label)
      FROM (
        SELECT li.charge_type,COALESCE(NULLIF(max(li.charge_label),''),initcap(replace(li.charge_type,'_',' '))) label,
               SUM(CASE WHEN i.created_at::date BETWEEN p_period_start AND p_period_end THEN li.amount ELSE 0 END)::numeric billed,
               SUM(COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' WHERE pa.invoice_id=i.id AND pa.created_at::date BETWEEN p_period_start AND p_period_end),0)
                 * CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END)::numeric collected,
               0::numeric external_confirmed,0::numeric expenses,10 category_order
        FROM public.invoice_line_items li
        JOIN public.invoices i ON i.id=li.invoice_id AND i.status<>'cancelled'
        JOIN LATERAL (SELECT SUM(il2.amount)::numeric line_total FROM public.invoice_line_items il2 WHERE il2.invoice_id=i.id) inv ON true
        WHERE i.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=v_agency AND (a.manager_id=pl.manager_id OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=v_agency))))
        GROUP BY li.charge_type
        UNION ALL
        SELECT 'expense:'||e.category,initcap(replace(e.category,'_',' ')),0,0,0,SUM(e.amount),50
        FROM public.expenditures e
        WHERE e.manager_id=v_manager
          AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
          AND (e.property_id IS NULL OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=v_agency AND (a.manager_id=pl.manager_id OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=v_agency)))))
        GROUP BY e.category
        UNION ALL
        SELECT 'external:'||COALESCE(e.payment_method,'external'),initcap(replace(COALESCE(e.payment_method,'external'),'_',' ')),0,0,SUM(e.reported_amount),0,30
        FROM public.agency_payment_evidence e
        WHERE e.agency_id=v_agency AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end
        GROUP BY COALESCE(e.payment_method,'external')
      ) x
    ),'[]'::jsonb),
    'totals',jsonb_build_object(
      'billed',COALESCE((SELECT SUM(COALESCE(i.original_amount,i.amount)) FROM public.invoices i WHERE i.manager_id=v_manager AND i.created_at::date BETWEEN p_period_start AND p_period_end AND i.status<>'cancelled' AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND (pl.agency_service_model IS NOT NULL OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=v_agency)))),0),
      'collected',COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' JOIN public.invoices i ON i.id=pa.invoice_id WHERE pa.manager_id=v_manager AND pa.created_at::date BETWEEN p_period_start AND p_period_end AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=v_agency))),0),
      'external_confirmed',COALESCE((SELECT SUM(e.reported_amount) FROM public.agency_payment_evidence e WHERE e.agency_id=v_agency AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end),0),
      'expenses',COALESCE((SELECT SUM(e.amount) FROM public.expenditures e WHERE e.manager_id=v_manager AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end AND (e.property_id IS NULL OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager))),0)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Excel-compatible detailed ledger, using the same Agency property scope.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_financial_ledger(
  p_agency_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_manager uuid;
BEGIN
  IF NOT (public.can_manage_agency_admin(p_agency_id,'view_financials') OR public.can_manage_agency_admin(p_agency_id,'close_books')) THEN RAISE EXCEPTION 'Agency financial access denied' USING ERRCODE='42501'; END IF;
  SELECT manager_id INTO v_manager FROM public.agencies WHERE id=p_agency_id;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.event_date,x.reference)
    FROM (
      SELECT i.created_at::date event_date,'invoice'::text event_type,i.invoice_number reference,COALESCE(t.name,'Tenant') counterparty,
             COALESCE(li.charge_label,initcap(replace(li.charge_type,'_',' '))) category,li.amount billed,0::numeric collected,0::numeric external_confirmed,0::numeric expense,i.id source_id
      FROM public.invoice_line_items li
      JOIN public.invoices i ON i.id=li.invoice_id AND i.status<>'cancelled'
      LEFT JOIN public.tenants t ON t.id=i.tenant_id
      WHERE i.manager_id=v_manager AND i.created_at::date BETWEEN p_period_start AND p_period_end
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))
      UNION ALL
      SELECT pa.created_at::date,'payment',COALESCE(pt.bank_reference,pt.mpesa_receipt_number,pt.id::text),COALESCE(t.name,'Tenant'),
             COALESCE(li.charge_label,initcap(replace(li.charge_type,'_',' '))),0,
             round(pa.allocated_amount*CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END,2),0,0,pa.id
      FROM public.payment_allocations pa
      JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed'
      JOIN public.invoices i ON i.id=pa.invoice_id
      LEFT JOIN public.tenants t ON t.id=pa.tenant_id
      JOIN public.invoice_line_items li ON li.invoice_id=i.id
      JOIN LATERAL (SELECT SUM(il2.amount)::numeric line_total FROM public.invoice_line_items il2 WHERE il2.invoice_id=i.id) inv ON true
      WHERE pa.manager_id=v_manager AND pa.created_at::date BETWEEN p_period_start AND p_period_end
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))
      UNION ALL
      SELECT e.payment_date,'external',COALESCE(e.reference,e.id::text),COALESCE(e.payer_name,'External'),COALESCE(e.payment_method,'external'),0,0,e.reported_amount,0,e.id
      FROM public.agency_payment_evidence e WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end
      UNION ALL
      SELECT to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD'),'expense',e.id::text,'Expense',initcap(replace(e.category,'_',' ')),0,0,0,e.amount,e.id
      FROM public.expenditures e
      WHERE e.manager_id=v_manager AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
        AND (e.property_id IS NULL OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)))
    ) x
  ),'[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_operations_config(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_agency_contract_rule_atomic(uuid,uuid,uuid,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_financial_breakdown(uuid,date,date) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_financial_ledger(uuid,date,date) TO authenticated,service_role;
