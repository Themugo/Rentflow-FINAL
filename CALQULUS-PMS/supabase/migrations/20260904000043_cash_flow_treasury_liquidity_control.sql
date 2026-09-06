-- CALQULUS PMS — Cash Flow, Treasury & Liquidity Control
-- Uses the canonical double-entry cash account plus existing receivables,
-- approved owner payouts and approved management budgets. No parallel cash ledger.

CREATE TABLE IF NOT EXISTS public.treasury_control_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  minimum_cash_buffer numeric(14,2) NOT NULL DEFAULT 0 CHECK (minimum_cash_buffer >= 0),
  forecast_horizon_days integer NOT NULL DEFAULT 90 CHECK (forecast_horizon_days BETWEEN 30 AND 365),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(manager_id)
);

CREATE INDEX IF NOT EXISTS treasury_control_settings_manager_idx
  ON public.treasury_control_settings(manager_id);

ALTER TABLE public.treasury_control_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS treasury_control_settings_manager_scope ON public.treasury_control_settings;
CREATE POLICY treasury_control_settings_manager_scope ON public.treasury_control_settings
  FOR ALL USING (public.can_manage_property_scope(manager_id))
  WITH CHECK (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.treasury_control_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.treasury_control_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_treasury_control_settings(
  p_manager_id uuid,
  p_minimum_cash_buffer numeric DEFAULT 0,
  p_forecast_horizon_days integer DEFAULT 90
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.treasury_control_settings;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF coalesce(p_minimum_cash_buffer,0) < 0 THEN RAISE EXCEPTION 'Minimum cash buffer cannot be negative' USING ERRCODE='22023'; END IF;
  IF coalesce(p_forecast_horizon_days,90) NOT BETWEEN 30 AND 365 THEN RAISE EXCEPTION 'Forecast horizon must be between 30 and 365 days' USING ERRCODE='22023'; END IF;

  INSERT INTO public.treasury_control_settings(manager_id, minimum_cash_buffer, forecast_horizon_days, updated_at)
  VALUES (p_manager_id, round(coalesce(p_minimum_cash_buffer,0),2), coalesce(p_forecast_horizon_days,90), now())
  ON CONFLICT (manager_id) DO UPDATE SET
    minimum_cash_buffer = excluded.minimum_cash_buffer,
    forecast_horizon_days = excluded.forecast_horizon_days,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('id',v_row.id,'manager_id',v_row.manager_id,'minimum_cash_buffer',v_row.minimum_cash_buffer,'forecast_horizon_days',v_row.forecast_horizon_days);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_treasury_control(
  p_manager_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE,
  p_horizon_days integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_settings public.treasury_control_settings;
  v_horizon integer;
  v_end_date date;
  v_cash numeric := 0;
  v_receivables numeric := 0;
  v_approved_payouts numeric := 0;
  v_budget_expenses numeric := 0;
  v_budget_revenue numeric := 0;
  v_projected_floor numeric := 0;
  v_shortfall numeric := 0;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF p_as_of_date IS NULL THEN RAISE EXCEPTION 'As-of date is required' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_settings FROM public.treasury_control_settings WHERE manager_id=p_manager_id;
  v_horizon := coalesce(p_horizon_days, v_settings.forecast_horizon_days, 90);
  IF v_horizon NOT BETWEEN 30 AND 365 THEN RAISE EXCEPTION 'Forecast horizon must be between 30 and 365 days' USING ERRCODE='22023'; END IF;
  v_end_date := p_as_of_date + v_horizon;

  -- Cash is always derived from the canonical 1100 Cash / Bank account.
  SELECT coalesce(sum(jl.debit-jl.credit),0)
    INTO v_cash
  FROM public.ledger_journal_lines jl
  JOIN public.ledger_journal_entries je ON je.id=jl.journal_entry_id
  JOIN public.ledger_accounts la ON la.id=jl.account_id
  WHERE je.manager_id=p_manager_id
    AND la.account_code='1100'
    AND je.status='posted'
    AND je.entry_date <= p_as_of_date;

  -- Expected inflows are explicit, traceable outstanding receivables only.
  SELECT coalesce(sum(greatest(i.amount-coalesce(a.allocated,0),0)),0)
    INTO v_receivables
  FROM public.invoices i
  LEFT JOIN (
    SELECT pa.invoice_id, sum(pa.allocated_amount) allocated
    FROM public.payment_allocations pa
    JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed'
    WHERE pa.manager_id=p_manager_id
    GROUP BY pa.invoice_id
  ) a ON a.invoice_id=i.id
  WHERE i.manager_id=p_manager_id
    AND i.status NOT IN ('cancelled','refunded')
    AND i.due_date > p_as_of_date
    AND i.due_date <= v_end_date
    AND greatest(i.amount-coalesce(a.allocated,0),0) > 0;

  SELECT coalesce(sum(pr.net_amount),0)
    INTO v_approved_payouts
  FROM public.payout_requests pr
  WHERE pr.manager_id=p_manager_id
    AND pr.status='approved'
    AND greatest(pr.period_end,p_as_of_date) <= v_end_date;

  -- Budget scenario is deliberately kept separate from actual cash so it cannot
  -- masquerade as realized money or duplicate the ledger.
  SELECT coalesce(sum(l.planned_amount) FILTER (WHERE l.line_type='expense'),0),
         coalesce(sum(l.planned_amount) FILTER (WHERE l.line_type='revenue'),0)
    INTO v_budget_expenses, v_budget_revenue
  FROM public.management_budget_lines l
  JOIN public.management_budgets b ON b.id=l.budget_id
  WHERE b.manager_id=p_manager_id
    AND b.status='approved'
    AND l.month >= date_trunc('month',p_as_of_date)::date
    AND l.month <= date_trunc('month',v_end_date)::date;

  v_projected_floor := round(v_cash + v_receivables - v_approved_payouts - v_budget_expenses,2);
  v_shortfall := greatest(round(coalesce(v_settings.minimum_cash_buffer,0)-v_projected_floor,2),0);

  WITH RECURSIVE days AS (
    SELECT p_as_of_date::date day
    UNION ALL
    SELECT day + 1 FROM days WHERE day < v_end_date
  ),
  collections AS (
    SELECT i.due_date day, sum(greatest(i.amount-coalesce(a.allocated,0),0)) amount
    FROM public.invoices i
    LEFT JOIN (
      SELECT pa.invoice_id, sum(pa.allocated_amount) allocated
      FROM public.payment_allocations pa
      JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed'
      WHERE pa.manager_id=p_manager_id GROUP BY pa.invoice_id
    ) a ON a.invoice_id=i.id
    WHERE i.manager_id=p_manager_id AND i.status NOT IN ('cancelled','refunded')
      AND i.due_date > p_as_of_date AND i.due_date <= v_end_date
    GROUP BY i.due_date
  ),
  payouts AS (
    SELECT greatest(pr.period_end,p_as_of_date) day, sum(pr.net_amount) amount
    FROM public.payout_requests pr
    WHERE pr.manager_id=p_manager_id AND pr.status='approved'
      AND greatest(pr.period_end,p_as_of_date) <= v_end_date
    GROUP BY greatest(pr.period_end,p_as_of_date)
  ),
  budget_expenses AS (
    SELECT greatest(l.month,p_as_of_date) day, sum(l.planned_amount) amount
    FROM public.management_budget_lines l
    JOIN public.management_budgets b ON b.id=l.budget_id
    WHERE b.manager_id=p_manager_id AND b.status='approved' AND l.line_type='expense'
      AND l.month >= date_trunc('month',p_as_of_date)::date AND l.month <= date_trunc('month',v_end_date)::date
    GROUP BY greatest(l.month,p_as_of_date)
  ),
  movement AS (
    SELECT d.day, coalesce(c.amount,0) expected_collections,
      coalesce(p.amount,0) approved_owner_payouts,
      coalesce(e.amount,0) budgeted_expenses
    FROM days d LEFT JOIN collections c ON c.day=d.day LEFT JOIN payouts p ON p.day=d.day LEFT JOIN budget_expenses e ON e.day=d.day
  ),
  running AS (
    SELECT m.*, round(v_cash + sum(m.expected_collections-m.approved_owner_payouts-m.budgeted_expenses) OVER (ORDER BY m.day),2) projected_cash
    FROM movement m
  )
  SELECT jsonb_build_object(
    'settings',jsonb_build_object('minimum_cash_buffer',coalesce(v_settings.minimum_cash_buffer,0),'forecast_horizon_days',v_horizon),
    'as_of_date',p_as_of_date,
    'end_date',v_end_date,
    'current_cash',round(v_cash,2),
    'outstanding_receivables',round(v_receivables,2),
    'approved_owner_payouts',round(v_approved_payouts,2),
    'approved_budget_expenses',round(v_budget_expenses,2),
    'approved_budget_revenue',round(v_budget_revenue,2),
    'projected_cash_floor',v_projected_floor,
    'minimum_cash_buffer',coalesce(v_settings.minimum_cash_buffer,0),
    'buffer_shortfall',v_shortfall,
    'status',CASE WHEN v_shortfall > 0 THEN 'below_buffer' WHEN v_projected_floor < 0 THEN 'negative' ELSE 'healthy' END,
    'forecast',coalesce((SELECT jsonb_agg(jsonb_build_object('day',r.day,'expected_collections',r.expected_collections,'approved_owner_payouts',r.approved_owner_payouts,'budgeted_expenses',r.budgeted_expenses,'projected_cash',r.projected_cash) ORDER BY r.day) FROM running r),'[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_treasury_control_settings(uuid,numeric,integer), public.get_manager_treasury_control(uuid,date,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_treasury_control_settings(uuid,numeric,integer), public.get_manager_treasury_control(uuid,date,integer) TO authenticated;

COMMENT ON TABLE public.treasury_control_settings IS 'Manager-level treasury guardrails; forecast values derive from canonical ledger, receivables, approved payouts and approved budgets.';
