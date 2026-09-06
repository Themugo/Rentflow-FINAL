-- CALQULUS PMS — Initiative 47: Maintenance SLA, Vendor Dispatch & Completion Assurance
-- Operational assurance around the existing maintenance → vendor → contract → commitment → expenditure chain.
-- No second work-order or financial ledger is introduced.

ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS vendor_dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_verified_by uuid,
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS sla_escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_escalated_at timestamptz;

CREATE INDEX IF NOT EXISTS maintenance_requests_sla_dispatch_idx
  ON public.maintenance_requests(manager_id,status,sla_due_at,priority);
CREATE INDEX IF NOT EXISTS maintenance_requests_vendor_dispatch_idx
  ON public.maintenance_requests(manager_id,vendor_id,vendor_dispatched_at,status);

CREATE OR REPLACE FUNCTION public.set_maintenance_sla_dispatch_atomic(
  p_request_id uuid,
  p_sla_due_at timestamptz DEFAULT NULL,
  p_vendor_dispatched boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.maintenance_requests%ROWTYPE; v_due timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_manage_property_scope(r.manager_id) THEN
    RAISE EXCEPTION 'Maintenance request outside manager scope' USING ERRCODE='42501';
  END IF;
  IF p_vendor_dispatched AND r.vendor_id IS NULL THEN
    RAISE EXCEPTION 'A governed vendor must be assigned before dispatch' USING ERRCODE='55000';
  END IF;
  v_due := COALESCE(p_sla_due_at, r.sla_due_at, r.expected_completion_date::timestamptz);
  IF v_due IS NULL THEN
    v_due := now() + CASE r.priority WHEN 'urgent' THEN interval '4 hours' WHEN 'high' THEN interval '24 hours' ELSE interval '72 hours' END;
  END IF;
  UPDATE public.maintenance_requests
  SET sla_due_at=v_due,
      vendor_dispatched_at=CASE WHEN p_vendor_dispatched THEN COALESCE(vendor_dispatched_at,now()) ELSE vendor_dispatched_at END,
      updated_at=now()
  WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'request_id',r.id,'sla_due_at',v_due,'vendor_dispatched_at',(SELECT vendor_dispatched_at FROM public.maintenance_requests WHERE id=r.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_maintenance_completion_atomic(
  p_request_id uuid,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.maintenance_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.maintenance_requests WHERE id=p_request_id FOR UPDATE;
  IF r.id IS NULL OR NOT public.can_manage_property_scope(r.manager_id) THEN
    RAISE EXCEPTION 'Maintenance request outside manager scope' USING ERRCODE='42501';
  END IF;
  IF r.status <> 'completed' THEN RAISE EXCEPTION 'Only completed work can be verified' USING ERRCODE='55000'; END IF;
  IF r.completion_verified_at IS NOT NULL THEN RAISE EXCEPTION 'Completion is already verified' USING ERRCODE='55000'; END IF;
  UPDATE public.maintenance_requests
  SET completion_verified_at=now(), completion_verified_by=auth.uid(), completion_notes=nullif(trim(p_notes),''), updated_at=now()
  WHERE id=r.id;
  RETURN jsonb_build_object('success',true,'request_id',r.id,'verified_at',(SELECT completion_verified_at FROM public.maintenance_requests WHERE id=r.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.escalate_overdue_maintenance_sla_atomic(
  p_manager_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_manager uuid:=COALESCE(p_manager_id,public.get_effective_manager_id()); v_count integer:=0;
BEGIN
  IF auth.uid() IS NULL OR v_manager IS NULL OR NOT public.can_manage_property_scope(v_manager) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  UPDATE public.maintenance_requests
  SET priority=CASE WHEN priority IN ('urgent') THEN priority ELSE 'urgent' END,
      sla_escalation_level=GREATEST(sla_escalation_level,1),
      sla_escalated_at=COALESCE(sla_escalated_at,now()),
      updated_at=now()
  WHERE manager_id=v_manager
    AND status IN ('open','pending','in_progress')
    AND sla_due_at IS NOT NULL AND sla_due_at < now();
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN jsonb_build_object('success',true,'escalated',v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_maintenance_sla_assurance(
  p_manager_id uuid,
  p_as_of timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'as_of',p_as_of,
    'open_work_orders',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress')),
    'overdue_sla',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress') AND m.sla_due_at IS NOT NULL AND m.sla_due_at<p_as_of),
    'due_next_24h',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress') AND m.sla_due_at>=p_as_of AND m.sla_due_at<=p_as_of+interval '24 hours'),
    'awaiting_dispatch',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress') AND m.vendor_id IS NOT NULL AND m.vendor_dispatched_at IS NULL),
    'awaiting_completion_verification',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status='completed' AND m.completion_verified_at IS NULL),
    'escalated',(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress') AND m.sla_escalation_level>0),
    'completion_rate_30d',CASE WHEN (SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.created_at>=p_as_of-interval '30 days')=0 THEN 0 ELSE round(100.0*(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.status='completed' AND m.completion_date>=p_as_of::date-30)/(SELECT count(*) FROM public.maintenance_requests m WHERE m.manager_id=p_manager_id AND m.created_at>=p_as_of-interval '30 days'),1) END,
    'work_orders',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',m.id,'title',m.title,'property_name',m.property_name,'unit_number',m.unit_number,'priority',m.priority,'status',m.status,
      'requested_date',m.requested_date,'expected_completion_date',m.expected_completion_date,'sla_due_at',m.sla_due_at,
      'vendor_name',v.name,'vendor_dispatched_at',m.vendor_dispatched_at,
      'sla_breached',(m.status IN ('open','pending','in_progress') AND m.sla_due_at IS NOT NULL AND m.sla_due_at<p_as_of),
      'sla_escalation_level',m.sla_escalation_level,'completion_verified_at',m.completion_verified_at,
      'commitment_amount',ec.amount,'commitment_status',ec.status,
      'actual_spend',COALESCE((SELECT sum(e.amount) FROM public.expenditures e WHERE e.maintenance_request_id=m.id),0)
    ) ORDER BY CASE WHEN m.status IN ('open','pending','in_progress') AND m.sla_due_at<p_as_of THEN 0 WHEN m.vendor_id IS NOT NULL AND m.vendor_dispatched_at IS NULL THEN 1 WHEN m.status='completed' AND m.completion_verified_at IS NULL THEN 2 ELSE 3 END, m.sla_due_at NULLS LAST, m.requested_date DESC)
    FROM public.maintenance_requests m
    LEFT JOIN public.management_vendors v ON v.id=m.vendor_id
    LEFT JOIN public.expense_commitments ec ON ec.id=m.expense_commitment_id
    WHERE m.manager_id=p_manager_id AND m.status IN ('open','pending','in_progress','completed') LIMIT 100),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.set_maintenance_sla_dispatch_atomic(uuid,timestamptz,boolean), public.verify_maintenance_completion_atomic(uuid,text), public.escalate_overdue_maintenance_sla_atomic(uuid), public.get_manager_maintenance_sla_assurance(uuid,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_maintenance_sla_dispatch_atomic(uuid,timestamptz,boolean), public.verify_maintenance_completion_atomic(uuid,text), public.escalate_overdue_maintenance_sla_atomic(uuid), public.get_manager_maintenance_sla_assurance(uuid,timestamptz) TO authenticated;
