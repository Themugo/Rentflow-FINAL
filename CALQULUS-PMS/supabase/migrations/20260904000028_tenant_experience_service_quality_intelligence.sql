-- CALQULUS PMS — Tenant Experience & Service Quality Intelligence
-- Deterministic service-quality signals only; no forecasting or likelihood-scoring language.

CREATE INDEX IF NOT EXISTS maintenance_requests_manager_tenant_unit_idx
  ON public.maintenance_requests(manager_id, tenant_email, unit_id, requested_date DESC);
CREATE INDEX IF NOT EXISTS messages_manager_tenant_sent_idx
  ON public.messages(manager_id, tenant_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS tenant_notices_manager_tenant_created_idx
  ON public.tenant_notices(manager_id, tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_manager_tenant_experience_intelligence(
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
    RAISE EXCEPTION 'Tenant experience scope unauthorized' USING ERRCODE='42501';
  END IF;

  WITH tenant_base AS (
    SELECT
      t.id AS tenant_id,
      t.name AS tenant_name,
      t.email,
      t.phone,
      t.property_id,
      t.unit_id,
      COALESCE(t.property,'') AS property_name,
      COALESCE(t.unit,'') AS unit_name,
      l.end_date,
      COALESCE((SELECT count(*) FROM public.maintenance_requests m
        WHERE m.manager_id=v_manager
          AND (m.unit_id=t.unit_id OR (t.unit_id IS NULL AND m.tenant_email=t.email))
          AND m.requested_date >= current_date-90),0)::integer AS maintenance_90d,
      COALESCE((SELECT count(*) FROM public.maintenance_requests m
        WHERE m.manager_id=v_manager
          AND (m.unit_id=t.unit_id OR (t.unit_id IS NULL AND m.tenant_email=t.email))
          AND m.status IN ('open','in_progress')),0)::integer AS open_maintenance,
      COALESCE((SELECT count(*) FROM public.maintenance_requests m
        WHERE m.manager_id=v_manager
          AND (m.unit_id=t.unit_id OR (t.unit_id IS NULL AND m.tenant_email=t.email))
          AND m.status IN ('open','in_progress')
          AND m.requested_date < current_date-7),0)::integer AS aged_maintenance,
      COALESCE((SELECT avg(EXTRACT(EPOCH FROM (m.completion_date::timestamp - m.requested_date::timestamp))/86400.0)
        FROM public.maintenance_requests m
        WHERE m.manager_id=v_manager
          AND (m.unit_id=t.unit_id OR (t.unit_id IS NULL AND m.tenant_email=t.email))
          AND m.status='completed'
          AND m.completion_date IS NOT NULL
          AND m.requested_date >= current_date-90),0)::numeric AS avg_resolution_days,
      COALESCE((SELECT avg(m.tenant_rating)
        FROM public.maintenance_requests m
        WHERE m.manager_id=v_manager
          AND (m.unit_id=t.unit_id OR (t.unit_id IS NULL AND m.tenant_email=t.email))
          AND m.tenant_rating IS NOT NULL
          AND m.requested_date >= current_date-180),0)::numeric AS tenant_rating_avg,
      COALESCE((SELECT count(*) FROM public.maintenance_requests m
        WHERE m.manager_id=v_manager
          AND (m.unit_id=t.unit_id OR (t.unit_id IS NULL AND m.tenant_email=t.email))
          AND m.tenant_rating IS NOT NULL AND m.tenant_rating <= 2
          AND m.requested_date >= current_date-180),0)::integer AS low_ratings,
      COALESCE((SELECT count(*) FROM public.messages msg
        WHERE msg.manager_id=v_manager AND msg.tenant_id=t.id
          AND msg.sender_role='tenant' AND msg.created_at >= now()-interval '90 days'),0)::integer AS tenant_messages_90d,
      COALESCE((SELECT count(*) FROM public.messages msg
        WHERE msg.manager_id=v_manager AND msg.tenant_id=t.id
          AND msg.sender_role='tenant' AND COALESCE(msg.is_read,false)=false),0)::integer AS unread_tenant_messages,
      COALESCE((SELECT count(*) FROM public.tenant_notices n
        WHERE n.manager_id=v_manager AND n.tenant_id=t.id
          AND n.created_at >= now()-interval '90 days'),0)::integer AS notices_90d,
      COALESCE((SELECT count(*) FROM public.tenant_notices n
        WHERE n.manager_id=v_manager AND n.tenant_id=t.id
          AND COALESCE(n.tenant_acknowledged,false)=false
          AND n.sent_at IS NOT NULL),0)::integer AS unacknowledged_notices,
      COALESCE((SELECT sum(COALESCE(i.balance_due,0)) FROM public.invoices i
        WHERE i.tenant_id=t.id AND i.manager_id=v_manager AND i.status='overdue' AND COALESCE(i.balance_due,0)>0),0) AS overdue_balance,
      COALESCE((SELECT count(*) FROM public.invoices i
        WHERE i.tenant_id=t.id AND i.manager_id=v_manager AND i.status='overdue' AND COALESCE(i.balance_due,0)>0),0)::integer AS overdue_count
    FROM public.tenants t
    LEFT JOIN LATERAL (
      SELECT l1.end_date
      FROM public.leases l1
      WHERE l1.tenant_id=t.id AND l1.manager_id=v_manager AND l1.status IN ('active','expiring')
      ORDER BY l1.end_date DESC LIMIT 1
    ) l ON true
    WHERE t.manager_id=v_manager AND t.status='active'
  ), scored AS (
    SELECT b.*,
      GREATEST(0, LEAST(100,
        100
        - LEAST(25, b.aged_maintenance*8 + b.open_maintenance*4)
        - LEAST(20, b.low_ratings*10)
        - LEAST(15, b.unread_tenant_messages*5)
        - LEAST(10, b.unacknowledged_notices*3)
        - CASE WHEN b.overdue_balance>0 THEN LEAST(20, 10 + b.overdue_count*3) ELSE 0 END
      ))::integer AS service_quality_score,
      CASE
        WHEN b.aged_maintenance>0 OR b.open_maintenance>0 THEN 'maintenance'
        WHEN b.low_ratings>0 THEN 'service_rating'
        WHEN b.unread_tenant_messages>0 THEN 'communication'
        WHEN b.overdue_balance>0 THEN 'payment_friction'
        WHEN b.unacknowledged_notices>0 THEN 'notice_follow_up'
        ELSE 'healthy'
      END AS primary_driver
    FROM tenant_base b
  ), enriched AS (
    SELECT s.*,
      CASE WHEN service_quality_score < 50 THEN 'poor' WHEN service_quality_score < 75 THEN 'watch' ELSE 'healthy' END AS service_level,
      CASE
        WHEN aged_maintenance>0 THEN 'Resolve aged maintenance and confirm completion with tenant'
        WHEN low_ratings>0 THEN 'Review low-rated service requests and follow up with tenant'
        WHEN unread_tenant_messages>0 THEN 'Clear unanswered tenant messages and close communication loop'
        WHEN overdue_balance>0 THEN 'Review payment friction separately from service quality'
        WHEN unacknowledged_notices>0 THEN 'Confirm notice delivery, acknowledgement or response'
        ELSE 'No immediate service-quality action flagged'
      END AS recommended_action
    FROM scored s
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'active_tenants', count(*),
      'poor_experience', count(*) FILTER (WHERE service_level='poor'),
      'watch_experience', count(*) FILTER (WHERE service_level='watch'),
      'healthy_experience', count(*) FILTER (WHERE service_level='healthy'),
      'open_maintenance_tenants', count(*) FILTER (WHERE open_maintenance>0),
      'aged_maintenance_tenants', count(*) FILTER (WHERE aged_maintenance>0),
      'low_rating_tenants', count(*) FILTER (WHERE low_ratings>0),
      'unread_communication_tenants', count(*) FILTER (WHERE unread_tenant_messages>0),
      'overdue_tenants', count(*) FILTER (WHERE overdue_balance>0),
      'avg_resolution_days', COALESCE(round(avg(avg_resolution_days) FILTER (WHERE avg_resolution_days>0),1),0),
      'avg_tenant_rating', COALESCE(round(avg(tenant_rating_avg) FILTER (WHERE tenant_rating_avg>0),2),0)
    ),
    'tenants', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.service_quality_score ASC, e.aged_maintenance DESC, e.tenant_name ASC) FROM enriched e), '[]'::jsonb),
    'actions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'priority',CASE WHEN service_level='poor' THEN 'high' ELSE 'medium' END,
      'tenant_id',tenant_id,'tenant_name',tenant_name,'property_name',property_name,'unit_name',unit_name,
      'title',recommended_action,'score',service_quality_score,'driver',primary_driver
    ) ORDER BY service_quality_score ASC) FROM enriched e WHERE service_level IN ('poor','watch')), '[]'::jsonb)
  ) INTO v_result
  FROM enriched;

  RETURN COALESCE(v_result, jsonb_build_object(
    'summary',jsonb_build_object('active_tenants',0,'poor_experience',0,'watch_experience',0,'healthy_experience',0,'open_maintenance_tenants',0,'aged_maintenance_tenants',0,'low_rating_tenants',0,'unread_communication_tenants',0,'overdue_tenants',0,'avg_resolution_days',0,'avg_tenant_rating',0),
    'tenants','[]'::jsonb,'actions','[]'::jsonb
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tenant_experience_work_items_atomic(
  p_manager_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_manager uuid := COALESCE(p_manager_id, v_uid);
  v_allowed boolean;
  v_created integer := 0;
  r record;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT v_manager=v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN
    RAISE EXCEPTION 'Tenant experience work scope unauthorized' USING ERRCODE='42501';
  END IF;

  FOR r IN
    SELECT x.* FROM jsonb_array_elements(
      public.get_manager_tenant_experience_intelligence(v_manager)->'actions'
    ) x
  LOOP
    INSERT INTO public.operation_work_items(
      manager_id, source_type, source_id, title, description, href, priority
    )
    SELECT v_manager,
      'tenant_experience',
      (r.value->>'tenant_id')::uuid,
      COALESCE(r.value->>'title','Review tenant experience'),
      COALESCE(r.value->>'tenant_name','Tenant') ||
        CASE WHEN COALESCE(r.value->>'unit_name','')<>'' THEN ' · '||r.value->>'unit_name' ELSE '' END ||
        ' · Driver: '||COALESCE(r.value->>'driver','service_quality'),
      '/tenants',
      CASE WHEN COALESCE(r.value->>'priority','medium')='high' THEN 'high' ELSE 'normal' END
    WHERE NOT EXISTS (
      SELECT 1 FROM public.operation_work_items w
      WHERE w.manager_id=v_manager
        AND w.source_type='tenant_experience'
        AND w.source_id=(r.value->>'tenant_id')::uuid
        AND w.status NOT IN ('completed','cancelled')
    );
    IF FOUND THEN v_created := v_created + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created',v_created,
    'active',(SELECT count(*) FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.status IN ('open','in_progress') AND w.source_type='tenant_experience')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manager_tenant_experience_intelligence(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_tenant_experience_work_items_atomic(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_manager_tenant_experience_intelligence(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_tenant_experience_work_items_atomic(uuid) FROM anon;
