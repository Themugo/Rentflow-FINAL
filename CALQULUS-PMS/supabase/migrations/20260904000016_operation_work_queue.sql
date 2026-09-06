-- CALQULUS PMS — Operational work queue
-- Turns live portfolio exceptions into scoped, assignable and auditable work items.

CREATE TABLE IF NOT EXISTS public.operation_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  href text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical','high','normal','low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  assigned_to uuid,
  due_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS operation_work_items_active_source_idx
  ON public.operation_work_items(manager_id, source_type, source_id)
  WHERE status NOT IN ('completed','cancelled');
CREATE INDEX IF NOT EXISTS operation_work_items_manager_status_idx
  ON public.operation_work_items(manager_id, status, priority, due_at);
CREATE INDEX IF NOT EXISTS operation_work_items_assignee_idx
  ON public.operation_work_items(assigned_to, status, due_at);

ALTER TABLE public.operation_work_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operation_work_items_manager_select ON public.operation_work_items;
CREATE POLICY operation_work_items_manager_select ON public.operation_work_items
  FOR SELECT TO authenticated
  USING (
    manager_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id = operation_work_items.manager_id AND ms.submanager_user_id = (SELECT auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.sync_operation_work_queue_atomic(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_manager uuid := COALESCE(p_manager_id, v_uid);
  v_ok boolean;
  v_created integer := 0;
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Operation work queue scope unauthorized' USING ERRCODE='42501'; END IF;

  FOR r IN
    SELECT i.id, i.invoice_number, i.amount, i.due_date
    FROM public.invoices i
    WHERE i.manager_id=v_manager AND i.status NOT IN ('paid','cancelled') AND i.due_date < CURRENT_DATE
    ORDER BY i.due_date ASC LIMIT 100
  LOOP
    INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority,due_at)
    SELECT v_manager,'invoice_overdue',r.id,'Collect overdue invoice '||r.invoice_number,
      'Invoice is overdue by '||(CURRENT_DATE-r.due_date)||' day(s). Outstanding amount: '||COALESCE(r.amount,0)::text,
      '/billing?filter=overdue','high',r.due_date::timestamptz
    WHERE NOT EXISTS (SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='invoice_overdue' AND w.source_id=r.id AND w.status NOT IN ('completed','cancelled'));
    IF FOUND THEN v_created := v_created + 1; END IF;
  END LOOP;

  FOR r IN
    SELECT m.id, m.title, m.priority, m.property_name, m.unit_number
    FROM public.maintenance_requests m
    WHERE m.manager_id=v_manager AND m.status IN ('open','pending','in_progress')
    ORDER BY CASE WHEN m.priority='urgent' THEN 0 WHEN m.priority='high' THEN 1 ELSE 2 END, m.created_at ASC LIMIT 100
  LOOP
    INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority)
    SELECT v_manager,'maintenance',r.id,r.title,
      COALESCE(r.property_name,'')||CASE WHEN r.unit_number IS NOT NULL THEN ' · Unit '||r.unit_number ELSE '' END,
      '/maintenance',CASE WHEN r.priority='urgent' THEN 'critical' WHEN r.priority='high' THEN 'high' ELSE 'normal' END
    WHERE NOT EXISTS (SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='maintenance' AND w.source_id=r.id AND w.status NOT IN ('completed','cancelled'));
    IF FOUND THEN v_created := v_created + 1; END IF;
  END LOOP;

  FOR r IN
    SELECT l.id, l.property, l.unit, l.end_date
    FROM public.leases l
    WHERE l.manager_id=v_manager AND l.status='active' AND l.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30
    ORDER BY l.end_date ASC LIMIT 100
  LOOP
    INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority,due_at)
    SELECT v_manager,'lease_expiry',r.id,'Renew lease · '||COALESCE(r.property,'Property')||' · '||COALESCE(r.unit,'Unit'),
      'Lease expires on '||r.end_date::text||'. Review renewal or notice before the deadline.',
      '/leases','high',r.end_date::timestamptz
    WHERE NOT EXISTS (SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='lease_expiry' AND w.source_id=r.id AND w.status NOT IN ('completed','cancelled'));
    IF FOUND THEN v_created := v_created + 1; END IF;
  END LOOP;

  FOR r IN
    SELECT u.id, u.unit_number, u.property_id
    FROM public.units u
    WHERE u.status='vacant' LIMIT 100
  LOOP
    IF EXISTS (SELECT 1 FROM public.properties p WHERE p.id=r.property_id AND p.manager_id=v_manager) THEN
      INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority)
      SELECT v_manager,'vacancy',r.id,'Fill vacant unit '||r.unit_number,'Unit is currently vacant and requires marketing or placement.','/properties','normal'
      WHERE NOT EXISTS (SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='vacancy' AND w.source_id=r.id AND w.status NOT IN ('completed','cancelled'));
      IF FOUND THEN v_created := v_created + 1; END IF;
    END IF;
  END LOOP;

  FOR r IN
    SELECT pt.id, pt.amount, pt.status, pt.created_at
    FROM public.payment_transactions pt
    WHERE pt.manager_id=v_manager AND (
      (pt.status IN ('pending','initiating') AND COALESCE(pt.initiated_at,pt.created_at) < now()-interval '60 minutes')
      OR pt.status='failed' AND COALESCE(pt.updated_at,pt.created_at) >= now()-interval '24 hours'
      OR pt.status='completed' AND NOT EXISTS (SELECT 1 FROM public.issued_payment_receipts x WHERE x.transaction_id=pt.id)
      OR pt.status='completed' AND ABS(pt.amount-COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa WHERE pa.transaction_id=pt.id),0)) > 0.01
    )
    ORDER BY pt.created_at DESC LIMIT 100
  LOOP
    INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority)
    SELECT v_manager,'payment_exception',r.id,'Resolve payment exception','Payment transaction requires reconciliation, recovery or receipt review.','/billing','critical'
    WHERE NOT EXISTS (SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='payment_exception' AND w.source_id=r.id AND w.status NOT IN ('completed','cancelled'));
    IF FOUND THEN v_created := v_created + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('created',v_created,'active',(SELECT count(*) FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.status IN ('open','in_progress')));
END $$;
GRANT EXECUTE ON FUNCTION public.sync_operation_work_queue_atomic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_operation_work_queue(p_manager_id uuid DEFAULT auth.uid(), p_status text DEFAULT 'active')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_ok boolean; v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Operation work queue scope unauthorized' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',w.id,'source_type',w.source_type,'source_id',w.source_id,'title',w.title,'description',w.description,'href',w.href,'priority',w.priority,'status',w.status,'assigned_to',w.assigned_to,'assignee_id',w.assigned_to,'assignee_name',COALESCE(p.full_name,''),'due_at',w.due_at,'sla_due_at',w.sla_due_at,'created_at',w.created_at,'updated_at',w.updated_at) ORDER BY CASE w.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,w.due_at NULLS LAST,w.created_at DESC),'[]'::jsonb)
  INTO v_result
  FROM public.operation_work_items w LEFT JOIN public.profiles p ON p.id=w.assigned_to
  WHERE w.manager_id=v_manager AND (p_status='all' OR (p_status='active' AND w.status IN ('open','in_progress')) OR w.status=p_status);
  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.get_operation_work_queue(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_operation_work_item_atomic(p_item_id uuid,p_assignee_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_item public.operation_work_items%ROWTYPE; v_ok boolean; v_assignee_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_item FROM public.operation_work_items WHERE id=p_item_id FOR UPDATE;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'Work item not found' USING ERRCODE='P0002'; END IF;
  SELECT v_item.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_item.manager_id AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Work item scope unauthorized' USING ERRCODE='42501'; END IF;
  SELECT p_assignee_id=v_item.manager_id OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_item.manager_id AND ms.submanager_user_id=p_assignee_id) INTO v_assignee_ok;
  IF NOT COALESCE(v_assignee_ok,false) THEN RAISE EXCEPTION 'Assignee is outside manager team' USING ERRCODE='42501'; END IF;
  UPDATE public.operation_work_items SET assigned_to=p_assignee_id,updated_at=now() WHERE id=v_item.id;
  RETURN jsonb_build_object('id',v_item.id,'assigned_to',p_assignee_id);
END $$;
GRANT EXECUTE ON FUNCTION public.assign_operation_work_item_atomic(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.transition_operation_work_item_atomic(p_item_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_item public.operation_work_items%ROWTYPE; v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('open','in_progress','completed','cancelled') THEN RAISE EXCEPTION 'Invalid work item status' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_item FROM public.operation_work_items WHERE id=p_item_id FOR UPDATE;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'Work item not found' USING ERRCODE='P0002'; END IF;
  SELECT v_item.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_item.manager_id AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Work item scope unauthorized' USING ERRCODE='42501'; END IF;
  UPDATE public.operation_work_items SET status=p_status,updated_at=now(),completed_at=CASE WHEN p_status='completed' THEN now() ELSE NULL END,completed_by=CASE WHEN p_status='completed' THEN v_uid ELSE NULL END WHERE id=v_item.id;
  RETURN jsonb_build_object('id',v_item.id,'status',p_status);
END $$;
GRANT EXECUTE ON FUNCTION public.transition_operation_work_item_atomic(uuid,text) TO authenticated;
