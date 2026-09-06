-- CALQULUS PMS — Collections Communications & Promise Monitoring
-- Adds a controlled communications outbox and missed-promise monitoring on top of recovery cases.

CREATE TABLE IF NOT EXISTS public.collection_recovery_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  recovery_case_id uuid NOT NULL REFERENCES public.collection_recovery_cases(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  recipient text NOT NULL,
  recipient_name text,
  subject text,
  message text NOT NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','sent','failed','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collection_recovery_communications_manager_queue_idx
  ON public.collection_recovery_communications(manager_id,status,scheduled_at);
CREATE INDEX IF NOT EXISTS collection_recovery_communications_case_idx
  ON public.collection_recovery_communications(recovery_case_id,created_at DESC);

ALTER TABLE public.collection_recovery_communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collection_recovery_communications_manager_select ON public.collection_recovery_communications;
CREATE POLICY collection_recovery_communications_manager_select ON public.collection_recovery_communications
  FOR SELECT TO authenticated USING (
    manager_id=(SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.manager_submanagers ms
      WHERE ms.manager_id=collection_recovery_communications.manager_id AND ms.submanager_user_id=(SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.queue_collection_recovery_communication_atomic(
  p_case_id uuid,
  p_channel text,
  p_scheduled_at timestamptz DEFAULT now()
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_case public.collection_recovery_cases%ROWTYPE; v_invoice public.invoices%ROWTYPE;
  v_tenant record; v_ok boolean; v_recipient text; v_subject text; v_message text; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_channel NOT IN ('sms','email') THEN RAISE EXCEPTION 'Unsupported communication channel' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_case FROM public.collection_recovery_cases WHERE id=p_case_id FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Recovery case not found' USING ERRCODE='P0002'; END IF;
  SELECT v_case.manager_id=v_uid OR EXISTS (
    SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_case.manager_id AND ms.submanager_user_id=v_uid
  ) INTO v_ok;
  IF NOT coalesce(v_ok,false) THEN RAISE EXCEPTION 'Recovery communication scope unauthorized' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE id=v_case.invoice_id;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='P0002'; END IF;
  SELECT t.name,t.email,t.phone INTO v_tenant FROM public.tenants t WHERE t.id=v_invoice.tenant_id;
  IF p_channel='sms' THEN v_recipient:=nullif(trim(coalesce(v_tenant.phone,'')),''); ELSE v_recipient:=nullif(trim(coalesce(v_tenant.email,'')),''); END IF;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'No recipient contact is configured for this tenant' USING ERRCODE='22023'; END IF;
  v_subject:=format('Payment reminder — Invoice %s',coalesce(v_invoice.invoice_number,'invoice'));
  v_message:=format('Dear %s, your invoice %s has an outstanding balance of %s and is overdue by %s day(s). Please arrange payment or contact your property manager if payment is already in progress.',coalesce(v_tenant.name,'Tenant'),coalesce(v_invoice.invoice_number,'N/A'),greatest(0,coalesce(v_invoice.balance_due,0))::text,greatest(0,current_date-coalesce(v_invoice.due_date,current_date))::text);
  INSERT INTO public.collection_recovery_communications(manager_id,recovery_case_id,channel,recipient,recipient_name,subject,message,scheduled_at)
  VALUES(v_case.manager_id,v_case.id,p_channel,v_recipient,coalesce(v_tenant.name,'Tenant'),v_subject,v_message,coalesce(p_scheduled_at,now())) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id',v_id,'channel',p_channel,'recipient',v_recipient,'scheduled_at',coalesce(p_scheduled_at,now()));
END $$;
GRANT EXECUTE ON FUNCTION public.queue_collection_recovery_communication_atomic(uuid,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_collection_recovery_communications(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=coalesce(p_manager_id,v_uid); v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT coalesce(v_ok,false) THEN RAISE EXCEPTION 'Communication scope unauthorized' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'summary',jsonb_build_object(
      'queued',(SELECT count(*) FROM public.collection_recovery_communications c WHERE c.manager_id=v_manager AND c.status='queued'),
      'failed',(SELECT count(*) FROM public.collection_recovery_communications c WHERE c.manager_id=v_manager AND c.status='failed'),
      'sent_24h',(SELECT count(*) FROM public.collection_recovery_communications c WHERE c.manager_id=v_manager AND c.status='sent' AND c.sent_at>=now()-interval '24 hours'),
      'missed_promises',(SELECT count(*) FROM public.collection_recovery_cases c WHERE c.manager_id=v_manager AND c.stage='promise_to_pay' AND c.promise_due_date<current_date AND greatest(0,coalesce((SELECT i.balance_due FROM public.invoices i WHERE i.id=c.invoice_id),0))>0)
    ),
    'queue',coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.scheduled_at,x.created_at) FROM (
      SELECT c.id,c.recovery_case_id,c.channel,c.recipient,c.recipient_name,c.subject,c.message,c.scheduled_at,c.status,c.attempt_count,c.last_error,c.sent_at,i.invoice_number,greatest(0,coalesce(i.balance_due,0)) balance_due
      FROM public.collection_recovery_communications c JOIN public.collection_recovery_cases rc ON rc.id=c.recovery_case_id JOIN public.invoices i ON i.id=rc.invoice_id
      WHERE c.manager_id=v_manager AND c.status IN ('queued','failed')
      ORDER BY c.scheduled_at,c.created_at LIMIT 30
    ) x),'[]'::jsonb),
    'missed',coalesce((SELECT jsonb_agg(row_to_json(x) ORDER BY x.promise_due_date) FROM (
      SELECT c.id,c.invoice_id,c.promise_amount,c.promise_due_date,c.promise_notes,i.invoice_number,greatest(0,coalesce(i.balance_due,0)) balance_due,(current_date-c.promise_due_date) days_late
      FROM public.collection_recovery_cases c JOIN public.invoices i ON i.id=c.invoice_id
      WHERE c.manager_id=v_manager AND c.stage='promise_to_pay' AND c.promise_due_date<current_date AND greatest(0,coalesce(i.balance_due,0))>0
      ORDER BY c.promise_due_date LIMIT 30
    ) x),'[]'::jsonb)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_collection_recovery_communications(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_missed_collection_promises_atomic(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=coalesce(p_manager_id,v_uid); v_ok boolean; v_marked integer:=0; r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT coalesce(v_ok,false) THEN RAISE EXCEPTION 'Promise monitoring scope unauthorized' USING ERRCODE='42501'; END IF;
  FOR r IN SELECT c.id,c.invoice_id FROM public.collection_recovery_cases c JOIN public.invoices i ON i.id=c.invoice_id WHERE c.manager_id=v_manager AND c.stage='promise_to_pay' AND c.promise_due_date<current_date AND greatest(0,coalesce(i.balance_due,0))>0 LOOP
    UPDATE public.collection_recovery_cases SET stage='escalated',next_action_at=now(),notes=trim(both E'\n' from concat_ws(E'\n',nullif(notes,''),'Promise-to-pay missed; automatically escalated for recovery follow-up.')),updated_at=now() WHERE id=r.id AND stage='promise_to_pay';
    IF FOUND THEN v_marked:=v_marked+1; END IF;
    INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority,due_at)
    SELECT v_manager,'collection_promise_missed',r.id,'Follow up missed payment promise','A recorded promise-to-pay has passed without the invoice being cleared.','/billing','high',now()
    WHERE NOT EXISTS (SELECT 1 FROM public.operation_work_items w WHERE w.manager_id=v_manager AND w.source_type='collection_promise_missed' AND w.source_id=r.id AND w.status NOT IN ('completed','cancelled'));
  END LOOP;
  RETURN jsonb_build_object('escalated',v_marked);
END $$;
GRANT EXECUTE ON FUNCTION public.mark_missed_collection_promises_atomic(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.queue_collection_recovery_communication_atomic(uuid,text,timestamptz) FROM public,anon;
REVOKE ALL ON FUNCTION public.get_collection_recovery_communications(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.mark_missed_collection_promises_atomic(uuid) FROM public,anon;
