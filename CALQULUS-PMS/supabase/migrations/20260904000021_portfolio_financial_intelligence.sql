-- CALQULUS PMS — Portfolio Financial Intelligence
CREATE OR REPLACE FUNCTION public.get_manager_portfolio_financial_intelligence(
  p_manager_id uuid DEFAULT auth.uid(),
  p_months integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_manager uuid := COALESCE(p_manager_id, v_uid);
  v_allowed boolean;
  v_billed numeric := 0;
  v_collected numeric := 0;
  v_expenses numeric := 0;
  v_overdue numeric := 0;
  v_arrears_0_30 numeric := 0;
  v_arrears_31_60 numeric := 0;
  v_arrears_61_90 numeric := 0;
  v_arrears_90_plus numeric := 0;
  v_avg_monthly_net numeric := 0;
  v_forecast_3m numeric := 0;
  v_collection_rate numeric := 0;
  v_expense_ratio numeric := 0;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_months < 1 OR p_months > 24 THEN RAISE EXCEPTION 'Months must be between 1 and 24'; END IF;
  SELECT v_manager = v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN RAISE EXCEPTION 'Financial intelligence scope unauthorized' USING ERRCODE='42501'; END IF;

  SELECT COALESCE(sum(i.amount),0), COALESCE(sum(COALESCE(i.paid_amount,0)),0),
         COALESCE(sum(COALESCE(i.balance_due,0)) FILTER(WHERE i.status='overdue'),0)
    INTO v_billed,v_collected,v_overdue
  FROM public.invoices i
  WHERE i.manager_id=v_manager
    AND i.due_date >= (date_trunc('month',current_date)-make_interval(months=>p_months))::date
    AND i.due_date < (date_trunc('month',current_date)+interval '1 month')::date;

  SELECT COALESCE(sum(e.amount),0) INTO v_expenses
  FROM public.expenditures e
  WHERE e.manager_id=v_manager
    AND to_date(e.month,'YYYY-MM') >= (date_trunc('month',current_date)-make_interval(months=>p_months))::date
    AND to_date(e.month,'YYYY-MM') < (date_trunc('month',current_date)+interval '1 month')::date;

  SELECT
    COALESCE(sum(COALESCE(i.balance_due,0)) FILTER(WHERE current_date-i.due_date BETWEEN 0 AND 30),0),
    COALESCE(sum(COALESCE(i.balance_due,0)) FILTER(WHERE current_date-i.due_date BETWEEN 31 AND 60),0),
    COALESCE(sum(COALESCE(i.balance_due,0)) FILTER(WHERE current_date-i.due_date BETWEEN 61 AND 90),0),
    COALESCE(sum(COALESCE(i.balance_due,0)) FILTER(WHERE current_date-i.due_date > 90),0)
  INTO v_arrears_0_30,v_arrears_31_60,v_arrears_61_90,v_arrears_90_plus
  FROM public.invoices i
  WHERE i.manager_id=v_manager AND i.status='overdue' AND COALESCE(i.balance_due,0)>0;

  v_collection_rate := CASE WHEN v_billed=0 THEN 100 ELSE round(v_collected*100/v_billed,1) END;
  v_expense_ratio := CASE WHEN v_collected=0 THEN 0 ELSE round(v_expenses*100/v_collected,1) END;
  v_avg_monthly_net := round((v_collected-v_expenses)/p_months,2);
  v_forecast_3m := round(v_avg_monthly_net*3,2);

  SELECT jsonb_build_object(
    'period_months',p_months,
    'summary',jsonb_build_object('billed',v_billed,'collected',v_collected,'expenses',v_expenses,'net_cash',v_collected-v_expenses,'collection_rate',v_collection_rate,'expense_ratio',v_expense_ratio,'overdue_balance',v_overdue,'avg_monthly_net',v_avg_monthly_net,'forecast_3m_net',v_forecast_3m),
    'arrears_aging',jsonb_build_object('0_30',v_arrears_0_30,'31_60',v_arrears_31_60,'61_90',v_arrears_61_90,'90_plus',v_arrears_90_plus),
    'property_performance',COALESCE((SELECT jsonb_agg(row_to_json(n) ORDER BY n.net_cash DESC) FROM (
      SELECT p.id,p.name,p.address,
        COALESCE((SELECT sum(i.amount) FROM public.invoices i WHERE i.property_id=p.id AND i.due_date >= (date_trunc('month',current_date)-make_interval(months=>p_months))::date AND i.due_date < (date_trunc('month',current_date)+interval '1 month')::date),0) billed,
        COALESCE((SELECT sum(COALESCE(i.paid_amount,0)) FROM public.invoices i WHERE i.property_id=p.id AND i.due_date >= (date_trunc('month',current_date)-make_interval(months=>p_months))::date AND i.due_date < (date_trunc('month',current_date)+interval '1 month')::date),0) collected,
        COALESCE((SELECT sum(e.amount) FROM public.expenditures e WHERE e.property_id=p.id AND to_date(e.month,'YYYY-MM') >= (date_trunc('month',current_date)-make_interval(months=>p_months))::date AND to_date(e.month,'YYYY-MM') < (date_trunc('month',current_date)+interval '1 month')::date),0) expenses
      FROM public.properties p WHERE p.manager_id=v_manager AND p.status='active'
    ) x CROSS JOIN LATERAL (SELECT x.*, round(x.collected-x.expenses,2) net_cash) n), '[]'::jsonb),
    'cash_flow_forecast',jsonb_build_object('method','historical average collected minus expenses','monthly_net',v_avg_monthly_net,'next_3_months_net',v_forecast_3m)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_manager_portfolio_financial_intelligence(uuid,integer) TO authenticated;
