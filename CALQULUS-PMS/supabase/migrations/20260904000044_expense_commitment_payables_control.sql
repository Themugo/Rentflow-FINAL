-- CALQULUS PMS — Expense Commitment & Payables Control
-- Controls future operating commitments without creating a second cash ledger.

CREATE TABLE IF NOT EXISTS public.expense_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  vendor_name text NOT NULL CHECK (char_length(trim(vendor_name)) BETWEEN 1 AND 160),
  category text NOT NULL CHECK (char_length(trim(category)) BETWEEN 1 AND 120),
  description text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','cancelled')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  settled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_commitments_manager_due_idx
  ON public.expense_commitments(manager_id, due_date, status);
CREATE INDEX IF NOT EXISTS expense_commitments_property_idx
  ON public.expense_commitments(property_id, due_date);

ALTER TABLE public.expense_commitments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expense_commitments_manager_scope ON public.expense_commitments;
CREATE POLICY expense_commitments_manager_scope ON public.expense_commitments
  FOR ALL TO authenticated
  USING (public.can_manage_property_scope(manager_id))
  WITH CHECK (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.expense_commitments FROM PUBLIC, anon;
GRANT SELECT ON public.expense_commitments TO authenticated;

CREATE OR REPLACE FUNCTION public.create_expense_commitment_atomic(
  p_manager_id uuid,
  p_vendor_name text,
  p_category text,
  p_amount numeric,
  p_due_date date,
  p_property_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_vendor_name),'') IS NULL OR nullif(trim(p_category),'') IS NULL THEN
    RAISE EXCEPTION 'Vendor and category are required' USING ERRCODE='22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive' USING ERRCODE='22023'; END IF;
  IF p_due_date IS NULL THEN RAISE EXCEPTION 'Due date is required' USING ERRCODE='22023'; END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.properties p WHERE p.id=p_property_id AND p.manager_id=p_manager_id
  ) THEN RAISE EXCEPTION 'Property outside manager scope' USING ERRCODE='42501'; END IF;

  INSERT INTO public.expense_commitments(manager_id,property_id,vendor_name,category,description,amount,due_date,notes)
  VALUES(p_manager_id,p_property_id,trim(p_vendor_name),trim(p_category),nullif(trim(p_description),''),round(p_amount,2),p_due_date,nullif(trim(p_notes),''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success',true,'commitment_id',v_id,'status','draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_expense_commitment_atomic(
  p_commitment_id uuid,
  p_target_status text,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.expense_commitments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.expense_commitments WHERE id=p_commitment_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_manage_property_scope(r.manager_id) THEN
    RAISE EXCEPTION 'Commitment outside manager scope' USING ERRCODE='42501';
  END IF;

  IF p_target_status NOT IN ('submitted','approved','rejected','settled','cancelled') THEN
    RAISE EXCEPTION 'Invalid target status' USING ERRCODE='22023';
  END IF;
  IF (r.status,p_target_status) NOT IN (
    ('draft','submitted'),('submitted','approved'),('submitted','rejected'),
    ('approved','cancelled'),('rejected','draft')
  ) THEN
    RAISE EXCEPTION 'Invalid commitment transition from % to %',r.status,p_target_status USING ERRCODE='55000';
  END IF;

  IF p_target_status='approved' THEN
    IF r.created_by = auth.uid() THEN RAISE EXCEPTION 'Requester cannot approve own commitment' USING ERRCODE='42501'; END IF;
    UPDATE public.expense_commitments SET status='approved', approved_by=auth.uid(), approved_at=now(), notes=COALESCE(nullif(trim(p_note),''),notes), updated_at=now() WHERE id=r.id;
  ELSE
    UPDATE public.expense_commitments SET status=p_target_status, notes=COALESCE(nullif(trim(p_note),''),notes), updated_at=now() WHERE id=r.id;
  END IF;

  RETURN jsonb_build_object('success',true,'commitment_id',r.id,'status',p_target_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_expense_commitment_control(
  p_manager_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE,
  p_horizon_days integer DEFAULT 90
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_end date; v_total numeric; v_due numeric; v_overdue numeric; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  IF p_horizon_days NOT BETWEEN 30 AND 365 THEN RAISE EXCEPTION 'Horizon must be between 30 and 365 days' USING ERRCODE='22023'; END IF;
  v_end := p_as_of_date + p_horizon_days;

  SELECT coalesce(sum(amount),0),
         coalesce(sum(amount) FILTER (WHERE due_date BETWEEN p_as_of_date AND v_end),0),
         coalesce(sum(amount) FILTER (WHERE due_date < p_as_of_date),0)
    INTO v_total,v_due,v_overdue
  FROM public.expense_commitments
  WHERE manager_id=p_manager_id AND status='approved';

  SELECT jsonb_build_object(
    'as_of_date',p_as_of_date,'end_date',v_end,
    'approved_total',round(v_total,2),'approved_due_in_horizon',round(v_due,2),'approved_overdue',round(v_overdue,2),
    'commitments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'vendor_name',c.vendor_name,'category',c.category,'property_id',c.property_id,'amount',c.amount,'due_date',c.due_date,'status',c.status,'description',c.description) ORDER BY c.due_date,c.vendor_name) FROM public.expense_commitments c WHERE c.manager_id=p_manager_id AND c.status IN ('approved','submitted') AND c.due_date <= v_end),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- Converge approved commitments into the existing treasury forecast as explicit obligations.
CREATE OR REPLACE FUNCTION public.get_manager_treasury_control(
  p_manager_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE,
  p_horizon_days integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_settings public.treasury_control_settings; v_horizon integer; v_end_date date;
  v_cash numeric := 0; v_receivables numeric := 0; v_approved_payouts numeric := 0;
  v_budget_expenses numeric := 0; v_budget_revenue numeric := 0; v_commitments numeric := 0;
  v_projected_floor numeric := 0; v_shortfall numeric := 0; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_settings FROM public.treasury_control_settings WHERE manager_id=p_manager_id;
  v_horizon := coalesce(p_horizon_days,v_settings.forecast_horizon_days,90);
  IF v_horizon NOT BETWEEN 30 AND 365 THEN RAISE EXCEPTION 'Forecast horizon must be between 30 and 365 days' USING ERRCODE='22023'; END IF;
  v_end_date := p_as_of_date + v_horizon;

  SELECT coalesce(sum(jl.debit-jl.credit),0) INTO v_cash
  FROM public.ledger_journal_lines jl JOIN public.ledger_journal_entries je ON je.id=jl.journal_entry_id JOIN public.ledger_accounts la ON la.id=jl.account_id
  WHERE je.manager_id=p_manager_id AND la.account_code='1100' AND je.status='posted' AND je.entry_date <= p_as_of_date;

  SELECT coalesce(sum(greatest(i.amount-coalesce(a.allocated,0),0)),0) INTO v_receivables
  FROM public.invoices i LEFT JOIN (SELECT pa.invoice_id,sum(pa.allocated_amount) allocated FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' WHERE pa.manager_id=p_manager_id GROUP BY pa.invoice_id) a ON a.invoice_id=i.id
  WHERE i.manager_id=p_manager_id AND i.status NOT IN ('cancelled','refunded') AND i.due_date > p_as_of_date AND i.due_date <= v_end_date AND greatest(i.amount-coalesce(a.allocated,0),0)>0;

  SELECT coalesce(sum(pr.net_amount),0) INTO v_approved_payouts FROM public.payout_requests pr WHERE pr.manager_id=p_manager_id AND pr.status='approved' AND greatest(pr.period_end,p_as_of_date)<=v_end_date;

  SELECT coalesce(sum(l.planned_amount) FILTER (WHERE l.line_type='expense'),0),coalesce(sum(l.planned_amount) FILTER (WHERE l.line_type='revenue'),0) INTO v_budget_expenses,v_budget_revenue
  FROM public.management_budget_lines l JOIN public.management_budgets b ON b.id=l.budget_id
  WHERE b.manager_id=p_manager_id AND b.status='approved' AND l.month>=date_trunc('month',p_as_of_date)::date AND l.month<=date_trunc('month',v_end_date)::date;

  SELECT coalesce(sum(amount),0) INTO v_commitments FROM public.expense_commitments WHERE manager_id=p_manager_id AND status='approved' AND due_date BETWEEN p_as_of_date AND v_end_date;
  v_projected_floor := round(v_cash+v_receivables-v_approved_payouts-v_budget_expenses-v_commitments,2);
  v_shortfall := greatest(round(coalesce(v_settings.minimum_cash_buffer,0)-v_projected_floor,2),0);

  WITH RECURSIVE days AS (SELECT p_as_of_date::date day UNION ALL SELECT day+1 FROM days WHERE day<v_end_date),
  collections AS (SELECT i.due_date day,sum(greatest(i.amount-coalesce(a.allocated,0),0)) amount FROM public.invoices i LEFT JOIN (SELECT pa.invoice_id,sum(pa.allocated_amount) allocated FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed' WHERE pa.manager_id=p_manager_id GROUP BY pa.invoice_id) a ON a.invoice_id=i.id WHERE i.manager_id=p_manager_id AND i.status NOT IN ('cancelled','refunded') AND i.due_date>p_as_of_date AND i.due_date<=v_end_date GROUP BY i.due_date),
  payouts AS (SELECT greatest(pr.period_end,p_as_of_date) day,sum(pr.net_amount) amount FROM public.payout_requests pr WHERE pr.manager_id=p_manager_id AND pr.status='approved' AND greatest(pr.period_end,p_as_of_date)<=v_end_date GROUP BY greatest(pr.period_end,p_as_of_date)),
  budget_expenses AS (SELECT greatest(l.month,p_as_of_date) day,sum(l.planned_amount) amount FROM public.management_budget_lines l JOIN public.management_budgets b ON b.id=l.budget_id WHERE b.manager_id=p_manager_id AND b.status='approved' AND l.line_type='expense' AND l.month>=date_trunc('month',p_as_of_date)::date AND l.month<=date_trunc('month',v_end_date)::date GROUP BY greatest(l.month,p_as_of_date)),
  commitments AS (SELECT c.due_date day,sum(c.amount) amount FROM public.expense_commitments c WHERE c.manager_id=p_manager_id AND c.status='approved' AND c.due_date>p_as_of_date AND c.due_date<=v_end_date GROUP BY c.due_date),
  movement AS (SELECT d.day,coalesce(c.amount,0) expected_collections,coalesce(p.amount,0) approved_owner_payouts,coalesce(e.amount,0) budgeted_expenses,coalesce(x.amount,0) approved_commitments FROM days d LEFT JOIN collections c ON c.day=d.day LEFT JOIN payouts p ON p.day=d.day LEFT JOIN budget_expenses e ON e.day=d.day LEFT JOIN commitments x ON x.day=d.day),
  running AS (SELECT m.*,round(v_cash+sum(m.expected_collections-m.approved_owner_payouts-m.budgeted_expenses-m.approved_commitments) OVER (ORDER BY m.day),2) projected_cash FROM movement m)
  SELECT jsonb_build_object('settings',jsonb_build_object('minimum_cash_buffer',coalesce(v_settings.minimum_cash_buffer,0),'forecast_horizon_days',v_horizon),'as_of_date',p_as_of_date,'end_date',v_end_date,'current_cash',round(v_cash,2),'outstanding_receivables',round(v_receivables,2),'approved_owner_payouts',round(v_approved_payouts,2),'approved_budget_expenses',round(v_budget_expenses,2),'approved_budget_revenue',round(v_budget_revenue,2),'approved_expense_commitments',round(v_commitments,2),'projected_cash_floor',v_projected_floor,'minimum_cash_buffer',coalesce(v_settings.minimum_cash_buffer,0),'buffer_shortfall',v_shortfall,'status',CASE WHEN v_shortfall>0 THEN 'below_buffer' WHEN v_projected_floor<0 THEN 'negative' ELSE 'healthy' END,'forecast',coalesce((SELECT jsonb_agg(jsonb_build_object('day',r.day,'expected_collections',r.expected_collections,'approved_owner_payouts',r.approved_owner_payouts,'budgeted_expenses',r.budgeted_expenses,'approved_commitments',r.approved_commitments,'projected_cash',r.projected_cash) ORDER BY r.day) FROM running r),'[]'::jsonb)) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_expense_commitment_atomic(uuid,text,text,numeric,date,uuid,text,text), public.transition_expense_commitment_atomic(uuid,text,text), public.get_manager_expense_commitment_control(uuid,date,integer), public.get_manager_treasury_control(uuid,date,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_expense_commitment_atomic(uuid,text,text,numeric,date,uuid,text,text), public.transition_expense_commitment_atomic(uuid,text,text), public.get_manager_expense_commitment_control(uuid,date,integer), public.get_manager_treasury_control(uuid,date,integer) TO authenticated;
