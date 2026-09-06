-- CALQULUS PMS — Agency external settlement + financial control hardening
-- Purpose: let Agencies record/verify payments that were paid outside Agency cash,
-- settle the tenant invoice without double-counting Agency cash, and maintain
-- configurable permissions/period controls.

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS agency_evidence_id uuid
  REFERENCES public.agency_payment_evidence(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payment_transactions_agency_evidence_idx
  ON public.payment_transactions(agency_evidence_id)
  WHERE agency_evidence_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 1. Consistent viewer permissions for Agency settings.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_operations_config(p_agency_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_agency uuid:=COALESCE(p_agency_id,public.agency_id_for_user());
  v_uid uuid:=auth.uid();
BEGIN
  IF v_agency IS NULL THEN RAISE EXCEPTION 'Agency not found' USING ERRCODE='P0002'; END IF;
  IF NOT (
    public.can_manage_agency_admin(v_agency,'view_settings')
    OR public.can_manage_agency_admin(v_agency,'view_financials')
    OR public.can_manage_agency_admin(v_agency,'manage_contract_rules')
    OR public.can_manage_agency_admin(v_agency,'manage_billing_rules')
    OR public.can_manage_agency_admin(v_agency,'manage_team')
  ) THEN
    RAISE EXCEPTION 'Agency access denied' USING ERRCODE='42501';
  END IF;

  RETURN jsonb_build_object(
    'agency_id',v_agency,
    'contract_rules',COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.effective_from DESC,r.created_at DESC)
      FROM public.agency_contract_rules r
      WHERE r.agency_id=v_agency AND r.status='active'
    ),'[]'::jsonb),
    'charge_catalog',COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.display_order,c.label)
      FROM public.agency_charge_catalog c
      WHERE c.agency_id=v_agency
    ),'[]'::jsonb),
    'members',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',am.id,
        'member_user_id',am.member_user_id,
        'role_in_agency',am.role_in_agency,
        'permissions',am.permissions,
        'is_active',am.is_active
      ) ORDER BY am.joined_at)
      FROM public.agency_members am
      WHERE am.agency_id=v_agency
    ),'[]'::jsonb),
    'defaults',COALESCE((
      SELECT config FROM public.agency_operating_defaults WHERE agency_id=v_agency
    ),jsonb_build_object(
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
    'viewer',jsonb_build_object(
      'user_id',v_uid,
      'is_admin',public.can_manage_agency_admin(v_agency,'manage_settings'),
      'can_manage_settings',public.can_manage_agency_admin(v_agency,'manage_settings'),
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
-- 2. Review evidence atomically.
-- Agency-collected evidence becomes an Agency cash transaction.
-- External/direct evidence becomes an external-settlement transaction linked
-- to the evidence record, so invoices are settled but Agency cash is not
-- double-counted in Agency financial reports.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_agency_payment_evidence_atomic(
  p_evidence_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  e public.agency_payment_evidence%ROWTYPE;
  v_manager uuid;
  v_tx uuid;
  v_alloc numeric:=0;
  v_balance numeric;
  v_credit_after numeric:=0;
  v_excess numeric:=0;
  v_property uuid;
  v_unit uuid;
  v_status text;
BEGIN
  SELECT * INTO e FROM public.agency_payment_evidence WHERE id=p_evidence_id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Evidence not found' USING ERRCODE='P0002'; END IF;
  IF NOT public.can_manage_agency_admin(e.agency_id,'verify_payment_evidence') THEN
    RAISE EXCEPTION 'Agency verification permission required' USING ERRCODE='42501';
  END IF;
  IF e.status NOT IN ('pending','needs_review') THEN
    RETURN jsonb_build_object('ok',true,'idempotent',true,'status',e.status);
  END IF;
  IF p_decision NOT IN ('accepted','rejected','needs_review') THEN
    RAISE EXCEPTION 'Invalid evidence decision';
  END IF;

  IF p_decision='rejected' THEN
    UPDATE public.agency_payment_evidence
       SET status='rejected',
           discrepancy_amount=COALESCE(expected_amount,0)-reported_amount,
           review_notes=left(trim(COALESCE(p_reason,'')),500),
           reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
     WHERE id=e.id;
    RETURN jsonb_build_object('ok',true,'status','rejected');
  ELSIF p_decision='needs_review' THEN
    UPDATE public.agency_payment_evidence
       SET status='needs_review',
           discrepancy_amount=COALESCE(expected_amount,0)-reported_amount,
           review_notes=left(trim(COALESCE(p_reason,'')),500),
           reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
     WHERE id=e.id;
    RETURN jsonb_build_object('ok',true,'status','needs_review');
  END IF;

  SELECT a.manager_id INTO v_manager FROM public.agencies a WHERE a.id=e.agency_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Agency manager not found' USING ERRCODE='P0002'; END IF;

  IF e.invoice_id IS NOT NULL THEN
    SELECT i.property_id,i.unit_id,i.balance_due
      INTO v_property,v_unit,v_balance
      FROM public.invoices i
     WHERE i.id=e.invoice_id
     FOR UPDATE;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'Invoice not found or not associated with this evidence'; END IF;
    IF e.tenant_id IS NULL THEN
      SELECT i.tenant_id INTO e.tenant_id FROM public.invoices i WHERE i.id=e.invoice_id;
    END IF;
  ELSE
    v_property:=e.property_id;
    v_unit:=e.unit_id;
  END IF;

  IF e.destination_type='agency' THEN
    IF e.invoice_id IS NULL OR e.tenant_id IS NULL THEN
      RAISE EXCEPTION 'Agency-collected evidence requires tenant and invoice';
    END IF;
    IF NOT public.agency_service_capability(COALESCE(v_property,e.property_id),'collect') THEN
      RAISE EXCEPTION 'Agency contract does not permit collection for this property' USING ERRCODE='42501';
    END IF;
  END IF;

  -- If tied to an invoice, create a completed transaction so the normal payment
  -- lifecycle remains the source of truth for invoice balance and allocations.
  IF e.invoice_id IS NOT NULL THEN
    INSERT INTO public.payment_transactions(
      tenant_id,manager_id,unit_id,property_id,amount,payment_type,payment_method,
      phone_number,bank_reference,status,initiated_at,completed_at,recorded_by,
      notes,agency_evidence_id
    ) VALUES (
      e.tenant_id,v_manager,v_unit,v_property,round(e.reported_amount,2),e.payment_method,
      e.payment_method,'',e.reference,'completed',now(),now(),auth.uid(),
      CASE WHEN e.destination_type='agency' THEN 'Agency evidence accepted'
           ELSE 'External settlement evidence accepted' END,
      CASE WHEN e.destination_type='agency' THEN NULL ELSE e.id END
    ) RETURNING id INTO v_tx;

    SELECT public.process_invoice_payment(e.invoice_id,v_tx,e.reported_amount) INTO v_alloc;

    v_excess:=round(GREATEST(e.reported_amount-COALESCE(v_alloc,0),0),2);
    IF v_excess>0 AND e.tenant_id IS NOT NULL THEN
      SELECT COALESCE((
        SELECT balance_after FROM public.tenant_credit_ledger
         WHERE tenant_id=e.tenant_id
         ORDER BY created_at DESC,id DESC LIMIT 1
      ),0) INTO v_credit_after;
      v_credit_after:=round(v_credit_after+v_excess,2);
      INSERT INTO public.tenant_credit_ledger(
        tenant_id,manager_id,property_id,transaction_id,invoice_id,entry_type,amount,balance_after,description
      ) VALUES (
        e.tenant_id,v_manager,v_property,v_tx,e.invoice_id,'credit',v_excess,v_credit_after,
        CASE WHEN e.destination_type='agency' THEN 'Advance payment credit from Agency-verified evidence'
             ELSE 'Advance payment credit from externally verified evidence' END
      );
    END IF;

    UPDATE public.payment_transactions
       SET allocated_amount=round(COALESCE(v_alloc,0),2),
           is_partial=(COALESCE(v_alloc,0) < e.reported_amount),
           is_advance=(v_excess>0),
           credit_amount=v_excess,
           updated_at=now()
     WHERE id=v_tx;

    -- Canonical in-app receipt for payments actually collected by the Agency.
    IF e.destination_type='agency' THEN
      PERFORM public.issue_payment_receipt_atomic(v_tx);
    END IF;
  END IF;

  v_status:='accepted';
  UPDATE public.agency_payment_evidence
     SET status=v_status,
         discrepancy_amount=round(COALESCE(expected_amount,reported_amount)-reported_amount,2),
         review_notes=left(trim(COALESCE(p_reason,'')),500),
         reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
   WHERE id=e.id;

  RETURN jsonb_build_object(
    'ok',true,
    'status',v_status,
    'transaction_id',v_tx,
    'allocated_amount',round(COALESCE(v_alloc,0),2),
    'credit_amount',v_excess,
    'external',(e.destination_type<>'agency')
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Prevent evidence from being posted into a closed period. Corrections are
-- allowed only after an explicit Agency-admin reopen.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_agency_payment_evidence_atomic(
  p_agency_id uuid,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v jsonb:=COALESCE(p_payload,'{}'::jsonb);
  v_id uuid;
  v_payment_date date:=COALESCE(NULLIF(v->>'payment_date','')::date,CURRENT_DATE);
  v_invoice uuid:=NULLIF(v->>'invoice_id','')::uuid;
  v_expected numeric:=NULL;
  v_prop uuid:=NULLIF(v->>'property_id','')::uuid;
  v_unit uuid:=NULLIF(v->>'unit_id','')::uuid;
  v_tenant uuid:=NULLIF(v->>'tenant_id','')::uuid;
  v_destination text:=COALESCE(NULLIF(v->>'destination_type',''),'agency');
  v_source text:=COALESCE(NULLIF(v->>'source_type',''),'agent_manual');
  v_closed boolean:=false;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'record_payments') THEN
    RAISE EXCEPTION 'Agency payment recording permission required' USING ERRCODE='42501';
  END IF;
  IF v_destination NOT IN ('agency','landlord','tenant_direct','external','split') THEN RAISE EXCEPTION 'Invalid destination'; END IF;
  IF v_source NOT IN ('agent_manual','tenant_upload','bank_statement','external_consolidation','landlord_confirmation') THEN RAISE EXCEPTION 'Invalid evidence source'; END IF;

  IF v_invoice IS NOT NULL THEN
    SELECT i.balance_due,i.property_id,i.unit_id,i.tenant_id
      INTO v_expected,v_prop,v_unit,v_tenant
      FROM public.invoices i WHERE i.id=v_invoice;
    IF v_expected IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
    v_expected:=round(GREATEST(v_expected,0),2);
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.agency_financial_periods p
    WHERE p.agency_id=p_agency_id
      AND p.period_start<=v_payment_date
      AND p.period_end>=v_payment_date
      AND p.status='closed'
  ) INTO v_closed;
  IF v_closed THEN
    RAISE EXCEPTION 'This financial period is closed. Reopen the period before posting a correction.' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.agency_payment_evidence(
    agency_id,property_id,unit_id,tenant_id,invoice_id,reported_amount,payment_date,
    payment_method,reference,payer_name,destination_type,source_type,proof_url,notes,
    expected_amount,discrepancy_amount,status,created_by,created_at,updated_at
  ) VALUES (
    p_agency_id,v_prop,v_unit,v_tenant,v_invoice,round((v->>'reported_amount')::numeric,2),v_payment_date,
    COALESCE(NULLIF(trim(v->>'payment_method'),''),'other'),NULLIF(trim(v->>'reference'),''),
    NULLIF(trim(v->>'payer_name'),''),v_destination,v_source,NULLIF(trim(v->>'proof_url'),''),
    NULLIF(trim(v->>'notes'),''),v_expected,
    CASE WHEN v_expected IS NULL THEN 0 ELSE round(v_expected-(v->>'reported_amount')::numeric,2) END,
    'pending',auth.uid(),now(),now()
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'expected_amount',v_expected,'discrepancy_amount',CASE WHEN v_expected IS NULL THEN 0 ELSE round(v_expected-(v->>'reported_amount')::numeric,2) END);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reopen a period explicitly, preserving the reason in the row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reopen_agency_financial_period_atomic(
  p_agency_id uuid,
  p_period_start date,
  p_period_end date,
  p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'close_books') THEN
    RAISE EXCEPTION 'Agency close-books permission required' USING ERRCODE='42501';
  END IF;
  IF NULLIF(trim(COALESCE(p_reason,'')),'') IS NULL THEN
    RAISE EXCEPTION 'A reopen reason is required';
  END IF;
  UPDATE public.agency_financial_periods
     SET status='reopened',reopen_reason=left(trim(p_reason),500),updated_at=now()
   WHERE agency_id=p_agency_id AND period_start=p_period_start AND period_end=p_period_end AND status='closed'
   RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Closed Agency period not found' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('ok',true,'id',v_id,'status','reopened');
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_agency_financial_period_atomic(uuid,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reopen_agency_financial_period_atomic(uuid,date,date,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.review_agency_payment_evidence_atomic(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_agency_payment_evidence_atomic(uuid,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_operations_config(uuid) TO authenticated,service_role;

-- ---------------------------------------------------------------------------
-- 5. Financial breakdown: cash collected and externally confirmed are distinct.
-- External evidence tied to an invoice settles the invoice but never counts as
-- Agency cash. Legacy invoices without line items appear as Unclassified so
-- totals do not disappear from the Agency workbench.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_financial_breakdown(
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

  RETURN jsonb_build_object(
    'agency_id',p_agency_id,
    'period_start',p_period_start,
    'period_end',p_period_end,
    'rows',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'charge_type',x.charge_type,
        'label',x.label,
        'billed',round(x.billed,2),
        'collected',round(x.collected,2),
        'outstanding',round(GREATEST(x.billed-x.collected-x.external_confirmed,0),2),
        'external_confirmed',round(x.external_confirmed,2),
        'expenses',round(x.expenses,2),
        'net',round(x.collected+x.external_confirmed-x.expenses,2)
      ) ORDER BY x.category_order,x.label)
      FROM (
        SELECT
          li.charge_type,
          COALESCE(NULLIF(max(li.charge_label),''),initcap(replace(li.charge_type,'_',' '))) label,
          SUM(CASE WHEN i.created_at::date BETWEEN p_period_start AND p_period_end THEN li.amount ELSE 0 END)::numeric billed,
          SUM(COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL WHERE pa.invoice_id=i.id AND pa.created_at::date BETWEEN p_period_start AND p_period_end),0) * CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END)::numeric collected,
          SUM(COALESCE((SELECT SUM(e.reported_amount) FROM public.agency_payment_evidence e WHERE e.invoice_id=i.id AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end),0) * CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END)::numeric external_confirmed,
          0::numeric expenses,
          10 category_order
        FROM public.invoice_line_items li
        JOIN public.invoices i ON i.id=li.invoice_id AND i.status<>'cancelled'
        JOIN LATERAL (SELECT COALESCE(SUM(il2.amount),0)::numeric line_total FROM public.invoice_line_items il2 WHERE il2.invoice_id=i.id) inv ON true
        WHERE i.manager_id=v_manager
          AND i.created_at::date BETWEEN p_period_start AND p_period_end
          AND EXISTS (
            SELECT 1 FROM public.property_landlords pl
            WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager
              AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)
          )
        GROUP BY li.charge_type

        UNION ALL

        SELECT
          'unclassified'::text,
          'Unclassified invoice'::text,
          SUM(COALESCE(i.original_amount,i.amount))::numeric,
          SUM(COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL WHERE pa.invoice_id=i.id AND pa.created_at::date BETWEEN p_period_start AND p_period_end),0))::numeric,
          SUM(COALESCE((SELECT SUM(e.reported_amount) FROM public.agency_payment_evidence e WHERE e.invoice_id=i.id AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end),0))::numeric,
          0::numeric,
          20
        FROM public.invoices i
        WHERE i.manager_id=v_manager
          AND i.status<>'cancelled'
          AND i.created_at::date BETWEEN p_period_start AND p_period_end
          AND NOT EXISTS (SELECT 1 FROM public.invoice_line_items li WHERE li.invoice_id=i.id)
          AND EXISTS (
            SELECT 1 FROM public.property_landlords pl
            WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager
              AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)
          )

        UNION ALL

        SELECT
          'external:'||COALESCE(e.payment_method,'external'),
          'External · '||initcap(replace(COALESCE(e.payment_method,'external'),'_',' ')),
          0::numeric,
          0::numeric,
          SUM(e.reported_amount)::numeric,
          0::numeric,
          30
        FROM public.agency_payment_evidence e
        WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency'
          AND e.invoice_id IS NULL
          AND e.payment_date BETWEEN p_period_start AND p_period_end
        GROUP BY COALESCE(e.payment_method,'external')

        UNION ALL

        SELECT
          'expense:'||e.category,
          initcap(replace(e.category,'_',' ')),
          0::numeric,0::numeric,0::numeric,
          SUM(e.amount)::numeric,
          50
        FROM public.expenditures e
        WHERE e.manager_id=v_manager
          AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
          AND (e.property_id IS NULL OR EXISTS (
            SELECT 1 FROM public.property_landlords pl
            WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager
              AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)
          ))
        GROUP BY e.category
      ) x
    ),'[]'::jsonb),
    'totals',jsonb_build_object(
      'billed',COALESCE((
        SELECT SUM(COALESCE(i.original_amount,i.amount)) FROM public.invoices i
        WHERE i.manager_id=v_manager AND i.status<>'cancelled'
          AND i.created_at::date BETWEEN p_period_start AND p_period_end
          AND EXISTS (
            SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager
              AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)
          )
      ),0),
      'collected',COALESCE((
        SELECT SUM(pa.allocated_amount)
        FROM public.payment_allocations pa
        JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL
        JOIN public.invoices i ON i.id=pa.invoice_id
        WHERE pa.manager_id=v_manager AND pa.created_at::date BETWEEN p_period_start AND p_period_end
          AND EXISTS (
            SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager
              AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)
          )
      ),0),
      'external_confirmed',COALESCE((
        SELECT SUM(e.reported_amount) FROM public.agency_payment_evidence e
        WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency'
          AND e.payment_date BETWEEN p_period_start AND p_period_end
      ),0),
      'expenses',COALESCE((
        SELECT SUM(e.amount) FROM public.expenditures e
        WHERE e.manager_id=v_manager
          AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
          AND (e.property_id IS NULL OR EXISTS (
            SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager
              AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)
          ))
      ),0)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Excel-friendly event ledger. External settlement transactions are kept
-- out of Agency cash and are represented by the evidence event instead.
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
      SELECT i.created_at::date event_date,'invoice'::text event_type,i.invoice_number reference,
             COALESCE(t.name,'Tenant') counterparty,COALESCE(li.charge_label,initcap(replace(li.charge_type,'_',' '))) category,
             li.amount billed,0::numeric collected,0::numeric external_confirmed,0::numeric expense,
             NULL::text destination,NULL::text source_type,i.id source_id
      FROM public.invoice_line_items li
      JOIN public.invoices i ON i.id=li.invoice_id AND i.status<>'cancelled'
      LEFT JOIN public.tenants t ON t.id=i.tenant_id
      WHERE i.manager_id=v_manager AND i.created_at::date BETWEEN p_period_start AND p_period_end
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

      UNION ALL

      SELECT i.created_at::date,'invoice','UNCLASSIFIED-'||i.invoice_number,COALESCE(t.name,'Tenant'),'Unclassified invoice',
             COALESCE(i.original_amount,i.amount),0,0,0,NULL,NULL,i.id
      FROM public.invoices i
      LEFT JOIN public.tenants t ON t.id=i.tenant_id
      WHERE i.manager_id=v_manager AND i.status<>'cancelled' AND i.created_at::date BETWEEN p_period_start AND p_period_end
        AND NOT EXISTS (SELECT 1 FROM public.invoice_line_items li WHERE li.invoice_id=i.id)
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

      UNION ALL

      SELECT pa.created_at::date,'payment',COALESCE(pt.bank_reference,pt.mpesa_receipt_number,pt.id::text),COALESCE(t.name,'Tenant'),
             COALESCE((SELECT max(li.charge_label) FROM public.invoice_line_items li WHERE li.invoice_id=i.id),'Invoice payment'),
             0,pa.allocated_amount,0,0,NULL,NULL,pa.id
      FROM public.payment_allocations pa
      JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL
      JOIN public.invoices i ON i.id=pa.invoice_id
      LEFT JOIN public.tenants t ON t.id=pa.tenant_id
      WHERE pa.manager_id=v_manager AND pa.created_at::date BETWEEN p_period_start AND p_period_end
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

      UNION ALL

      SELECT e.payment_date,'external_settlement',COALESCE(e.reference,e.id::text),COALESCE(e.payer_name,'External'),
             COALESCE((SELECT max(li.charge_label) FROM public.invoice_line_items li WHERE li.invoice_id=e.invoice_id),'External payment'),
             0,0,e.reported_amount,0,e.destination_type,e.source_type,e.id
      FROM public.agency_payment_evidence e
      WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end

      UNION ALL

      SELECT to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD'),'expense',e.id::text,'Expense',
             initcap(replace(e.category,'_',' ')),0,0,0,e.amount,NULL,'expense',e.id
      FROM public.expenditures e
      WHERE e.manager_id=v_manager
        AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
        AND (e.property_id IS NULL OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)))
    ) x
  ),'[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_financial_breakdown(uuid,date,date) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_financial_ledger(uuid,date,date) TO authenticated,service_role;

-- ---------------------------------------------------------------------------
-- 7. Property-scope helper: an Agency may only operate on properties that are
-- explicitly attached to it (direct agency property or manager-profile link).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agency_property_in_scope(p_agency_id uuid,p_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id=p_property_id AND p.agency_id=p_agency_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.property_landlords pl
    WHERE pl.property_id=p_property_id
      AND EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id=p_agency_id
          AND (a.manager_id=pl.manager_id OR EXISTS (
            SELECT 1 FROM public.manager_profiles mp
            WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id
          ))
      )
  );
$$;
REVOKE ALL ON FUNCTION public.agency_property_in_scope(uuid,uuid) FROM PUBLIC,anon;

-- ---------------------------------------------------------------------------
-- 8. Contract-defined split destination percentage. A split is deliberately
-- explicit: missing percentages are invalid rather than silently guessed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agency_split_collection_percent(
  p_agency_id uuid,
  p_property_landlord_id uuid DEFAULT NULL,
  p_property_id uuid DEFAULT NULL
) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE
    WHEN COALESCE(r.settlement_rules->>'collection_split_agency_percent','') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN LEAST(GREATEST((r.settlement_rules->>'collection_split_agency_percent')::numeric,0),100)
    ELSE NULL
  END
  FROM public.agency_contract_rules r
  LEFT JOIN public.property_landlords pl ON pl.id=r.property_landlord_id
  WHERE r.agency_id=p_agency_id
    AND r.status='active'
    AND r.effective_from<=CURRENT_DATE
    AND (r.effective_to IS NULL OR r.effective_to>=CURRENT_DATE)
    AND (
      (p_property_landlord_id IS NOT NULL AND r.property_landlord_id=p_property_landlord_id)
      OR (p_property_landlord_id IS NULL AND p_property_id IS NOT NULL AND pl.property_id=p_property_id)
    )
  ORDER BY r.effective_from DESC,r.updated_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.agency_split_collection_percent(uuid,uuid,uuid) FROM PUBLIC,anon;

-- ---------------------------------------------------------------------------
-- 9. Fine-grained Agency capability: no relationship means no capability.
-- Direct agency-owned properties remain compatible with legacy agency setups.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agency_service_capability(
  p_property_id uuid,
  p_action text
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_agency uuid;
  v_link public.property_landlords%ROWTYPE;
  v_rule public.agency_contract_rules%ROWTYPE;
  v_model text;
  v_modules jsonb;
  v_payment jsonb;
  v_enforcement jsonb;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN RETURN false; END IF;
  SELECT public.agency_id_for_user(v_uid) INTO v_agency;
  IF v_agency IS NULL OR NOT public.agency_property_in_scope(v_agency,p_property_id) THEN RETURN false; END IF;

  SELECT pl.* INTO v_link
  FROM public.property_landlords pl
  WHERE pl.property_id=p_property_id
    AND (
      EXISTS (SELECT 1 FROM public.agencies a WHERE a.id=v_agency AND a.manager_id=pl.manager_id)
      OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=v_agency)
    )
  ORDER BY pl.updated_at DESC
  LIMIT 1;

  -- Direct agency-owned/legacy relationship with no property_landlords row.
  IF v_link.id IS NULL THEN RETURN true; END IF;

  SELECT r.* INTO v_rule
  FROM public.agency_contract_rules r
  WHERE r.agency_id=v_agency
    AND r.property_landlord_id=v_link.id
    AND r.status='active'
    AND r.effective_from<=CURRENT_DATE
    AND (r.effective_to IS NULL OR r.effective_to>=CURRENT_DATE)
  ORDER BY r.effective_from DESC,r.updated_at DESC
  LIMIT 1;

  IF v_rule.id IS NULL THEN
    v_model:=COALESCE(v_link.agency_service_model,public.agency_service_model_from_operating_model(v_link.operating_model));
    IF v_model IS NULL THEN RETURN true; END IF;
    IF p_action IN ('view','financial','tenant_contact','reports') THEN RETURN true; END IF;
    IF p_action='collect' THEN RETURN v_model<>'collections_enforcement_only' OR COALESCE(v_link.payment_destination,'agency')='agency'; END IF;
    IF p_action IN ('enforce','payment_arrangement') THEN RETURN true; END IF;
    RETURN v_model IN ('full_management','managed_direct_landlord_collection')
      AND p_action IN ('property_write','unit_write','lease_write','tenant_write','maintenance_write','caretaker_write');
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
  IF p_action='enforce' THEN RETURN COALESCE((v_enforcement->>'enabled')::boolean,true); END IF;
  IF p_action='payment_arrangement' THEN RETURN COALESCE((v_payment->>'allow_payment_arrangements')::boolean,false); END IF;
  IF p_action IN ('view','financial','tenant_contact','reports') THEN RETURN true; END IF;

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

GRANT EXECUTE ON FUNCTION public.agency_service_capability(uuid,text) TO authenticated,service_role;

-- ---------------------------------------------------------------------------
-- 10. Contract rule save with explicit split validation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_agency_contract_rule_atomic(
  p_rule_id uuid,
  p_agency_id uuid,
  p_property_landlord_id uuid,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v jsonb:=COALESCE(p_payload,'{}'::jsonb);
  v_id uuid;
  v_prop uuid;
  v_destination text:=COALESCE(NULLIF(trim(v->>'collection_destination'),''),'agency');
  v_effective date:=COALESCE(NULLIF(v->>'effective_from','')::date,CURRENT_DATE);
  v_agency_pct numeric;
  v_external_pct numeric;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'manage_contract_rules') THEN RAISE EXCEPTION 'Agency contract configuration permission required' USING ERRCODE='42501'; END IF;
  IF NOT public.can_manage_agency_property(p_agency_id,p_property_landlord_id) THEN RAISE EXCEPTION 'Property/client relationship is outside this Agency' USING ERRCODE='42501'; END IF;
  SELECT property_id INTO v_prop FROM public.property_landlords WHERE id=p_property_landlord_id;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Agency client relationship not found' USING ERRCODE='P0002'; END IF;
  IF v_destination NOT IN ('agency','landlord','tenant_direct','external','split') THEN RAISE EXCEPTION 'Invalid collection destination'; END IF;

  IF v_destination='split' THEN
    v_agency_pct:=NULLIF(trim(COALESCE(v->'settlement_rules'->>'collection_split_agency_percent','')),'')::numeric;
    v_external_pct:=NULLIF(trim(COALESCE(v->'settlement_rules'->>'collection_split_external_percent','')),'')::numeric;
    IF v_agency_pct IS NULL OR v_external_pct IS NULL OR v_agency_pct<=0 OR v_agency_pct>=100 OR abs((v_agency_pct+v_external_pct)-100)>0.01 THEN
      RAISE EXCEPTION 'Split collection requires valid Agency and outside percentages totaling 100';
    END IF;
  END IF;

  IF p_rule_id IS NOT NULL THEN
    UPDATE public.agency_contract_rules
       SET status='superseded',
           effective_to=LEAST(COALESCE(effective_to,v_effective-1),v_effective-1),
           updated_by=auth.uid(),updated_at=now()
     WHERE id=p_rule_id AND agency_id=p_agency_id AND property_landlord_id=p_property_landlord_id AND status='active';
  ELSE
    UPDATE public.agency_contract_rules
       SET status='superseded',
           effective_to=LEAST(COALESCE(effective_to,v_effective-1),v_effective-1),
           updated_by=auth.uid(),updated_at=now()
     WHERE agency_id=p_agency_id AND property_landlord_id=p_property_landlord_id AND status='active';
  END IF;

  INSERT INTO public.agency_contract_rules(
    agency_id,property_landlord_id,contract_name,status,effective_from,effective_to,collection_destination,service_model,
    management_modules,financial_modules,payment_rules,enforcement_rules,settlement_rules,approval_rules,notes,created_by,updated_by
  ) VALUES (
    p_agency_id,p_property_landlord_id,
    COALESCE(NULLIF(trim(v->>'contract_name'),''),'Client operating agreement'),
    'active',v_effective,NULLIF(v->>'effective_to','')::date,v_destination,NULLIF(trim(v->>'service_model'),''),
    COALESCE(v->'management_modules','{}'::jsonb),COALESCE(v->'financial_modules','{}'::jsonb),COALESCE(v->'payment_rules','{}'::jsonb),
    COALESCE(v->'enforcement_rules','{}'::jsonb),COALESCE(v->'settlement_rules','{}'::jsonb),COALESCE(v->'approval_rules','{}'::jsonb),
    NULLIF(trim(COALESCE(v->>'notes','')),''),auth.uid(),auth.uid()
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'property_id',v_prop,'collection_destination',v_destination);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_agency_contract_rule_atomic(uuid,uuid,uuid,jsonb) TO authenticated,service_role;

-- ---------------------------------------------------------------------------
-- 11. Submission must be scoped to an Agency property/client relationship and
-- must carry the relationship id so split contract rules can be resolved later.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_agency_payment_evidence_atomic(
  p_agency_id uuid,
  p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v jsonb:=COALESCE(p_payload,'{}'::jsonb);
  v_id uuid;
  v_payment_date date:=COALESCE(NULLIF(v->>'payment_date','')::date,CURRENT_DATE);
  v_invoice uuid:=NULLIF(v->>'invoice_id','')::uuid;
  v_expected numeric;
  v_prop uuid:=NULLIF(v->>'property_id','')::uuid;
  v_unit uuid:=NULLIF(v->>'unit_id','')::uuid;
  v_tenant uuid:=NULLIF(v->>'tenant_id','')::uuid;
  v_pl uuid;
  v_destination text:=COALESCE(NULLIF(v->>'destination_type',''),'agency');
  v_source text:=COALESCE(NULLIF(v->>'source_type',''),'agent_manual');
  v_amount numeric:=round((v->>'reported_amount')::numeric,2);
  v_closed boolean:=false;
  v_split numeric;
BEGIN
  IF NOT public.can_manage_agency_admin(p_agency_id,'record_payments') THEN RAISE EXCEPTION 'Agency payment recording permission required' USING ERRCODE='42501'; END IF;
  IF v_amount<=0 THEN RAISE EXCEPTION 'Reported amount must be greater than zero'; END IF;
  IF v_destination NOT IN ('agency','landlord','tenant_direct','external','split') THEN RAISE EXCEPTION 'Invalid destination'; END IF;
  IF v_source NOT IN ('agent_manual','tenant_upload','bank_statement','external_consolidation','landlord_confirmation') THEN RAISE EXCEPTION 'Invalid evidence source'; END IF;

  IF v_invoice IS NOT NULL THEN
    SELECT i.balance_due,i.property_id,i.unit_id,i.tenant_id INTO v_expected,v_prop,v_unit,v_tenant FROM public.invoices i WHERE i.id=v_invoice;
    IF v_expected IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
    v_expected:=round(GREATEST(v_expected,0),2);
  END IF;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Select a property or invoice'; END IF;
  IF NOT public.agency_property_in_scope(p_agency_id,v_prop) THEN RAISE EXCEPTION 'Property is outside this Agency'; END IF;

  SELECT pl.id INTO v_pl
  FROM public.property_landlords pl
  WHERE pl.property_id=v_prop
    AND EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id=p_agency_id AND (a.manager_id=pl.manager_id OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))
    )
  ORDER BY pl.updated_at DESC
  LIMIT 1;

  IF v_destination='split' THEN
    v_split:=public.agency_split_collection_percent(p_agency_id,v_pl,v_prop);
    IF v_split IS NULL OR v_split<=0 OR v_split>=100 THEN RAISE EXCEPTION 'Configure split Agency percentage on the active client contract before submitting split evidence'; END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.agency_financial_periods p
    WHERE p.agency_id=p_agency_id AND p.period_start<=v_payment_date AND p.period_end>=v_payment_date AND p.status='closed'
  ) INTO v_closed;
  IF v_closed THEN RAISE EXCEPTION 'This financial period is closed. Reopen the period before posting a correction.' USING ERRCODE='55000'; END IF;

  INSERT INTO public.agency_payment_evidence(
    agency_id,property_landlord_id,property_id,unit_id,tenant_id,invoice_id,reported_amount,payment_date,
    payment_method,reference,payer_name,destination_type,source_type,proof_url,notes,expected_amount,
    discrepancy_amount,status,created_by,created_at,updated_at
  ) VALUES (
    p_agency_id,v_pl,v_prop,v_unit,v_tenant,v_invoice,v_amount,v_payment_date,
    COALESCE(NULLIF(trim(v->>'payment_method'),''),'other'),NULLIF(trim(v->>'reference'),''),NULLIF(trim(v->>'payer_name'),''),
    v_destination,v_source,NULLIF(trim(v->>'proof_url'),''),NULLIF(trim(v->>'notes'),''),v_expected,
    CASE WHEN v_expected IS NULL THEN 0 ELSE round(v_expected-v_amount,2) END,
    'pending',auth.uid(),now(),now()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'expected_amount',v_expected,'discrepancy_amount',CASE WHEN v_expected IS NULL THEN 0 ELSE round(v_expected-v_amount,2) END,'property_landlord_id',v_pl);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_agency_payment_evidence_atomic(uuid,jsonb) TO authenticated,service_role;

-- ---------------------------------------------------------------------------
-- 12. Evidence review: external/direct payments settle invoices without being
-- counted as Agency cash; split evidence contributes its configured Agency
-- portion to Agency cash reporting and the remainder to outside-confirmed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_agency_payment_evidence_atomic(
  p_evidence_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  e public.agency_payment_evidence%ROWTYPE;
  v_manager uuid;
  v_tx uuid;
  v_alloc numeric:=0;
  v_balance numeric;
  v_excess numeric:=0;
  v_property uuid;
  v_unit uuid;
  v_split numeric:=0;
  v_agency_portion numeric:=0;
  v_external_portion numeric:=0;
BEGIN
  SELECT * INTO e FROM public.agency_payment_evidence WHERE id=p_evidence_id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Evidence not found' USING ERRCODE='P0002'; END IF;
  IF NOT public.can_manage_agency_admin(e.agency_id,'verify_payment_evidence') THEN RAISE EXCEPTION 'Agency verification permission required' USING ERRCODE='42501'; END IF;
  IF e.status NOT IN ('pending','needs_review') THEN RETURN jsonb_build_object('ok',true,'idempotent',true,'status',e.status); END IF;
  IF p_decision NOT IN ('accepted','rejected','needs_review') THEN RAISE EXCEPTION 'Invalid evidence decision'; END IF;

  IF p_decision='rejected' THEN
    UPDATE public.agency_payment_evidence SET status='rejected',discrepancy_amount=round(COALESCE(expected_amount,0)-reported_amount,2),review_notes=left(trim(COALESCE(p_reason,'')),500),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('ok',true,'status','rejected');
  ELSIF p_decision='needs_review' THEN
    UPDATE public.agency_payment_evidence SET status='needs_review',discrepancy_amount=round(COALESCE(expected_amount,0)-reported_amount,2),review_notes=left(trim(COALESCE(p_reason,'')),500),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() WHERE id=e.id;
    RETURN jsonb_build_object('ok',true,'status','needs_review');
  END IF;

  SELECT a.manager_id INTO v_manager FROM public.agencies a WHERE a.id=e.agency_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Agency manager not found' USING ERRCODE='P0002'; END IF;
  v_property:=e.property_id;
  v_unit:=e.unit_id;

  IF e.invoice_id IS NOT NULL THEN
    SELECT i.property_id,i.unit_id,i.balance_due INTO v_property,v_unit,v_balance FROM public.invoices i WHERE i.id=e.invoice_id FOR UPDATE;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'Invoice not found or not associated with this evidence'; END IF;
    IF e.tenant_id IS NULL THEN SELECT i.tenant_id INTO e.tenant_id FROM public.invoices i WHERE i.id=e.invoice_id; END IF;
  END IF;
  IF v_property IS NULL OR NOT public.agency_property_in_scope(e.agency_id,v_property) THEN RAISE EXCEPTION 'Evidence property is outside this Agency' USING ERRCODE='42501'; END IF;

  IF e.destination_type='agency' THEN
    IF e.invoice_id IS NULL OR e.tenant_id IS NULL THEN RAISE EXCEPTION 'Agency-collected evidence requires tenant and invoice'; END IF;
    IF NOT public.agency_service_capability(v_property,'collect') THEN RAISE EXCEPTION 'Agency contract does not permit collection for this property' USING ERRCODE='42501'; END IF;
  ELSIF e.destination_type='split' THEN
    v_split:=COALESCE(public.agency_split_collection_percent(e.agency_id,e.property_landlord_id,v_property),-1);
    IF v_split<=0 OR v_split>=100 THEN RAISE EXCEPTION 'Split percentage is missing or invalid on the active Agency contract'; END IF;
    v_agency_portion:=round(e.reported_amount*v_split/100,2);
    v_external_portion:=round(e.reported_amount-v_agency_portion,2);
  END IF;

  IF e.invoice_id IS NOT NULL THEN
    INSERT INTO public.payment_transactions(
      tenant_id,manager_id,unit_id,property_id,invoice_id,amount,payment_type,payment_method,phone_number,bank_reference,
      status,initiated_at,completed_at,recorded_by,notes,agency_evidence_id
    ) VALUES (
      e.tenant_id,v_manager,v_unit,v_property,e.invoice_id,round(e.reported_amount,2),e.payment_method,e.payment_method,'',e.reference,
      'completed',now(),now(),auth.uid(),
      CASE WHEN e.destination_type='agency' THEN 'Agency evidence accepted'
           WHEN e.destination_type='split' THEN 'Split-settlement evidence accepted'
           ELSE 'External settlement evidence accepted' END,
      CASE WHEN e.destination_type='agency' THEN NULL ELSE e.id END
    ) RETURNING id INTO v_tx;

    SELECT public.process_invoice_payment(e.invoice_id,v_tx,e.reported_amount) INTO v_alloc;
    v_excess:=round(GREATEST(e.reported_amount-COALESCE(v_alloc,0),0),2);

    IF v_excess>0 AND e.tenant_id IS NOT NULL THEN
      INSERT INTO public.tenant_credit_ledger(
        tenant_id,manager_id,property_id,transaction_id,invoice_id,entry_type,amount,balance_after,description
      )
      SELECT e.tenant_id,v_manager,v_property,v_tx,e.invoice_id,'credit',v_excess,
             round(COALESCE((SELECT balance_after FROM public.tenant_credit_ledger WHERE tenant_id=e.tenant_id ORDER BY created_at DESC,id DESC LIMIT 1),0)+v_excess,2),
             CASE WHEN e.destination_type='agency' THEN 'Advance payment credit from Agency-verified evidence' ELSE 'Advance payment credit from externally verified evidence' END;
    END IF;

    UPDATE public.payment_transactions
       SET allocated_amount=round(COALESCE(v_alloc,0),2),
           is_partial=(COALESCE(v_alloc,0)<e.reported_amount),
           is_advance=(v_excess>0),credit_amount=v_excess,updated_at=now()
     WHERE id=v_tx;

    IF e.destination_type='agency' THEN PERFORM public.issue_payment_receipt_atomic(v_tx); END IF;
  END IF;

  UPDATE public.agency_payment_evidence
     SET status='accepted',
         discrepancy_amount=round(COALESCE(expected_amount,reported_amount)-reported_amount,2),
         review_notes=left(trim(COALESCE(p_reason,'')),500),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
   WHERE id=e.id;

  RETURN jsonb_build_object(
    'ok',true,'status','accepted','transaction_id',v_tx,
    'allocated_amount',round(COALESCE(v_alloc,0),2),'credit_amount',v_excess,
    'agency_portion',v_agency_portion,'external_portion',v_external_portion,
    'external',(e.destination_type<>'agency')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_agency_payment_evidence_atomic(uuid,text,text) TO authenticated,service_role;

-- ---------------------------------------------------------------------------
-- 13. Final Agency breakdown semantics for split settlements.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_financial_breakdown(
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

  RETURN jsonb_build_object(
    'agency_id',p_agency_id,'period_start',p_period_start,'period_end',p_period_end,
    'rows',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'charge_type',x.charge_type,'label',x.label,
        'billed',round(x.billed,2),'collected',round(x.collected,2),
        'outstanding',round(GREATEST(x.billed-x.collected-x.external_confirmed,0),2),
        'external_confirmed',round(x.external_confirmed,2),
        'expenses',round(x.expenses,2),'net',round(x.collected+x.external_confirmed-x.expenses,2)
      ) ORDER BY x.category_order,x.label)
      FROM (
        SELECT li.charge_type,
               COALESCE(NULLIF(max(li.charge_label),''),initcap(replace(li.charge_type,'_',' '))) label,
               SUM(li.amount)::numeric billed,
               SUM(COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL WHERE pa.invoice_id=i.id AND pa.created_at::date BETWEEN p_period_start AND p_period_end),0) * CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END
                   + COALESCE((SELECT SUM(CASE WHEN e.destination_type='split' THEN e.reported_amount*COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0)/100 ELSE 0 END) FROM public.agency_payment_evidence e WHERE e.invoice_id=i.id AND e.status='accepted' AND e.payment_date BETWEEN p_period_start AND p_period_end),0) * CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END
               )::numeric collected,
               SUM(COALESCE((SELECT SUM(CASE WHEN e.destination_type='split' THEN e.reported_amount*(100-COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0))/100 ELSE e.reported_amount END) FROM public.agency_payment_evidence e WHERE e.invoice_id=i.id AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end),0) * CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END)::numeric external_confirmed,
               0::numeric expenses,10 category_order
        FROM public.invoice_line_items li
        JOIN public.invoices i ON i.id=li.invoice_id AND i.status<>'cancelled'
        JOIN LATERAL (SELECT COALESCE(SUM(il2.amount),0)::numeric line_total FROM public.invoice_line_items il2 WHERE il2.invoice_id=i.id) inv ON true
        WHERE i.manager_id=v_manager AND i.created_at::date BETWEEN p_period_start AND p_period_end
          AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))
        GROUP BY li.charge_type

        UNION ALL

        SELECT 'unclassified','Unclassified invoice',
               SUM(COALESCE(i.original_amount,i.amount))::numeric,
               SUM(COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL WHERE pa.invoice_id=i.id AND pa.created_at::date BETWEEN p_period_start AND p_period_end),0)
                   + COALESCE((SELECT SUM(CASE WHEN e.destination_type='split' THEN e.reported_amount*COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0)/100 ELSE 0 END) FROM public.agency_payment_evidence e WHERE e.invoice_id=i.id AND e.status='accepted' AND e.payment_date BETWEEN p_period_start AND p_period_end),0))::numeric,
               SUM(COALESCE((SELECT SUM(CASE WHEN e.destination_type='split' THEN e.reported_amount*(100-COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0))/100 ELSE e.reported_amount END) FROM public.agency_payment_evidence e WHERE e.invoice_id=i.id AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end),0))::numeric,
               0::numeric,20
        FROM public.invoices i
        WHERE i.manager_id=v_manager AND i.status<>'cancelled' AND i.created_at::date BETWEEN p_period_start AND p_period_end
          AND NOT EXISTS (SELECT 1 FROM public.invoice_line_items li WHERE li.invoice_id=i.id)
          AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

        UNION ALL

        SELECT 'external:'||COALESCE(e.payment_method,'external'),
               CASE WHEN e.destination_type='split' THEN 'Split · ' ELSE 'External · ' END||initcap(replace(COALESCE(e.payment_method,'external'),'_',' ')),
               0::numeric,
               SUM(CASE WHEN e.destination_type='split' THEN e.reported_amount*COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0)/100 ELSE 0 END)::numeric,
               SUM(CASE WHEN e.destination_type='split' THEN e.reported_amount*(100-COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0))/100 ELSE e.reported_amount END)::numeric,
               0::numeric,30
        FROM public.agency_payment_evidence e
        WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency' AND e.invoice_id IS NULL AND e.payment_date BETWEEN p_period_start AND p_period_end
        GROUP BY e.payment_method,e.destination_type

        UNION ALL

        SELECT 'expense:'||e.category,initcap(replace(e.category,'_',' ')),0::numeric,0::numeric,0::numeric,SUM(e.amount)::numeric,50
        FROM public.expenditures e
        WHERE e.manager_id=v_manager AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
          AND (e.property_id IS NULL OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)))
        GROUP BY e.category
      ) x
    ),'[]'::jsonb),
    'totals',jsonb_build_object(
      'billed',COALESCE((SELECT SUM(COALESCE(i.original_amount,i.amount)) FROM public.invoices i WHERE i.manager_id=v_manager AND i.status<>'cancelled' AND i.created_at::date BETWEEN p_period_start AND p_period_end AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))),0),
      'collected',COALESCE((
        SELECT SUM(pa.allocated_amount)
        FROM public.payment_allocations pa
        JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL
        JOIN public.invoices i ON i.id=pa.invoice_id
        WHERE pa.manager_id=v_manager AND pa.created_at::date BETWEEN p_period_start AND p_period_end AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))
      ),0) + COALESCE((SELECT SUM(e.reported_amount*COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0)/100) FROM public.agency_payment_evidence e WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type='split' AND e.payment_date BETWEEN p_period_start AND p_period_end),0),
      'external_confirmed',COALESCE((SELECT SUM(CASE WHEN e.destination_type='split' THEN e.reported_amount*(100-COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0))/100 ELSE e.reported_amount END) FROM public.agency_payment_evidence e WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end),0),
      'expenses',COALESCE((SELECT SUM(e.amount) FROM public.expenditures e WHERE e.manager_id=v_manager AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end AND (e.property_id IS NULL OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)))),0)
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 14. Ledger with explicit destination/source and split cash semantics.
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
      SELECT i.created_at::date event_date,'invoice'::text event_type,i.invoice_number reference,COALESCE(t.name,'Tenant') counterparty,COALESCE(li.charge_label,initcap(replace(li.charge_type,'_',' '))) category,li.amount billed,0::numeric collected,0::numeric external_confirmed,0::numeric expense,NULL::text destination,NULL::text source_type,i.id source_id
      FROM public.invoice_line_items li JOIN public.invoices i ON i.id=li.invoice_id AND i.status<>'cancelled' LEFT JOIN public.tenants t ON t.id=i.tenant_id
      WHERE i.manager_id=v_manager AND i.created_at::date BETWEEN p_period_start AND p_period_end AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))
      UNION ALL
      SELECT i.created_at::date,'invoice','UNCLASSIFIED-'||i.invoice_number,COALESCE(t.name,'Tenant'),'Unclassified invoice',COALESCE(i.original_amount,i.amount),0,0,0,NULL,NULL,i.id
      FROM public.invoices i LEFT JOIN public.tenants t ON t.id=i.tenant_id
      WHERE i.manager_id=v_manager AND i.status<>'cancelled' AND i.created_at::date BETWEEN p_period_start AND p_period_end AND NOT EXISTS (SELECT 1 FROM public.invoice_line_items li WHERE li.invoice_id=i.id) AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))
      UNION ALL
      SELECT pa.created_at::date,'payment',COALESCE(pt.bank_reference,pt.mpesa_receipt_number,pt.id::text),COALESCE(t.name,'Tenant'),COALESCE((SELECT max(li.charge_label) FROM public.invoice_line_items li WHERE li.invoice_id=i.id),'Invoice payment'),0,pa.allocated_amount,0,0,NULL,NULL,pa.id
      FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL JOIN public.invoices i ON i.id=pa.invoice_id LEFT JOIN public.tenants t ON t.id=pa.tenant_id
      WHERE pa.manager_id=v_manager AND pa.created_at::date BETWEEN p_period_start AND p_period_end AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))
      UNION ALL
      SELECT e.payment_date,CASE WHEN e.destination_type='split' THEN 'split_settlement' ELSE 'external_settlement' END,COALESCE(e.reference,e.id::text),COALESCE(e.payer_name,'External'),COALESCE((SELECT max(li.charge_label) FROM public.invoice_line_items li WHERE li.invoice_id=e.invoice_id),'External payment'),0,
             CASE WHEN e.destination_type='split' THEN round(e.reported_amount*COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0)/100,2) ELSE 0 END,
             CASE WHEN e.destination_type='split' THEN round(e.reported_amount*(100-COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0))/100,2) ELSE e.reported_amount END,
             0,e.destination_type,e.source_type,e.id
      FROM public.agency_payment_evidence e
      WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency' AND e.payment_date BETWEEN p_period_start AND p_period_end
      UNION ALL
      SELECT to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD'),'expense',e.id::text,'Expense',initcap(replace(e.category,'_',' ')),0,0,0,e.amount,'expense','expense',e.id
      FROM public.expenditures e
      WHERE e.manager_id=v_manager AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end AND (e.property_id IS NULL OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)))
    ) x
  ),'[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.agency_property_in_scope(uuid,uuid), public.agency_split_collection_percent(uuid,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_financial_breakdown(uuid,date,date), public.get_agency_financial_ledger(uuid,date,date) TO authenticated,service_role;

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 15. Final ledger granularity: one row per invoice line/payment allocation so
-- exported reports can reconcile Rent, Water, Security, Garbage, etc. exactly.
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
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.event_date,x.reference,x.event_type,x.category)
    FROM (
      -- Invoice line rows
      SELECT i.created_at::date event_date,'invoice'::text event_type,i.invoice_number reference,
             COALESCE(t.name,'Tenant') counterparty,
             COALESCE(li.charge_label,initcap(replace(li.charge_type,'_',' '))) category,
             li.amount billed,0::numeric collected,0::numeric external_confirmed,0::numeric expense,
             NULL::text destination,NULL::text source_type,NULL::text receipt_number,i.id source_id
      FROM public.invoice_line_items li
      JOIN public.invoices i ON i.id=li.invoice_id AND i.status<>'cancelled'
      LEFT JOIN public.tenants t ON t.id=i.tenant_id
      WHERE i.manager_id=v_manager AND i.created_at::date BETWEEN p_period_start AND p_period_end
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

      UNION ALL

      -- Legacy invoice with no line items
      SELECT i.created_at::date,'invoice','UNCLASSIFIED-'||i.invoice_number,
             COALESCE(t.name,'Tenant'),'Unclassified invoice',COALESCE(i.original_amount,i.amount),0,0,0,NULL,NULL,NULL,i.id
      FROM public.invoices i
      LEFT JOIN public.tenants t ON t.id=i.tenant_id
      WHERE i.manager_id=v_manager AND i.status<>'cancelled' AND i.created_at::date BETWEEN p_period_start AND p_period_end
        AND NOT EXISTS (SELECT 1 FROM public.invoice_line_items li WHERE li.invoice_id=i.id)
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

      UNION ALL

      -- Agency cash payment per invoice line
      SELECT pa.created_at::date,'payment',COALESCE(pt.bank_reference,pt.mpesa_receipt_number,pt.id::text),
             COALESCE(t.name,'Tenant'),COALESCE(li.charge_label,initcap(replace(li.charge_type,'_',' '))),0,
             round(pa.allocated_amount*CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END,2),0,0,NULL,NULL,
             (SELECT r.receipt_number FROM public.issued_payment_receipts r WHERE r.transaction_id=pt.id LIMIT 1),pa.id
      FROM public.payment_allocations pa
      JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL
      JOIN public.invoices i ON i.id=pa.invoice_id
      JOIN public.invoice_line_items li ON li.invoice_id=i.id
      JOIN LATERAL (SELECT COALESCE(SUM(il2.amount),0)::numeric line_total FROM public.invoice_line_items il2 WHERE il2.invoice_id=i.id) inv ON true
      LEFT JOIN public.tenants t ON t.id=pa.tenant_id
      WHERE pa.manager_id=v_manager AND pa.created_at::date BETWEEN p_period_start AND p_period_end
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

      UNION ALL

      -- Agency cash payment for legacy invoice with no line items
      SELECT pa.created_at::date,'payment',COALESCE(pt.bank_reference,pt.mpesa_receipt_number,pt.id::text),
             COALESCE(t.name,'Tenant'),'Unclassified invoice',0,pa.allocated_amount,0,0,NULL,NULL,
             (SELECT r.receipt_number FROM public.issued_payment_receipts r WHERE r.transaction_id=pt.id LIMIT 1),pa.id
      FROM public.payment_allocations pa
      JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' AND pt.agency_evidence_id IS NULL
      JOIN public.invoices i ON i.id=pa.invoice_id
      LEFT JOIN public.tenants t ON t.id=pa.tenant_id
      WHERE pa.manager_id=v_manager AND pa.created_at::date BETWEEN p_period_start AND p_period_end
        AND NOT EXISTS (SELECT 1 FROM public.invoice_line_items li WHERE li.invoice_id=i.id)
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

      UNION ALL

      -- External/direct/split evidence allocated to invoice charge lines
      SELECT e.payment_date,
             CASE WHEN e.destination_type='split' THEN 'split_settlement' ELSE 'external_settlement' END,
             COALESCE(e.reference,e.id::text),COALESCE(e.payer_name,'External'),
             COALESCE(li.charge_label,initcap(replace(li.charge_type,'_',' '))),0,
             CASE WHEN e.destination_type='split' THEN round(e.reported_amount*COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0)/100*CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END,2) ELSE 0 END,
             CASE WHEN e.destination_type='split' THEN round(e.reported_amount*(100-COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0))/100*CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END,2) ELSE round(e.reported_amount*CASE WHEN inv.line_total>0 THEN li.amount/inv.line_total ELSE 0 END,2) END,
             0,e.destination_type,e.source_type,NULL,e.id
      FROM public.agency_payment_evidence e
      JOIN public.invoice_line_items li ON li.invoice_id=e.invoice_id
      JOIN public.invoices i ON i.id=e.invoice_id AND i.status<>'cancelled'
      JOIN LATERAL (SELECT COALESCE(SUM(il2.amount),0)::numeric line_total FROM public.invoice_line_items il2 WHERE il2.invoice_id=i.id) inv ON true
      WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency' AND e.invoice_id IS NOT NULL AND e.payment_date BETWEEN p_period_start AND p_period_end
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

      UNION ALL

      -- External/direct/split evidence for a legacy invoice with no line items
      SELECT e.payment_date,
             CASE WHEN e.destination_type='split' THEN 'split_settlement' ELSE 'external_settlement' END,
             COALESCE(e.reference,e.id::text),COALESCE(e.payer_name,'External'),'Unclassified invoice',0,
             CASE WHEN e.destination_type='split' THEN round(e.reported_amount*COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0)/100,2) ELSE 0 END,
             CASE WHEN e.destination_type='split' THEN round(e.reported_amount*(100-COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0))/100,2) ELSE e.reported_amount END,
             0,e.destination_type,e.source_type,NULL,e.id
      FROM public.agency_payment_evidence e
      JOIN public.invoices i ON i.id=e.invoice_id AND i.status<>'cancelled'
      WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency' AND e.invoice_id IS NOT NULL AND e.payment_date BETWEEN p_period_start AND p_period_end
        AND NOT EXISTS (SELECT 1 FROM public.invoice_line_items li WHERE li.invoice_id=e.invoice_id)
        AND EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=i.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id))

      UNION ALL

      -- External/direct/split evidence not linked to an invoice
      SELECT e.payment_date,
             CASE WHEN e.destination_type='split' THEN 'split_settlement' ELSE 'external_settlement' END,
             COALESCE(e.reference,e.id::text),COALESCE(e.payer_name,'External'),'External payment',0,
             CASE WHEN e.destination_type='split' THEN round(e.reported_amount*COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0)/100,2) ELSE 0 END,
             CASE WHEN e.destination_type='split' THEN round(e.reported_amount*(100-COALESCE(public.agency_split_collection_percent(p_agency_id,e.property_landlord_id,e.property_id),0))/100,2) ELSE e.reported_amount END,
             0,e.destination_type,e.source_type,NULL,e.id
      FROM public.agency_payment_evidence e
      WHERE e.agency_id=p_agency_id AND e.status='accepted' AND e.destination_type<>'agency' AND e.invoice_id IS NULL AND e.payment_date BETWEEN p_period_start AND p_period_end

      UNION ALL

      -- Expenses
      SELECT to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD'),
             'expense',e.id::text,'Expense',initcap(replace(e.category,'_',' ')),0,0,0,e.amount,'expense','expense',NULL,e.id
      FROM public.expenditures e
      WHERE e.manager_id=v_manager
        AND to_date(CASE WHEN length(e.month)=7 THEN e.month||'-01' ELSE e.month END,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
        AND (e.property_id IS NULL OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=e.property_id AND pl.manager_id=v_manager AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.manager_user_id=pl.manager_id AND mp.agency_id=p_agency_id)))
    ) x
  ),'[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_financial_ledger(uuid,date,date) TO authenticated,service_role;
