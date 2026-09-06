-- CALQULUS PMS — Collections Recovery Automation
-- Converts receivables intelligence into controlled, auditable recovery workflows.

CREATE TABLE IF NOT EXISTS public.collection_recovery_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'reminder' CHECK (stage IN ('reminder','follow_up','escalated','promise_to_pay','final_notice','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical','high','normal','low')),
  assigned_to uuid,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  promise_amount numeric(14,2),
  promise_due_date date,
  promise_notes text,
  notes text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS collection_recovery_cases_invoice_active_idx
  ON public.collection_recovery_cases(invoice_id)
  WHERE stage NOT IN ('resolved','closed');
CREATE INDEX IF NOT EXISTS collection_recovery_cases_manager_stage_idx
  ON public.collection_recovery_cases(manager_id,stage,next_action_at,priority);
CREATE INDEX IF NOT EXISTS collection_recovery_cases_assignee_idx
  ON public.collection_recovery_cases(assigned_to,stage,next_action_at);

ALTER TABLE public.collection_recovery_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collection_recovery_cases_manager_select ON public.collection_recovery_cases;
CREATE POLICY collection_recovery_cases_manager_select ON public.collection_recovery_cases
  FOR SELECT TO authenticated USING (
    manager_id=(SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.manager_submanagers ms
      WHERE ms.manager_id=collection_recovery_cases.manager_id AND ms.submanager_user_id=(SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.sync_collection_recovery_cases_atomic(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_manager uuid:=coalesce(p_manager_id,v_uid); v_ok boolean; v_created integer:=0; r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT coalesce(v_ok,false) THEN RAISE EXCEPTION 'Collection recovery scope unauthorized' USING ERRCODE='42501'; END IF;
  FOR r IN SELECT i.id,i.due_date,i.balance_due FROM public.invoices i WHERE i.manager_id=v_manager AND i.status NOT IN ('paid','cancelled') AND coalesce(i.balance_due,0)>0 AND i.due_date<current_date ORDER BY i.due_date ASC LIMIT 250 LOOP
    INSERT INTO public.collection_recovery_cases(manager_id,invoice_id,priority,next_action_at)
    SELECT v_manager,r.id,CASE WHEN current_date-r.due_date>90 THEN 'critical' WHEN current_date-r.due_date>60 THEN 'high' ELSE 'normal' END,now()
    WHERE NOT EXISTS (SELECT 1 FROM public.collection_recovery_cases c WHERE c.invoice_id=r.id AND c.stage NOT IN ('resolved','closed'));
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('created',v_created,'active',(SELECT count(*) FROM public.collection_recovery_cases c WHERE c.manager_id=v_manager AND c.stage NOT IN ('resolved','closed')));
END $$;
GRANT EXECUTE ON FUNCTION public.sync_collection_recovery_cases_atomic(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_collection_recovery_dashboard(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=coalesce(p_manager_id,v_uid); v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT coalesce(v_ok,false) THEN RAISE EXCEPTION 'Collection recovery scope unauthorized' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'summary',jsonb_build_object(
      'active_cases',(SELECT count(*) FROM public.collection_recovery_cases c WHERE c.manager_id=v_manager AND c.stage NOT IN ('resolved','closed')),
      'due_today',(SELECT count(*) FROM public.collection_recovery_cases c WHERE c.manager_id=v_manager AND c.stage NOT IN ('resolved','closed') AND c.next_action_at::date<=current_date),
      'escalated',(SELECT count(*) FROM public.collection_recovery_cases c WHERE c.manager_id=v_manager AND c.stage IN ('escalated','final_notice')),
      'promised',(SELECT count(*) FROM public.collection_recovery_cases c WHERE c.manager_id=v_manager AND c.stage='promise_to_pay'),
      'promised_value',(SELECT coalesce(sum(c.promise_amount),0) FROM public.collection_recovery_cases c WHERE c.manager_id=v_manager AND c.stage='promise_to_pay')
    ),
    'cases',coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.priority_rank,x.next_action_at NULLS LAST,x.balance_due DESC) FROM (
      SELECT c.id,c.invoice_id,c.stage,c.priority,c.assigned_to,c.next_action_at,c.last_contacted_at,c.promise_amount,c.promise_due_date,c.promise_notes,
        i.invoice_number,i.property_id,i.tenant_id,greatest(0,coalesce(i.balance_due,0)) balance_due,greatest(0,current_date-i.due_date) days_overdue,
        CASE c.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END priority_rank
      FROM public.collection_recovery_cases c JOIN public.invoices i ON i.id=c.invoice_id
      WHERE c.manager_id=v_manager AND c.stage NOT IN ('resolved','closed')
      ORDER BY priority_rank,c.next_action_at NULLS LAST,greatest(0,coalesce(i.balance_due,0)) DESC LIMIT 40
    ) x),'[]'::jsonb)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_collection_recovery_dashboard(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_collection_recovery_stage_atomic(p_case_id uuid,p_stage text,p_next_action_at timestamptz DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_case public.collection_recovery_cases%ROWTYPE; v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_stage NOT IN ('reminder','follow_up','escalated','promise_to_pay','final_notice','resolved','closed') THEN RAISE EXCEPTION 'Invalid recovery stage' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_case FROM public.collection_recovery_cases WHERE id=p_case_id FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Recovery case not found' USING ERRCODE='P0002'; END IF;
  SELECT greatest(0,coalesce(i.balance_due,0)) INTO v_balance FROM public.invoices i WHERE i.id=v_case.invoice_id;
  SELECT v_case.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_case.manager_id AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT coalesce(v_ok,false) THEN RAISE EXCEPTION 'Recovery case scope unauthorized' USING ERRCODE='42501'; END IF;
  UPDATE public.collection_recovery_cases SET stage=p_stage,next_action_at=coalesce(p_next_action_at,next_action_at),notes=coalesce(p_notes,notes),last_contacted_at=CASE WHEN p_stage IN ('reminder','follow_up','escalated','final_notice') THEN now() ELSE last_contacted_at END,resolved_at=CASE WHEN p_stage IN ('resolved','closed') THEN now() ELSE NULL END,updated_at=now() WHERE id=p_case_id;
  RETURN jsonb_build_object('id',p_case_id,'stage',p_stage);
END $$;
GRANT EXECUTE ON FUNCTION public.advance_collection_recovery_stage_atomic(uuid,text,timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_collection_promise_atomic(p_case_id uuid,p_amount numeric,p_due_date date,p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_case public.collection_recovery_cases%ROWTYPE; v_ok boolean; v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_amount<=0 OR p_due_date<current_date THEN RAISE EXCEPTION 'Promise amount/date invalid' USING ERRCODE='22023'; END IF;
  SELECT c.* INTO v_case FROM public.collection_recovery_cases c WHERE c.id=p_case_id FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Recovery case not found' USING ERRCODE='P0002'; END IF;
  SELECT greatest(0,coalesce(i.balance_due,0)) INTO v_balance FROM public.invoices i WHERE i.id=v_case.invoice_id;
  SELECT v_case.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_case.manager_id AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT coalesce(v_ok,false) THEN RAISE EXCEPTION 'Recovery case scope unauthorized' USING ERRCODE='42501'; END IF;
  IF p_amount>v_balance+0.01 THEN RAISE EXCEPTION 'Promise exceeds outstanding balance' USING ERRCODE='22023'; END IF;
  UPDATE public.collection_recovery_cases SET stage='promise_to_pay',promise_amount=p_amount,promise_due_date=p_due_date,promise_notes=coalesce(p_notes,''),next_action_at=p_due_date::timestamptz,updated_at=now() WHERE id=p_case_id;
  RETURN jsonb_build_object('id',p_case_id,'stage','promise_to_pay','promise_amount',p_amount,'promise_due_date',p_due_date);
END $$;
GRANT EXECUTE ON FUNCTION public.record_collection_promise_atomic(uuid,numeric,date,text) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_collection_recovery_cases_atomic(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.get_collection_recovery_dashboard(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.advance_collection_recovery_stage_atomic(uuid,text,timestamptz,text) FROM public,anon;
REVOKE ALL ON FUNCTION public.record_collection_promise_atomic(uuid,numeric,date,text) FROM public,anon;
