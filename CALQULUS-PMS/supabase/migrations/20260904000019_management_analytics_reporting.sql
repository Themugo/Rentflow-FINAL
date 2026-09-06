-- CALQULUS PMS — Management Analytics & Operational Reporting
CREATE OR REPLACE FUNCTION public.get_manager_management_analytics(
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
  v_months integer := LEAST(GREATEST(COALESCE(p_months, 6), 3), 12);
  v_allowed boolean;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager = v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN RAISE EXCEPTION 'Management analytics scope unauthorized' USING ERRCODE='42501'; END IF;

  SELECT jsonb_build_object(
    'period_months', v_months,
    'portfolio', jsonb_build_object(
      'properties', (SELECT count(*) FROM public.properties p WHERE p.manager_id=v_manager AND p.status='active'),
      'units', COALESCE((SELECT sum(p.units) FROM public.properties p WHERE p.manager_id=v_manager AND p.status='active'),0),
      'occupied_units', COALESCE((SELECT sum(p.occupied) FROM public.properties p WHERE p.manager_id=v_manager AND p.status='active'),0),
      'vacant_units', GREATEST(0, COALESCE((SELECT sum(p.units-p.occupied) FROM public.properties p WHERE p.manager_id=v_manager AND p.status='active'),0))
    ),
    'collections', jsonb_build_object(
      'billed', COALESCE((SELECT sum(i.amount) FROM public.invoices i WHERE i.manager_id=v_manager AND i.due_date >= date_trunc('month',current_date)::date - ((v_months-1) || ' months')::interval AND i.due_date < (date_trunc('month',current_date)+interval '1 month')::date),0),
      'collected', COALESCE((SELECT sum(COALESCE(i.paid_amount,0)) FROM public.invoices i WHERE i.manager_id=v_manager AND i.due_date >= date_trunc('month',current_date)::date - ((v_months-1) || ' months')::interval AND i.due_date < (date_trunc('month',current_date)+interval '1 month')::date),0),
      'overdue_balance', COALESCE((SELECT sum(COALESCE(i.balance_due,0)) FROM public.invoices i WHERE i.manager_id=v_manager AND i.status='overdue'),0)
    ),
    'operations', jsonb_build_object(
      'maintenance_open', (SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=v_manager AND m.status IN('open','pending','in_progress')),
      'maintenance_urgent', (SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=v_manager AND m.status IN('open','pending','in_progress') AND m.priority IN('urgent','critical')),
      'leases_expiring_30d', (SELECT count(*) FROM public.leases l WHERE l.manager_id=v_manager AND l.status='active' AND l.end_date BETWEEN current_date AND current_date+30),
      'work_active', (SELECT count(*) FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.status IN('open','in_progress')),
      'work_sla_breached', (SELECT count(*) FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.status IN('open','in_progress') AND w.sla_due_at < now()),
      'work_completed_30d', (SELECT count(*) FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.status='completed' AND w.completed_at >= now()-interval '30 days')
    ),
    'monthly_collections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month',x.month,'billed',x.billed,'collected',x.collected,'collection_rate',CASE WHEN x.billed=0 THEN 0 ELSE round((x.collected*100)/x.billed,1) END) ORDER BY x.month)
      FROM (
        SELECT date_trunc('month',i.due_date)::date AS month,
          sum(i.amount) AS billed,
          sum(COALESCE(i.paid_amount,0)) AS collected
        FROM public.invoices i
        WHERE i.manager_id=v_manager
          AND i.due_date >= date_trunc('month',current_date)::date - ((v_months-1) || ' months')::interval
          AND i.due_date < (date_trunc('month',current_date)+interval '1 month')::date
        GROUP BY 1
      ) x
    ),'[]'::jsonb),
    'work_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'role',x.role,'active',x.active_count,'breached',x.breached_count,'completed_30d',x.completed_30d,'avg_completion_days',x.avg_completion_days) ORDER BY x.active_count DESC,x.name)
      FROM (
        SELECT m.id,m.name,m.role,
          count(w.id) FILTER(WHERE w.status IN('open','in_progress')) active_count,
          count(w.id) FILTER(WHERE w.status IN('open','in_progress') AND w.sla_due_at < now()) breached_count,
          count(w.id) FILTER(WHERE w.status='completed' AND w.completed_at >= now()-interval '30 days') completed_30d,
          round(avg(EXTRACT(EPOCH FROM (w.completed_at-w.created_at))/86400.0) FILTER(WHERE w.status='completed' AND w.completed_at >= now()-interval '30 days')::numeric,1) avg_completion_days
        FROM (
          SELECT v_manager id,'manager' role,COALESCE(p.full_name,p.email,'Manager') name FROM public.profiles p WHERE p.id=v_manager
          UNION ALL
          SELECT ms.submanager_user_id id,'submanager' role,COALESCE(p.full_name,p.email,'Submanager') name
          FROM public.manager_submanagers ms LEFT JOIN public.profiles p ON p.id=ms.submanager_user_id
          WHERE ms.manager_id=v_manager
        ) m
        LEFT JOIN public.operation_work_items w ON w.manager_id=v_manager AND w.assigned_to=m.id
        GROUP BY m.id,m.name,m.role
      ) x
    ),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manager_management_analytics(uuid,integer) TO authenticated;
