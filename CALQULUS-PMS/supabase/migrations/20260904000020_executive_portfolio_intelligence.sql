-- CALQULUS PMS — Executive Portfolio Intelligence & Decision Support
CREATE OR REPLACE FUNCTION public.get_manager_executive_portfolio_intelligence(
  p_manager_id uuid DEFAULT auth.uid()
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
  v_units integer := 0;
  v_occupied integer := 0;
  v_vacant integer := 0;
  v_billed numeric := 0;
  v_collected numeric := 0;
  v_overdue numeric := 0;
  v_urgent_maintenance integer := 0;
  v_open_maintenance integer := 0;
  v_expiring_30 integer := 0;
  v_active_work integer := 0;
  v_breached_work integer := 0;
  v_vacancy_rate numeric := 0;
  v_collection_rate numeric := 0;
  v_overdue_rate numeric := 0;
  v_risk_score integer := 0;
  v_health_score integer := 100;
  v_risk_level text;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager = v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id = v_manager AND ms.submanager_user_id = v_uid
  ) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN RAISE EXCEPTION 'Executive portfolio scope unauthorized' USING ERRCODE='42501'; END IF;

  SELECT COALESCE(sum(p.units),0)::integer,
         COALESCE(sum(p.occupied),0)::integer
    INTO v_units, v_occupied
  FROM public.properties p
  WHERE p.manager_id=v_manager AND p.status='active';
  v_vacant := GREATEST(0, v_units-v_occupied);
  v_vacancy_rate := CASE WHEN v_units=0 THEN 0 ELSE round(v_vacant*100.0/v_units,1) END;

  SELECT COALESCE(sum(i.amount),0), COALESCE(sum(COALESCE(i.paid_amount,0)),0),
         COALESCE(sum(COALESCE(i.balance_due,0)) FILTER(WHERE i.status='overdue'),0)
    INTO v_billed, v_collected, v_overdue
  FROM public.invoices i
  WHERE i.manager_id=v_manager
    AND i.due_date >= date_trunc('month',current_date)::date - interval '2 months'
    AND i.due_date < (date_trunc('month',current_date)+interval '1 month')::date;
  v_collection_rate := CASE WHEN v_billed=0 THEN 100 ELSE round(v_collected*100.0/v_billed,1) END;
  v_overdue_rate := CASE WHEN v_billed=0 THEN 0 ELSE round(v_overdue*100.0/v_billed,1) END;

  SELECT count(*) FILTER(WHERE m.status IN('open','pending','in_progress')),
         count(*) FILTER(WHERE m.status IN('open','pending','in_progress') AND m.priority IN('urgent','critical'))
    INTO v_open_maintenance, v_urgent_maintenance
  FROM public.maintenance_requests m WHERE m.manager_id=v_manager;

  SELECT count(*) INTO v_expiring_30
  FROM public.leases l
  WHERE l.manager_id=v_manager AND l.status='active' AND l.end_date BETWEEN current_date AND current_date+30;

  SELECT count(*) FILTER(WHERE w.status IN('open','in_progress')),
         count(*) FILTER(WHERE w.status IN('open','in_progress') AND w.sla_due_at < now())
    INTO v_active_work, v_breached_work
  FROM public.operation_work_items w WHERE w.manager_id=v_manager;

  -- Risk is deliberately explainable: cash 35%, vacancy 20%, service 20%, SLA 15%, lease renewal 10%.
  v_risk_score := LEAST(100, GREATEST(0,
    round(GREATEST(0,100-v_collection_rate)*0.35
      + LEAST(100,v_vacancy_rate*2.0)*0.20
      + LEAST(100,v_urgent_maintenance*12 + GREATEST(0,v_open_maintenance-5)*3)*0.20
      + CASE WHEN v_active_work=0 THEN 0 ELSE LEAST(100,v_breached_work*15.0/v_active_work*100)*0.15 END
      + LEAST(100,v_expiring_30*5.0)*0.10)::integer
  ));
  v_health_score := 100-v_risk_score;
  v_risk_level := CASE WHEN v_risk_score >= 70 THEN 'high' WHEN v_risk_score >= 40 THEN 'medium' ELSE 'low' END;

  SELECT jsonb_build_object(
    'health_score',v_health_score,
    'risk_score',v_risk_score,
    'risk_level',v_risk_level,
    'metrics',jsonb_build_object(
      'units',v_units,'occupied_units',v_occupied,'vacant_units',v_vacant,'vacancy_rate',v_vacancy_rate,
      'collection_rate',v_collection_rate,'overdue_balance',v_overdue,'overdue_rate',v_overdue_rate,
      'urgent_maintenance',v_urgent_maintenance,'open_maintenance',v_open_maintenance,
      'leases_expiring_30d',v_expiring_30,'active_work',v_active_work,'sla_breached',v_breached_work
    ),
    'drivers',jsonb_build_array(
      jsonb_build_object('key','collections','label','Collections','score',LEAST(100,GREATEST(0,round(GREATEST(0,100-v_collection_rate)))),'detail',CASE WHEN v_collection_rate < 80 THEN 'Collection performance requires attention' ELSE 'Collections are within a healthy range' END),
      jsonb_build_object('key','vacancy','label','Vacancy','score',LEAST(100,round(v_vacancy_rate*2.0)),'detail',CASE WHEN v_vacancy_rate > 10 THEN 'Vacancy is materially affecting portfolio utilisation' ELSE 'Vacancy remains controlled' END),
      jsonb_build_object('key','service','label','Maintenance','score',LEAST(100,v_urgent_maintenance*12 + GREATEST(0,v_open_maintenance-5)*3),'detail',CASE WHEN v_urgent_maintenance > 0 THEN 'Urgent maintenance requires management attention' ELSE 'No urgent maintenance pressure detected' END),
      jsonb_build_object('key','sla','label','SLA','score',CASE WHEN v_active_work=0 THEN 0 ELSE LEAST(100,round(v_breached_work*100.0/v_active_work)) END,'detail',CASE WHEN v_breached_work > 0 THEN 'Operational work is breaching SLA' ELSE 'No active SLA breach detected' END),
      jsonb_build_object('key','renewals','label','Renewals','score',LEAST(100,round(v_expiring_30*5.0)),'detail',CASE WHEN v_expiring_30 > 0 THEN 'Leases need renewal decisions within 30 days' ELSE 'No near-term lease renewal pressure detected' END)
    ),
    'actions',jsonb_build_array(
      CASE WHEN v_overdue > 0 THEN jsonb_build_object('priority','high','title','Recover overdue balances','detail',to_char(v_overdue,'FM999G999G999D00') || ' overdue across the portfolio') ELSE NULL END,
      CASE WHEN v_vacant > 0 THEN jsonb_build_object('priority',CASE WHEN v_vacancy_rate > 10 THEN 'high' ELSE 'medium' END,'title','Reduce vacancy','detail',v_vacant || ' vacant unit(s) currently') ELSE NULL END,
      CASE WHEN v_urgent_maintenance > 0 THEN jsonb_build_object('priority','high','title','Resolve urgent maintenance','detail',v_urgent_maintenance || ' urgent/critical request(s) open') ELSE NULL END,
      CASE WHEN v_breached_work > 0 THEN jsonb_build_object('priority','high','title','Clear SLA breaches','detail',v_breached_work || ' active work item(s) are overdue') ELSE NULL END,
      CASE WHEN v_expiring_30 > 0 THEN jsonb_build_object('priority','medium','title','Decide lease renewals','detail',v_expiring_30 || ' active lease(s) expire within 30 days') ELSE NULL END
    )
  ) INTO v_result;

  -- Remove null action entries while preserving an empty array when there is no action.
  v_result := jsonb_set(v_result,'{actions}',COALESCE((SELECT jsonb_agg(a) FROM jsonb_array_elements(v_result->'actions') a WHERE a IS NOT NULL AND a <> 'null'::jsonb),'[]'::jsonb));
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manager_executive_portfolio_intelligence(uuid) TO authenticated;
