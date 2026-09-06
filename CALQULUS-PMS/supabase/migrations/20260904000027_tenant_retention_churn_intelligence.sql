-- CALQULUS PMS — Tenant Retention & Churn Intelligence
-- Explainable risk signals only; no predictive/probabilistic claim.
CREATE OR REPLACE FUNCTION public.get_manager_tenant_retention_intelligence(
  p_manager_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_manager uuid := COALESCE(p_manager_id, v_uid);
  v_allowed boolean;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT v_manager=v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN
    RAISE EXCEPTION 'Tenant retention scope unauthorized' USING ERRCODE='42501';
  END IF;

  WITH tenant_base AS (
    SELECT t.id tenant_id, t.name tenant_name, t.email, t.phone, t.property_id, t.unit_id,
      COALESCE(t.property,'') property_name, COALESCE(t.unit,'') unit_name,
      l.id lease_id, l.end_date, l.monthly_rent,
      COALESCE((SELECT sum(COALESCE(i.balance_due,0)) FROM public.invoices i
        WHERE i.tenant_id=t.id AND i.manager_id=v_manager AND i.status='overdue' AND COALESCE(i.balance_due,0)>0),0) overdue_balance,
      COALESCE((SELECT count(*) FROM public.invoices i
        WHERE i.tenant_id=t.id AND i.manager_id=v_manager AND i.status='overdue' AND COALESCE(i.balance_due,0)>0),0)::integer overdue_count,
      COALESCE((SELECT count(*) FROM public.maintenance_requests m
        WHERE m.manager_id=v_manager AND (m.unit_id=t.unit_id OR (t.unit_id IS NULL AND m.tenant_name=t.name))
          AND m.requested_date >= current_date-90),0)::integer maintenance_90d,
      COALESCE((SELECT count(*) FROM public.maintenance_requests m
        WHERE m.manager_id=v_manager AND (m.unit_id=t.unit_id OR (t.unit_id IS NULL AND m.tenant_name=t.name))
          AND m.status IN ('open','pending','in_progress')),0)::integer open_maintenance,
      COALESCE((SELECT count(*) FROM public.lease_renewal_cases c
        WHERE c.tenant_id=t.id AND c.manager_id=v_manager AND c.status IN ('declined','notice_to_vacate')),0)::integer negative_renewal_signals,
      COALESCE((SELECT count(*) FROM public.lease_renewal_cases c
        WHERE c.tenant_id=t.id AND c.manager_id=v_manager AND c.status IN ('sent','negotiating')
          AND c.tenant_decision IS NULL),0)::integer renewal_pending,
      COALESCE((SELECT count(*) FROM public.lease_renewal_cases c
        WHERE c.tenant_id=t.id AND c.manager_id=v_manager AND c.status='accepted'),0)::integer accepted_renewals
    FROM public.tenants t
    LEFT JOIN LATERAL (
      SELECT l1.* FROM public.leases l1
      WHERE l1.tenant_id=t.id AND l1.manager_id=v_manager AND l1.status IN ('active','expiring')
      ORDER BY l1.end_date DESC LIMIT 1
    ) l ON true
    WHERE t.manager_id=v_manager AND t.status='active'
  ), scored AS (
    SELECT b.*,
      LEAST(100, GREATEST(0,
        LEAST(35, CASE WHEN b.overdue_balance>0 THEN 15 + LEAST(20,b.overdue_count*5) ELSE 0 END)
        + LEAST(25, b.maintenance_90d*5 + b.open_maintenance*5)
        + LEAST(30, b.negative_renewal_signals*20 + CASE WHEN b.end_date BETWEEN current_date AND current_date+90 AND b.renewal_pending>0 THEN 10 ELSE 0 END)
        + CASE WHEN b.end_date BETWEEN current_date AND current_date+30 THEN 10 ELSE 0 END
      ))::integer churn_risk_score,
      CASE
        WHEN b.negative_renewal_signals>0 THEN 'renewal_decision'
        WHEN b.overdue_balance>0 THEN 'payment_stress'
        WHEN b.open_maintenance>0 OR b.maintenance_90d>=2 THEN 'service_experience'
        WHEN b.end_date BETWEEN current_date AND current_date+30 THEN 'renewal_window'
        ELSE 'stable'
      END primary_driver
    FROM tenant_base b
  ), enriched AS (
    SELECT s.*, CASE WHEN churn_risk_score>=70 THEN 'high' WHEN churn_risk_score>=40 THEN 'medium' ELSE 'low' END risk_level,
      CASE
        WHEN negative_renewal_signals>0 THEN 'Contact tenant and resolve renewal/exit decision'
        WHEN overdue_balance>0 THEN 'Review arrears and recovery position'
        WHEN open_maintenance>0 OR maintenance_90d>=2 THEN 'Review recent service issues and close outstanding maintenance'
        WHEN end_date BETWEEN current_date AND current_date+30 THEN 'Prioritize renewal conversation'
        ELSE 'No immediate retention action flagged'
      END recommended_action
    FROM scored s
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'active_tenants', count(*),
      'high_risk', count(*) FILTER (WHERE risk_level='high'),
      'medium_risk', count(*) FILTER (WHERE risk_level='medium'),
      'low_risk', count(*) FILTER (WHERE risk_level='low'),
      'overdue_tenants', count(*) FILTER (WHERE overdue_balance>0),
      'service_issue_tenants', count(*) FILTER (WHERE open_maintenance>0 OR maintenance_90d>=2),
      'renewal_decision_tenants', count(*) FILTER (WHERE negative_renewal_signals>0 OR renewal_pending>0)
    ),
    'tenants', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.churn_risk_score DESC, e.end_date ASC NULLS LAST, e.tenant_name ASC) FROM enriched e), '[]'::jsonb),
    'actions', COALESCE((SELECT jsonb_agg(jsonb_build_object('priority',CASE WHEN risk_level='high' THEN 'high' ELSE 'medium' END,'tenant_id',tenant_id,'tenant_name',tenant_name,'property_name',property_name,'unit_name',unit_name,'title',recommended_action,'score',churn_risk_score) ORDER BY churn_risk_score DESC) FROM enriched e WHERE churn_risk_score>=40), '[]'::jsonb)
  ) INTO v_result
  FROM enriched;
  RETURN COALESCE(v_result, jsonb_build_object('summary',jsonb_build_object('active_tenants',0,'high_risk',0,'medium_risk',0,'low_risk',0,'overdue_tenants',0,'service_issue_tenants',0,'renewal_decision_tenants',0),'tenants','[]'::jsonb,'actions','[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manager_tenant_retention_intelligence(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_manager_tenant_retention_intelligence(uuid) FROM anon;
