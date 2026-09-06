-- CALQULUS PMS — Revenue Leakage & Receivables Intelligence
CREATE OR REPLACE FUNCTION public.get_manager_revenue_leakage_intelligence(
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
  v_outstanding numeric := 0;
  v_underpaid numeric := 0;
  v_unallocated numeric := 0;
  v_persistent_arrears numeric := 0;
  v_persistent_count integer := 0;
  v_payment_count integer := 0;
  v_top_payer numeric := 0;
  v_concentration numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_months < 1 OR p_months > 24 THEN RAISE EXCEPTION 'Months must be between 1 and 24'; END IF;
  SELECT v_manager = v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN RAISE EXCEPTION 'Revenue leakage scope unauthorized' USING ERRCODE='42501'; END IF;

  SELECT COALESCE(sum(COALESCE(i.original_amount,i.amount)),0),
         COALESCE(sum(COALESCE(i.paid_amount,0)),0),
         COALESCE(sum(GREATEST(0,COALESCE(i.balance_due,COALESCE(i.amount,0)-COALESCE(i.paid_amount,0)))),0)
    INTO v_billed,v_collected,v_outstanding
  FROM public.invoices i
  WHERE i.manager_id=v_manager
    AND i.due_date >= (date_trunc('month',current_date)-make_interval(months=>p_months))::date
    AND i.due_date < (date_trunc('month',current_date)+interval '1 month')::date;

  SELECT COALESCE(sum(GREATEST(0,COALESCE(i.balance_due,0))) FILTER(WHERE i.status IN ('overdue','pending','unpaid','partially_paid')),0)
    INTO v_underpaid
  FROM public.invoices i
  WHERE i.manager_id=v_manager AND COALESCE(i.balance_due,0)>0 AND i.due_date < current_date;

  SELECT COALESCE(sum(GREATEST(0,pt.amount-COALESCE(a.allocated,0))),0)
    INTO v_unallocated
  FROM public.payment_transactions pt
  LEFT JOIN LATERAL (
    SELECT sum(pa.allocated_amount) allocated FROM public.payment_allocations pa WHERE pa.transaction_id=pt.id
  ) a ON true
  WHERE pt.manager_id=v_manager AND pt.status='completed' AND pt.created_at >= (date_trunc('month',current_date)-make_interval(months=>p_months));

  SELECT COALESCE(sum(greatest(0,coalesce(i.balance_due,0))),0), count(*)
    INTO v_persistent_arrears,v_persistent_count
  FROM public.invoices i
  WHERE i.manager_id=v_manager AND COALESCE(i.balance_due,0)>0 AND i.status='overdue'
    AND i.due_date <= current_date-60;

  SELECT count(*), COALESCE(max(p.total_paid),0)
    INTO v_payment_count,v_top_payer
  FROM (
    SELECT pt.payer_party_id, sum(pt.amount) total_paid
    FROM public.payment_transactions pt
    WHERE pt.manager_id=v_manager AND pt.status='completed'
      AND pt.created_at >= (date_trunc('month',current_date)-make_interval(months=>p_months))
      AND pt.payer_party_id IS NOT NULL
    GROUP BY pt.payer_party_id
  ) p;
  v_concentration := CASE WHEN v_collected=0 THEN 0 ELSE round(v_top_payer*100/v_collected,1) END;

  RETURN jsonb_build_object(
    'period_months',p_months,
    'summary',jsonb_build_object(
      'billed',v_billed,'collected',v_collected,'outstanding',v_outstanding,
      'overdue_due_balance',v_underpaid,'unallocated_completed_payments',v_unallocated,
      'persistent_60d_arrears',v_persistent_arrears,'persistent_60d_invoice_count',v_persistent_count,
      'payment_count',v_payment_count,'top_payer_share_pct',v_concentration
    ),
    'receivables',COALESCE((SELECT jsonb_agg(row_to_json(r) ORDER BY r.balance_due DESC) FROM (
      SELECT i.id,i.invoice_number,i.property_id,i.tenant_id,i.due_date,
        COALESCE(i.original_amount,i.amount) original_amount,
        COALESCE(i.paid_amount,0) paid_amount,
        GREATEST(0,COALESCE(i.balance_due,COALESCE(i.amount,0)-COALESCE(i.paid_amount,0))) balance_due,
        GREATEST(0,current_date-i.due_date) days_overdue,
        CASE WHEN current_date-i.due_date>90 THEN '90_plus' WHEN current_date-i.due_date>60 THEN '61_90' WHEN current_date-i.due_date>30 THEN '31_60' ELSE '0_30' END ageing_band
      FROM public.invoices i
      WHERE i.manager_id=v_manager AND COALESCE(i.balance_due,0)>0 AND i.due_date<current_date
      ORDER BY COALESCE(i.balance_due,0) DESC LIMIT 25
    ) r),'[]'::jsonb),
    'property_leakage',COALESCE((SELECT jsonb_agg(row_to_json(x) ORDER BY x.leakage DESC) FROM (
      SELECT p.id,p.name,
        COALESCE((SELECT sum(GREATEST(0,COALESCE(i.balance_due,0))) FROM public.invoices i WHERE i.property_id=p.id AND COALESCE(i.balance_due,0)>0 AND i.due_date<current_date),0) leakage,
        COALESCE((SELECT count(*) FROM public.invoices i WHERE i.property_id=p.id AND COALESCE(i.balance_due,0)>0 AND i.due_date<current_date),0) open_receivables,
        COALESCE((SELECT sum(pt.amount) FROM public.payment_transactions pt WHERE pt.property_id=p.id AND pt.manager_id=v_manager AND pt.status='completed' AND pt.created_at >= (date_trunc('month',current_date)-make_interval(months=>p_months))),0) collected
      FROM public.properties p WHERE p.manager_id=v_manager AND p.status='active'
    ) x),'[]'::jsonb),
    'actions',COALESCE((SELECT jsonb_agg(a.action) FROM (
      SELECT jsonb_build_object('key','overdue_recovery','priority',CASE WHEN v_underpaid>v_billed*0.15 THEN 'high' ELSE 'medium' END,'title','Recover overdue receivables','detail',to_char(v_underpaid,'FM999,999,990.00')||' remains due on invoices past their due date.') action WHERE v_underpaid>0
      UNION ALL SELECT jsonb_build_object('key','allocation_recovery','priority','high','title','Resolve unallocated payments','detail',to_char(v_unallocated,'FM999,999,990.00')||' of completed payment value is not allocated to invoices.') WHERE v_unallocated>0
      UNION ALL SELECT jsonb_build_object('key','persistent_arrears','priority','high','title','Escalate persistent arrears','detail',v_persistent_count||' overdue invoices have remained unpaid for more than 60 days.') WHERE v_persistent_arrears>0
      UNION ALL SELECT jsonb_build_object('key','payer_concentration','priority','medium','title','Review payer concentration','detail','The largest payer represents '||to_char(v_concentration,'FM990.0')||'% of collected value in the selected period.') WHERE v_concentration>=40
    ) a),'[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_manager_revenue_leakage_intelligence(uuid,integer) TO authenticated;
