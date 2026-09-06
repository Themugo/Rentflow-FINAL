-- CALQULUS PMS — Post-intelligence integration convergence
-- Establishes one operational loop: signal -> recovery case -> owned work -> resolution.
-- Existing tenant_experience work items are retired when a canonical recovery case is created.

ALTER TABLE public.tenant_service_recovery_cases
  ADD COLUMN IF NOT EXISTS work_item_id uuid REFERENCES public.operation_work_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tenant_service_recovery_work_item_idx
  ON public.tenant_service_recovery_cases(work_item_id);

CREATE OR REPLACE FUNCTION public.sync_tenant_service_recovery_cases_atomic(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_manager uuid:=COALESCE(p_manager_id,v_uid);
  v_allowed boolean;
  v_created integer:=0;
  v_work_created integer:=0;
  r record;
  v_case_id uuid;
  v_work_id uuid;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT v_manager=v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN
    RAISE EXCEPTION 'Tenant service recovery scope unauthorized' USING ERRCODE='42501';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(
    public.get_manager_tenant_experience_intelligence(v_manager)->'actions'
  ) x LOOP
    v_case_id:=NULL;
    SELECT c.id INTO v_case_id
    FROM public.tenant_service_recovery_cases c
    WHERE c.manager_id=v_manager
      AND c.tenant_id=(r.value->>'tenant_id')::uuid
      AND c.driver=COALESCE(r.value->>'driver','manual')
      AND c.status NOT IN ('resolved','closed','cancelled')
    ORDER BY c.opened_at DESC
    LIMIT 1;

    IF v_case_id IS NULL THEN
      INSERT INTO public.tenant_service_recovery_cases(
        manager_id,tenant_id,property_id,unit_id,source_type,driver,priority,owner_user_id,created_by
      )
      SELECT v_manager,(r.value->>'tenant_id')::uuid,t.property_id,t.unit_id,
        CASE COALESCE(r.value->>'driver','manual')
          WHEN 'maintenance' THEN 'maintenance'
          WHEN 'service_rating' THEN 'service_rating'
          WHEN 'communication' THEN 'communication'
          WHEN 'payment_friction' THEN 'payment_friction'
          WHEN 'notice_follow_up' THEN 'notice'
          ELSE 'manual'
        END,
        COALESCE(r.value->>'driver','manual'),
        CASE WHEN COALESCE(r.value->>'priority','medium')='high' THEN 'high' ELSE 'normal' END,
        v_uid,v_uid
      FROM public.tenants t
      WHERE t.id=(r.value->>'tenant_id')::uuid AND t.manager_id=v_manager
      RETURNING id INTO v_case_id;
      IF v_case_id IS NOT NULL THEN v_created:=v_created+1; END IF;
    END IF;

    IF v_case_id IS NOT NULL THEN
      SELECT c.work_item_id INTO v_work_id
      FROM public.tenant_service_recovery_cases c
      WHERE c.id=v_case_id;

      IF v_work_id IS NULL THEN
        -- Retire the older generic tenant-experience work item so one issue has one owner/work record.
        UPDATE public.operation_work_items w
        SET status='cancelled',updated_at=now()
        WHERE w.manager_id=v_manager
          AND w.source_type='tenant_experience'
          AND w.source_id=(r.value->>'tenant_id')::uuid
          AND w.status IN ('open','in_progress');

        INSERT INTO public.operation_work_items(
          manager_id,source_type,source_id,title,description,href,priority,assigned_to,assigned_at
        )
        VALUES(
          v_manager,
          'tenant_service_recovery',
          v_case_id,
          COALESCE(r.value->>'title','Review tenant service recovery'),
          COALESCE(r.value->>'tenant_name','Tenant') ||
            CASE WHEN COALESCE(r.value->>'unit_name','')<>'' THEN ' · '||r.value->>'unit_name' ELSE '' END ||
            ' · Driver: '||COALESCE(r.value->>'driver','service_quality'),
          '/tenants',
          CASE WHEN COALESCE(r.value->>'priority','medium')='high' THEN 'high' ELSE 'normal' END,
          v_uid,now()
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_work_id;

        IF v_work_id IS NOT NULL THEN
          UPDATE public.tenant_service_recovery_cases
          SET work_item_id=v_work_id,updated_at=now()
          WHERE id=v_case_id;
          v_work_created:=v_work_created+1;
        ELSE
          SELECT w.id INTO v_work_id
          FROM public.operation_work_items w
          WHERE w.manager_id=v_manager AND w.source_type='tenant_service_recovery' AND w.source_id=v_case_id
          LIMIT 1;
          IF v_work_id IS NOT NULL THEN
            UPDATE public.tenant_service_recovery_cases SET work_item_id=v_work_id,updated_at=now() WHERE id=v_case_id;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'created',v_created,
    'work_created',v_work_created,
    'open_cases',(SELECT count(*) FROM public.tenant_service_recovery_cases WHERE manager_id=v_manager AND status IN ('open','contacted','in_progress')),
    'active_recovery_work',(SELECT count(*) FROM public.operation_work_items WHERE manager_id=v_manager AND source_type='tenant_service_recovery' AND status IN ('open','in_progress'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tenant_experience_work_items_atomic(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_manager uuid:=COALESCE(p_manager_id,v_uid);
  v_allowed boolean;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT v_manager=v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
  ) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN
    RAISE EXCEPTION 'Tenant experience work scope unauthorized' USING ERRCODE='42501';
  END IF;
  v_result:=public.sync_tenant_service_recovery_cases_atomic(v_manager);
  RETURN jsonb_build_object(
    'created',COALESCE((v_result->>'work_created')::integer,0),
    'active',COALESCE((v_result->>'active_recovery_work')::integer,0),
    'canonical_source','tenant_service_recovery'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_tenant_service_recovery_case_atomic(
  p_case_id uuid,p_status text,p_resolution_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_case public.tenant_service_recovery_cases%ROWTYPE;
  v_allowed boolean;
  v_work_status text;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_status NOT IN ('open','contacted','in_progress','resolved','closed','cancelled') THEN
    RAISE EXCEPTION 'Invalid recovery status' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_case FROM public.tenant_service_recovery_cases WHERE id=p_case_id FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Recovery case not found' USING ERRCODE='P0002'; END IF;
  SELECT v_case.manager_id=v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms
    WHERE ms.manager_id=v_case.manager_id AND ms.submanager_user_id=v_uid
  ) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN RAISE EXCEPTION 'Recovery case scope unauthorized' USING ERRCODE='42501'; END IF;

  UPDATE public.tenant_service_recovery_cases SET
    status=p_status,
    first_contacted_at=CASE WHEN p_status IN ('contacted','in_progress','resolved','closed') AND first_contacted_at IS NULL THEN now() ELSE first_contacted_at END,
    resolved_at=CASE WHEN p_status='resolved' THEN now() ELSE resolved_at END,
    closed_at=CASE WHEN p_status='closed' THEN now() ELSE closed_at END,
    resolution_note=CASE WHEN p_resolution_note IS NOT NULL THEN NULLIF(trim(p_resolution_note),'') ELSE resolution_note END,
    updated_at=now()
  WHERE id=v_case.id;

  v_work_status:=CASE
    WHEN p_status='in_progress' THEN 'in_progress'
    WHEN p_status IN ('resolved','closed','cancelled') THEN CASE WHEN p_status='cancelled' THEN 'cancelled' ELSE 'completed' END
    WHEN p_status IN ('open','contacted') THEN 'open'
    ELSE NULL
  END;
  IF v_case.work_item_id IS NOT NULL AND v_work_status IS NOT NULL THEN
    UPDATE public.operation_work_items
    SET status=v_work_status,
        started_at=CASE WHEN v_work_status='in_progress' THEN COALESCE(started_at,now()) ELSE started_at END,
        completed_at=CASE WHEN v_work_status='completed' THEN now() ELSE completed_at END,
        completed_by=CASE WHEN v_work_status='completed' THEN v_uid ELSE completed_by END,
        updated_at=now()
    WHERE id=v_case.work_item_id AND manager_id=v_case.manager_id;
  END IF;
  RETURN jsonb_build_object('id',v_case.id,'status',p_status,'work_item_id',v_case.work_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_tenant_service_recovery_cases_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_tenant_experience_work_items_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_tenant_service_recovery_case_atomic(uuid,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_tenant_service_recovery_cases_atomic(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.sync_tenant_experience_work_items_atomic(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.transition_tenant_service_recovery_case_atomic(uuid,text,text) FROM PUBLIC,anon;
