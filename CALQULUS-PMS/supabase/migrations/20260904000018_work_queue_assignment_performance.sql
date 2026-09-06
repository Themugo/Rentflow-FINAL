-- CALQULUS PMS — Work Queue Assignment & Team Performance
ALTER TABLE public.operation_work_items
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

CREATE INDEX IF NOT EXISTS operation_work_items_team_performance_idx
  ON public.operation_work_items(manager_id, assigned_to, status, priority, sla_due_at);

CREATE OR REPLACE FUNCTION public.get_operation_work_team(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_ok boolean; v_result jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT v_manager=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
 IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Work queue scope unauthorized' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'name',COALESCE(p.full_name,p.email),'role',x.role,'active',true) ORDER BY x.name) FROM (
    SELECT v_manager id, 'manager' role, COALESCE(p.full_name,p.email,'Manager') name FROM public.profiles p WHERE p.id=v_manager
    UNION ALL
    SELECT ms.submanager_user_id id, 'submanager' role, COALESCE(p.full_name,p.email,'Submanager') name FROM public.manager_submanagers ms LEFT JOIN public.profiles p ON p.id=ms.submanager_user_id WHERE ms.manager_id=v_manager
  ) x LEFT JOIN public.profiles p ON p.id=x.id),'[]'::jsonb),
  'workload',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'role',x.role,'active',true,'active_count',x.active_count,'unassigned_count',x.unassigned_count,'breached_count',x.breached_count,'completed_30d',x.completed_30d,'completion_rate',CASE WHEN x.completed_30d+x.active_count=0 THEN 100 ELSE ROUND((x.completed_30d::numeric*100)/NULLIF(x.completed_30d+x.active_count,0),1) END) ORDER BY x.active_count DESC,x.name) FROM (
    SELECT m.id,m.name,m.role,
      count(w.id) FILTER(WHERE w.status IN('open','in_progress')) active_count,
      count(w.id) FILTER(WHERE w.status IN('open','in_progress') AND w.assigned_to IS NULL) unassigned_count,
      count(w.id) FILTER(WHERE w.status IN('open','in_progress') AND w.sla_due_at<now()) breached_count,
      count(w.id) FILTER(WHERE w.status='completed' AND w.completed_at>=now()-interval '30 days') completed_30d
    FROM (
      SELECT v_manager id,'manager' role,COALESCE(p.full_name,p.email,'Manager') name FROM public.profiles p WHERE p.id=v_manager
      UNION ALL
      SELECT ms.submanager_user_id id,'submanager' role,COALESCE(p.full_name,p.email,'Submanager') name FROM public.manager_submanagers ms LEFT JOIN public.profiles p ON p.id=ms.submanager_user_id WHERE ms.manager_id=v_manager
    ) m LEFT JOIN public.operation_work_items w ON w.manager_id=v_manager AND w.assigned_to=m.id GROUP BY m.id,m.name,m.role
  ) x),'[]'::jsonb)
 ) INTO v_result;
 RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.get_operation_work_team(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_assign_operation_work_item_atomic(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_item public.operation_work_items%ROWTYPE; v_assignee uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_item FROM public.operation_work_items WHERE id=p_item_id FOR UPDATE;
 IF v_item.id IS NULL THEN RAISE EXCEPTION 'Work item not found' USING ERRCODE='P0002'; END IF;
 IF NOT (v_item.manager_id=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_item.manager_id AND ms.submanager_user_id=v_uid)) THEN RAISE EXCEPTION 'Work item scope unauthorized' USING ERRCODE='42501'; END IF;
 IF v_item.assigned_to IS NOT NULL THEN RETURN jsonb_build_object('id',v_item.id,'assigned_to',v_item.assigned_to,'changed',false); END IF;
 SELECT z.id INTO v_assignee FROM (
   SELECT v_item.manager_id id, count(w.id) FILTER(WHERE w.status IN('open','in_progress')) active_count FROM public.operation_work_items w WHERE w.manager_id=v_item.manager_id GROUP BY 1
   UNION ALL
   SELECT ms.submanager_user_id id, count(w.id) FILTER(WHERE w.status IN('open','in_progress')) active_count FROM public.manager_submanagers ms LEFT JOIN public.operation_work_items w ON w.manager_id=ms.manager_id AND w.assigned_to=ms.submanager_user_id WHERE ms.manager_id=v_item.manager_id GROUP BY 1
 ) z ORDER BY z.active_count ASC,z.id LIMIT 1;
 IF v_assignee IS NULL THEN RAISE EXCEPTION 'No eligible team member found' USING ERRCODE='P0002'; END IF;
 UPDATE public.operation_work_items SET assigned_to=v_assignee,assigned_at=now(),updated_at=now() WHERE id=v_item.id;
 RETURN jsonb_build_object('id',v_item.id,'assigned_to',v_assignee,'changed',true);
END $$;
GRANT EXECUTE ON FUNCTION public.auto_assign_operation_work_item_atomic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_operation_work_item_atomic(p_item_id uuid,p_assignee_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_item public.operation_work_items%ROWTYPE; v_ok boolean; v_assignee_ok boolean;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_item FROM public.operation_work_items WHERE id=p_item_id FOR UPDATE;
 IF v_item.id IS NULL THEN RAISE EXCEPTION 'Work item not found' USING ERRCODE='P0002'; END IF;
 SELECT v_item.manager_id=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_item.manager_id AND ms.submanager_user_id=v_uid) INTO v_ok;
 IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Work item scope unauthorized' USING ERRCODE='42501'; END IF;
 SELECT p_assignee_id=v_item.manager_id OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_item.manager_id AND ms.submanager_user_id=p_assignee_id) INTO v_assignee_ok;
 IF NOT COALESCE(v_assignee_ok,false) THEN RAISE EXCEPTION 'Assignee is outside manager team' USING ERRCODE='42501'; END IF;
 UPDATE public.operation_work_items SET assigned_to=p_assignee_id,assigned_at=COALESCE(assigned_at,now()),updated_at=now() WHERE id=v_item.id;
 RETURN jsonb_build_object('id',v_item.id,'assigned_to',p_assignee_id);
END $$;
GRANT EXECUTE ON FUNCTION public.assign_operation_work_item_atomic(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.transition_operation_work_item_atomic(p_item_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_item public.operation_work_items%ROWTYPE; v_ok boolean;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_status NOT IN('open','in_progress','completed','cancelled') THEN RAISE EXCEPTION 'Invalid work item status' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_item FROM public.operation_work_items WHERE id=p_item_id FOR UPDATE;
 IF v_item.id IS NULL THEN RAISE EXCEPTION 'Work item not found' USING ERRCODE='P0002'; END IF;
 SELECT v_item.manager_id=v_uid OR EXISTS(SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_item.manager_id AND ms.submanager_user_id=v_uid) INTO v_ok;
 IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Work item scope unauthorized' USING ERRCODE='42501'; END IF;
 UPDATE public.operation_work_items SET status=p_status,started_at=CASE WHEN p_status='in_progress' THEN COALESCE(started_at,now()) ELSE started_at END,updated_at=now(),completed_at=CASE WHEN p_status='completed' THEN now() ELSE NULL END,completed_by=CASE WHEN p_status='completed' THEN v_uid ELSE NULL END WHERE id=v_item.id;
 RETURN jsonb_build_object('id',v_item.id,'status',p_status);
END $$;
GRANT EXECUTE ON FUNCTION public.transition_operation_work_item_atomic(uuid,text) TO authenticated;
