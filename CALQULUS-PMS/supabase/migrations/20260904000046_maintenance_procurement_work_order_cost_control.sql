-- CALQULUS PMS — Maintenance Procurement & Work-Order Cost Control
-- Connects maintenance lifecycle to governed vendors, contracts, commitments and actual expenditures.
-- Accounting remains in the canonical expenditure + double-entry ledger.

ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.management_vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_contract_id uuid REFERENCES public.vendor_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expense_commitment_id uuid REFERENCES public.expense_commitments(id) ON DELETE SET NULL;

ALTER TABLE public.expense_commitments
  ADD COLUMN IF NOT EXISTS maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL;

ALTER TABLE public.expenditures
  ADD COLUMN IF NOT EXISTS maintenance_request_id uuid REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.management_vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_contract_id uuid REFERENCES public.vendor_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expense_commitment_id uuid REFERENCES public.expense_commitments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS maintenance_requests_procurement_idx
  ON public.maintenance_requests(manager_id,vendor_id,vendor_contract_id,expense_commitment_id,status);
CREATE INDEX IF NOT EXISTS expense_commitments_maintenance_idx
  ON public.expense_commitments(manager_id,maintenance_request_id,due_date,status);
CREATE INDEX IF NOT EXISTS expenditures_maintenance_idx
  ON public.expenditures(manager_id,maintenance_request_id,created_at);

CREATE OR REPLACE FUNCTION public.assign_maintenance_procurement_atomic(
  p_request_id uuid,
  p_vendor_id uuid DEFAULT NULL,
  p_vendor_contract_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.maintenance_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_manage_property_scope(r.manager_id) THEN
    RAISE EXCEPTION 'Maintenance request outside manager scope' USING ERRCODE='42501';
  END IF;

  IF p_vendor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.management_vendors v
    WHERE v.id=p_vendor_id AND v.manager_id=r.manager_id AND v.status='active'
  ) THEN RAISE EXCEPTION 'Vendor outside manager scope or inactive' USING ERRCODE='42501'; END IF;

  IF p_vendor_contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_contracts c
    WHERE c.id=p_vendor_contract_id AND c.manager_id=r.manager_id
      AND c.vendor_id=p_vendor_id AND c.status='active'
      AND (c.property_id IS NULL OR c.property_id IN (SELECT p.id FROM public.properties p WHERE p.manager_id=r.manager_id))
  ) THEN RAISE EXCEPTION 'Contract outside vendor scope or inactive' USING ERRCODE='42501'; END IF;

  UPDATE public.maintenance_requests
     SET vendor_id=p_vendor_id,
         vendor_contract_id=p_vendor_contract_id,
         updated_at=now()
   WHERE id=r.id;

  RETURN jsonb_build_object('success',true,'request_id',r.id,'vendor_id',p_vendor_id,'vendor_contract_id',p_vendor_contract_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_maintenance_expense_commitment_atomic(
  p_request_id uuid,
  p_vendor_id uuid,
  p_category text,
  p_amount numeric,
  p_due_date date,
  p_description text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.maintenance_requests%ROWTYPE; v_commitment uuid; v_vendor_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_manage_property_scope(r.manager_id) THEN
    RAISE EXCEPTION 'Maintenance request outside manager scope' USING ERRCODE='42501';
  END IF;
  SELECT v.name INTO v_vendor_name FROM public.management_vendors v
   WHERE v.id=p_vendor_id AND v.manager_id=r.manager_id AND v.status='active';
  IF v_vendor_name IS NULL THEN RAISE EXCEPTION 'Active vendor required' USING ERRCODE='42501'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_due_date IS NULL OR nullif(trim(p_category),'') IS NULL THEN
    RAISE EXCEPTION 'Valid category, positive amount and due date are required' USING ERRCODE='22023';
  END IF;
  IF r.expense_commitment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Maintenance request already has an expense commitment' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.expense_commitments(
    manager_id,created_by,property_id,vendor_name,vendor_id,category,description,amount,due_date,status,notes,maintenance_request_id
  ) VALUES (
    r.manager_id,auth.uid(),
    (SELECT p.id FROM public.properties p WHERE p.manager_id=r.manager_id AND p.name=r.property_name LIMIT 1),
    v_vendor_name,p_vendor_id,trim(p_category),nullif(trim(COALESCE(p_description,r.title)),''),round(p_amount,2),p_due_date,'draft',nullif(trim(p_notes),''),r.id
  ) RETURNING id INTO v_commitment;

  UPDATE public.maintenance_requests
     SET vendor_id=p_vendor_id, expense_commitment_id=v_commitment, updated_at=now()
   WHERE id=r.id;

  RETURN jsonb_build_object('success',true,'request_id',r.id,'commitment_id',v_commitment,'status','draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.link_maintenance_expenditure_atomic(
  p_expenditure_id uuid,
  p_request_id uuid,
  p_vendor_id uuid DEFAULT NULL,
  p_vendor_contract_id uuid DEFAULT NULL,
  p_expense_commitment_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.expenditures%ROWTYPE; r public.maintenance_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.expenditures WHERE id=p_expenditure_id FOR UPDATE;
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  IF e.id IS NULL OR r.id IS NULL OR e.manager_id IS DISTINCT FROM r.manager_id OR NOT public.can_manage_property_scope(r.manager_id) THEN
    RAISE EXCEPTION 'Expenditure or maintenance request outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_vendor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.management_vendors v WHERE v.id=p_vendor_id AND v.manager_id=r.manager_id) THEN
    RAISE EXCEPTION 'Vendor outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_vendor_contract_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vendor_contracts c WHERE c.id=p_vendor_contract_id AND c.manager_id=r.manager_id AND c.vendor_id=p_vendor_id) THEN
    RAISE EXCEPTION 'Contract outside vendor scope' USING ERRCODE='42501';
  END IF;
  IF p_expense_commitment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.expense_commitments c WHERE c.id=p_expense_commitment_id AND c.manager_id=r.manager_id AND c.maintenance_request_id=r.id) THEN
    RAISE EXCEPTION 'Commitment outside maintenance scope' USING ERRCODE='42501';
  END IF;
  UPDATE public.expenditures SET maintenance_request_id=r.id,vendor_id=p_vendor_id,vendor_contract_id=p_vendor_contract_id,expense_commitment_id=p_expense_commitment_id,updated_at=now() WHERE id=e.id;
  RETURN jsonb_build_object('success',true,'expenditure_id',e.id,'request_id',r.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_maintenance_procurement_cost_control(
  p_manager_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'as_of_date',p_as_of_date,
    'open_work_orders',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress')),
    'vendor_assigned',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress','completed') AND m.vendor_id IS NOT NULL),
    'without_vendor',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress') AND m.vendor_id IS NULL),
    'with_commitment',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.expense_commitment_id IS NOT NULL),
    'approved_maintenance_commitments',(SELECT coalesce(sum(c.amount),0) FROM public.expense_commitments c WHERE c.manager_id=p_manager_id AND c.maintenance_request_id IS NOT NULL AND c.status='approved' AND c.due_date>=p_as_of_date),
    'actual_maintenance_spend',(SELECT coalesce(sum(e.amount),0) FROM public.expenditures e WHERE e.manager_id=p_manager_id AND e.maintenance_request_id IS NOT NULL),
    'work_orders',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',m.id,'title',m.title,'property_name',m.property_name,'unit_number',m.unit_number,'priority',m.priority,'status',m.status,
      'requested_date',m.requested_date,'vendor_id',m.vendor_id,'vendor_name',v.name,
      'contract_id',m.vendor_contract_id,'contract_reference',vc.contract_reference,
      'commitment_id',m.expense_commitment_id,'commitment_status',ec.status,'commitment_amount',ec.amount,'commitment_due_date',ec.due_date,
      'actual_spend',coalesce((SELECT sum(e.amount) FROM public.expenditures e WHERE e.maintenance_request_id=m.id),0),
      'expenditure_count',coalesce((SELECT count(*) FROM public.expenditures e WHERE e.maintenance_request_id=m.id),0)
    ) ORDER BY CASE m.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,m.requested_date DESC)
    FROM public.maintenance_requests m
    LEFT JOIN public.management_vendors v ON v.id=m.vendor_id
    LEFT JOIN public.vendor_contracts vc ON vc.id=m.vendor_contract_id
    LEFT JOIN public.expense_commitments ec ON ec.id=m.expense_commitment_id
    WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress','completed') LIMIT 100),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_maintenance_procurement_atomic(uuid,uuid,uuid), public.create_maintenance_expense_commitment_atomic(uuid,uuid,text,numeric,date,text,text), public.link_maintenance_expenditure_atomic(uuid,uuid,uuid,uuid,uuid), public.get_manager_maintenance_procurement_cost_control(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_maintenance_procurement_atomic(uuid,uuid,uuid), public.create_maintenance_expense_commitment_atomic(uuid,uuid,text,numeric,date,text,text), public.link_maintenance_expenditure_atomic(uuid,uuid,uuid,uuid,uuid), public.get_manager_maintenance_procurement_cost_control(uuid,date) TO authenticated;
