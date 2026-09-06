-- CALQULUS PMS — Tenant Service Recovery & Communication Loop
-- Converts material tenant-experience issues into trackable recovery cases and
-- auditable follow-up communications. No forecasting or likelihood-scoring language.

CREATE TABLE IF NOT EXISTS public.tenant_service_recovery_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('maintenance','service_rating','communication','notice','payment_friction','renewal','manual')),
  source_id uuid,
  driver text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical','high','normal','low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','contacted','in_progress','resolved','closed','cancelled')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  first_contacted_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_service_recovery_active_idx
  ON public.tenant_service_recovery_cases(manager_id, tenant_id, driver)
  WHERE status NOT IN ('resolved','closed','cancelled');
CREATE INDEX IF NOT EXISTS tenant_service_recovery_manager_status_idx
  ON public.tenant_service_recovery_cases(manager_id, status, priority, opened_at DESC);
CREATE INDEX IF NOT EXISTS tenant_service_recovery_tenant_idx
  ON public.tenant_service_recovery_cases(tenant_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS public.tenant_service_recovery_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tenant_service_recovery_cases(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app','sms','email','whatsapp')),
  subject text,
  body text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','cancelled')),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_service_recovery_comms_queue_idx
  ON public.tenant_service_recovery_communications(manager_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS tenant_service_recovery_comms_case_idx
  ON public.tenant_service_recovery_communications(case_id, created_at DESC);

ALTER TABLE public.tenant_service_recovery_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_service_recovery_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_service_recovery_cases_select ON public.tenant_service_recovery_cases;
CREATE POLICY tenant_service_recovery_cases_select ON public.tenant_service_recovery_cases
  FOR SELECT TO authenticated
  USING (
    manager_id=(SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.manager_submanagers ms
      WHERE ms.manager_id=tenant_service_recovery_cases.manager_id
        AND ms.submanager_user_id=(SELECT auth.uid())
    )
  );
DROP POLICY IF EXISTS tenant_service_recovery_comms_select ON public.tenant_service_recovery_communications;
CREATE POLICY tenant_service_recovery_comms_select ON public.tenant_service_recovery_communications
  FOR SELECT TO authenticated
  USING (
    manager_id=(SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.manager_submanagers ms
      WHERE ms.manager_id=tenant_service_recovery_communications.manager_id
        AND ms.submanager_user_id=(SELECT auth.uid())
    )
  );

REVOKE ALL ON public.tenant_service_recovery_cases FROM anon, authenticated;
REVOKE ALL ON public.tenant_service_recovery_communications FROM anon, authenticated;
GRANT SELECT ON public.tenant_service_recovery_cases TO authenticated;
GRANT SELECT ON public.tenant_service_recovery_communications TO authenticated;

CREATE OR REPLACE FUNCTION public.get_manager_tenant_service_recovery_dashboard(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_manager uuid := COALESCE(p_manager_id,v_uid);
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
    RAISE EXCEPTION 'Tenant service recovery scope unauthorized' USING ERRCODE='42501';
  END IF;

  WITH c AS (
    SELECT r.*, t.name tenant_name, COALESCE(t.property,'') property_name, COALESCE(t.unit,'') unit_name,
      COALESCE((SELECT count(*) FROM public.tenant_service_recovery_communications rc WHERE rc.case_id=r.id AND rc.status='queued'),0)::integer queued_communications,
      COALESCE((SELECT count(*) FROM public.tenant_service_recovery_communications rc WHERE rc.case_id=r.id AND rc.status='sent'),0)::integer sent_communications
    FROM public.tenant_service_recovery_cases r
    JOIN public.tenants t ON t.id=r.tenant_id
    WHERE r.manager_id=v_manager
  )
  SELECT jsonb_build_object(
    'summary',jsonb_build_object(
      'open_cases',count(*) FILTER (WHERE status IN ('open','contacted','in_progress')),
      'critical_cases',count(*) FILTER (WHERE priority='critical' AND status NOT IN ('resolved','closed','cancelled')),
      'high_cases',count(*) FILTER (WHERE priority='high' AND status NOT IN ('resolved','closed','cancelled')),
      'awaiting_contact',count(*) FILTER (WHERE status='open'),
      'in_progress',count(*) FILTER (WHERE status='in_progress'),
      'resolved_30d',count(*) FILTER (WHERE status IN ('resolved','closed') AND COALESCE(resolved_at,closed_at)>=now()-interval '30 days'),
      'queued_followups',COALESCE(sum(queued_communications),0)
    ),
    'cases',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY CASE c.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,c.opened_at ASC) FROM c),'[]'::jsonb)
  ) INTO v_result FROM c;
  RETURN COALESCE(v_result,jsonb_build_object('summary',jsonb_build_object(),'cases','[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tenant_service_recovery_cases_atomic(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_allowed boolean; v_created integer:=0; r record;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN RAISE EXCEPTION 'Tenant service recovery scope unauthorized' USING ERRCODE='42501'; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(public.get_manager_tenant_experience_intelligence(v_manager)->'actions') x LOOP
    INSERT INTO public.tenant_service_recovery_cases(manager_id,tenant_id,property_id,unit_id,source_type,driver,priority,owner_user_id,created_by)
    SELECT v_manager,(r.value->>'tenant_id')::uuid,t.property_id,t.unit_id,
      CASE COALESCE(r.value->>'driver','manual') WHEN 'maintenance' THEN 'maintenance' WHEN 'service_rating' THEN 'service_rating' WHEN 'communication' THEN 'communication' WHEN 'payment_friction' THEN 'payment_friction' WHEN 'notice_follow_up' THEN 'notice' ELSE 'manual' END,
      COALESCE(r.value->>'driver','manual'),CASE WHEN COALESCE(r.value->>'priority','medium')='high' THEN 'high' ELSE 'normal' END,v_uid,v_uid
    FROM public.tenants t WHERE t.id=(r.value->>'tenant_id')::uuid AND t.manager_id=v_manager
    AND NOT EXISTS (
      SELECT 1 FROM public.tenant_service_recovery_cases c
      WHERE c.manager_id=v_manager AND c.tenant_id=(r.value->>'tenant_id')::uuid AND c.driver=COALESCE(r.value->>'driver','manual') AND c.status NOT IN ('resolved','closed','cancelled')
    );
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('created',v_created,'open_cases',(SELECT count(*) FROM public.tenant_service_recovery_cases WHERE manager_id=v_manager AND status IN ('open','contacted','in_progress')));
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_tenant_service_recovery_case_atomic(p_case_id uuid,p_status text,p_resolution_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_uid uuid:=auth.uid(); v_case public.tenant_service_recovery_cases%ROWTYPE; v_allowed boolean;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('open','contacted','in_progress','resolved','closed','cancelled') THEN RAISE EXCEPTION 'Invalid recovery status' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_case FROM public.tenant_service_recovery_cases WHERE id=p_case_id FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Recovery case not found' USING ERRCODE='P0002'; END IF;
  SELECT v_case.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_case.manager_id AND ms.submanager_user_id=v_uid) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN RAISE EXCEPTION 'Recovery case scope unauthorized' USING ERRCODE='42501'; END IF;
  UPDATE public.tenant_service_recovery_cases SET status=p_status,
    first_contacted_at=CASE WHEN p_status IN ('contacted','in_progress','resolved','closed') AND first_contacted_at IS NULL THEN now() ELSE first_contacted_at END,
    resolved_at=CASE WHEN p_status='resolved' THEN now() ELSE resolved_at END,
    closed_at=CASE WHEN p_status='closed' THEN now() ELSE closed_at END,
    resolution_note=CASE WHEN p_resolution_note IS NOT NULL THEN NULLIF(trim(p_resolution_note),'') ELSE resolution_note END,
    updated_at=now()
  WHERE id=v_case.id;
  RETURN jsonb_build_object('id',v_case.id,'status',p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_tenant_service_recovery_followup_atomic(p_case_id uuid,p_channel text,p_subject text,p_body text,p_scheduled_at timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_uid uuid:=auth.uid(); v_case public.tenant_service_recovery_cases%ROWTYPE; v_allowed boolean; v_id uuid;
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_channel NOT IN ('in_app','sms','email','whatsapp') THEN RAISE EXCEPTION 'Invalid communication channel' USING ERRCODE='22023'; END IF;
  IF NULLIF(trim(p_body),'') IS NULL THEN RAISE EXCEPTION 'Follow-up message is required' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_case FROM public.tenant_service_recovery_cases WHERE id=p_case_id FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Recovery case not found' USING ERRCODE='P0002'; END IF;
  SELECT v_case.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_case.manager_id AND ms.submanager_user_id=v_uid) INTO v_allowed;
  IF NOT COALESCE(v_allowed,false) THEN RAISE EXCEPTION 'Recovery case scope unauthorized' USING ERRCODE='42501'; END IF;
  INSERT INTO public.tenant_service_recovery_communications(case_id,manager_id,tenant_id,channel,subject,body,scheduled_at,created_by)
  VALUES(v_case.id,v_case.manager_id,v_case.tenant_id,p_channel,NULLIF(trim(p_subject),''),trim(p_body),COALESCE(p_scheduled_at,now()),v_uid)
  RETURNING id INTO v_id;
  UPDATE public.tenant_service_recovery_cases SET status=CASE WHEN status='open' THEN 'contacted' ELSE status END,first_contacted_at=COALESCE(first_contacted_at,now()),updated_at=now() WHERE id=v_case.id;
  RETURN jsonb_build_object('id',v_id,'case_id',v_case.id,'status','queued');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_manager_tenant_service_recovery_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_tenant_service_recovery_cases_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_tenant_service_recovery_case_atomic(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_tenant_service_recovery_followup_atomic(uuid,text,text,text,timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_manager_tenant_service_recovery_dashboard(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_tenant_service_recovery_cases_atomic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transition_tenant_service_recovery_case_atomic(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.queue_tenant_service_recovery_followup_atomic(uuid,text,text,text,timestamptz) FROM anon;
