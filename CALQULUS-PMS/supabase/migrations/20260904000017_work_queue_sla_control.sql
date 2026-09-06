-- CALQULUS PMS — Work Queue SLA & escalation control
ALTER TABLE public.operation_work_items
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0;

UPDATE public.operation_work_items
SET sla_due_at = COALESCE(sla_due_at, created_at + CASE priority WHEN 'critical' THEN interval '4 hours' WHEN 'high' THEN interval '24 hours' WHEN 'normal' THEN interval '72 hours' ELSE interval '168 hours' END)
WHERE sla_due_at IS NULL;

CREATE INDEX IF NOT EXISTS operation_work_items_sla_idx
  ON public.operation_work_items(manager_id, status, sla_due_at, priority);

CREATE OR REPLACE FUNCTION public.get_operation_work_queue_metrics(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_ok boolean; v_result jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT v_manager=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
 IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Work queue scope unauthorized' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'active',count(*) FILTER(WHERE status IN('open','in_progress')),
  'unassigned',count(*) FILTER(WHERE status IN('open','in_progress') AND assigned_to IS NULL),
  'due_today',count(*) FILTER(WHERE status IN('open','in_progress') AND sla_due_at IS NOT NULL AND sla_due_at<=date_trunc('day',now())+interval '1 day'),
  'sla_breached',count(*) FILTER(WHERE status IN('open','in_progress') AND sla_due_at IS NOT NULL AND sla_due_at<now()),
  'critical',count(*) FILTER(WHERE status IN('open','in_progress') AND priority='critical'),
  'escalated',count(*) FILTER(WHERE status IN('open','in_progress') AND escalation_level>0)
 ) INTO v_result FROM public.operation_work_items WHERE manager_id=v_manager;
 RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.get_operation_work_queue_metrics(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.escalate_overdue_operation_work_atomic(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_ok boolean; v_count integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT v_manager=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
 IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Work queue scope unauthorized' USING ERRCODE='42501'; END IF;
 UPDATE public.operation_work_items
 SET priority='critical', escalation_level=GREATEST(escalation_level,1), escalated_at=COALESCE(escalated_at,now()), updated_at=now()
 WHERE manager_id=v_manager AND status IN('open','in_progress') AND sla_due_at IS NOT NULL AND sla_due_at<now() AND priority<>'critical';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN jsonb_build_object('escalated',v_count);
END $$;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_operation_work_atomic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_operation_work_queue_atomic(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_ok boolean; v_created integer:=0; r record;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT v_manager=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
 IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Operation work queue scope unauthorized' USING ERRCODE='42501'; END IF;
 FOR r IN SELECT i.id,i.invoice_number,i.amount,i.due_date FROM public.invoices i WHERE i.manager_id=v_manager AND i.status NOT IN('paid','cancelled') AND i.due_date<CURRENT_DATE ORDER BY i.due_date ASC LIMIT 100 LOOP
  INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority,due_at,sla_due_at)
  SELECT v_manager,'invoice_overdue',r.id,'Collect overdue invoice '||r.invoice_number,'Invoice is overdue by '||(CURRENT_DATE-r.due_date)||' day(s). Outstanding amount: '||COALESCE(r.amount,0)::text,'/billing?filter=overdue','high',r.due_date::timestamptz,now()+interval '24 hours'
  WHERE NOT EXISTS(SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='invoice_overdue' AND w.source_id=r.id AND w.status NOT IN('completed','cancelled')); IF FOUND THEN v_created:=v_created+1; END IF;
 END LOOP;
 FOR r IN SELECT m.id,m.title,m.priority,m.property_name,m.unit_number FROM public.maintenance_requests m WHERE m.manager_id=v_manager AND m.status IN('open','pending','in_progress') ORDER BY CASE WHEN m.priority='urgent' THEN 0 WHEN m.priority='high' THEN 1 ELSE 2 END,m.created_at ASC LIMIT 100 LOOP
  INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority,sla_due_at)
  SELECT v_manager,'maintenance',r.id,r.title,COALESCE(r.property_name,'')||CASE WHEN r.unit_number IS NOT NULL THEN ' · Unit '||r.unit_number ELSE '' END,'/maintenance',CASE WHEN r.priority='urgent' THEN 'critical' WHEN r.priority='high' THEN 'high' ELSE 'normal' END,now()+CASE WHEN r.priority='urgent' THEN interval '4 hours' WHEN r.priority='high' THEN interval '24 hours' ELSE interval '72 hours' END
  WHERE NOT EXISTS(SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='maintenance' AND w.source_id=r.id AND w.status NOT IN('completed','cancelled')); IF FOUND THEN v_created:=v_created+1; END IF;
 END LOOP;
 FOR r IN SELECT l.id,l.property,l.unit,l.end_date FROM public.leases l WHERE l.manager_id=v_manager AND l.status='active' AND l.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30 ORDER BY l.end_date ASC LIMIT 100 LOOP
  INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority,due_at,sla_due_at)
  SELECT v_manager,'lease_expiry',r.id,'Renew lease · '||COALESCE(r.property,'Property')||' · '||COALESCE(r.unit,'Unit'),'Lease expires on '||r.end_date::text||'. Review renewal or notice before the deadline.','/leases','high',r.end_date::timestamptz,now()+interval '24 hours'
  WHERE NOT EXISTS(SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='lease_expiry' AND w.source_id=r.id AND w.status NOT IN('completed','cancelled')); IF FOUND THEN v_created:=v_created+1; END IF;
 END LOOP;
 FOR r IN SELECT u.id,u.unit_number,u.property_id FROM public.units u WHERE u.status='vacant' LIMIT 100 LOOP
  IF EXISTS(SELECT 1 FROM public.properties p WHERE p.id=r.property_id AND p.manager_id=v_manager) THEN
   INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority,sla_due_at)
   SELECT v_manager,'vacancy',r.id,'Fill vacant unit '||r.unit_number,'Unit is currently vacant and requires marketing or placement.','/properties','normal',now()+interval '72 hours'
   WHERE NOT EXISTS(SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='vacancy' AND w.source_id=r.id AND w.status NOT IN('completed','cancelled')); IF FOUND THEN v_created:=v_created+1; END IF;
  END IF;
 END LOOP;
 FOR r IN SELECT pt.id,pt.amount,pt.status,pt.created_at FROM public.payment_transactions pt WHERE pt.manager_id=v_manager AND ((pt.status IN('pending','initiating') AND COALESCE(pt.initiated_at,pt.created_at)<now()-interval '60 minutes') OR pt.status='failed' AND COALESCE(pt.updated_at,pt.created_at)>=now()-interval '24 hours' OR pt.status='completed' AND NOT EXISTS(SELECT 1 FROM public.issued_payment_receipts x WHERE x.transaction_id=pt.id) OR pt.status='completed' AND ABS(pt.amount-COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa WHERE pa.transaction_id=pt.id),0))>0.01) ORDER BY pt.created_at DESC LIMIT 100 LOOP
  INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority,sla_due_at)
  SELECT v_manager,'payment_exception',r.id,'Resolve payment exception','Payment transaction requires reconciliation, recovery or receipt review.','/billing','critical',now()+interval '4 hours'
  WHERE NOT EXISTS(SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='payment_exception' AND w.source_id=r.id AND w.status NOT IN('completed','cancelled')); IF FOUND THEN v_created:=v_created+1; END IF;
 END LOOP;
 RETURN jsonb_build_object('created',v_created,'active',(SELECT count(*) FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.status IN('open','in_progress')));
END $$;
GRANT EXECUTE ON FUNCTION public.sync_operation_work_queue_atomic(uuid) TO authenticated;
