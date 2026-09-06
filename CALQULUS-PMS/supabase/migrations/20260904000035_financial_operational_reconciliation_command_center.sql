-- CALQULUS PMS — Financial & Operational Reconciliation Command Center
-- Canonical exception model across leases, invoices, payments, bank rows,
-- owner settlements, financial close, evidence and operational work.

CREATE TABLE IF NOT EXISTS public.reconciliation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_type text NOT NULL CHECK (issue_type IN (
    'lease_invoice_gap','invoice_payment_gap','payment_allocation_gap',
    'bank_match_gap','payout_settlement_gap','close_readiness_gap',
    'evidence_gap','work_item_gap'
  )),
  source_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','dismissed')),
  due_at timestamptz,
  work_item_id uuid REFERENCES public.operation_work_items(id) ON DELETE SET NULL,
  evidence_document_id uuid REFERENCES public.landlord_documents(id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_cases_active_source_idx
  ON public.reconciliation_cases(manager_id, issue_type, source_id)
  WHERE status IN ('open','in_progress');
CREATE INDEX IF NOT EXISTS reconciliation_cases_manager_status_idx
  ON public.reconciliation_cases(manager_id, status, severity, due_at);
CREATE INDEX IF NOT EXISTS reconciliation_cases_work_item_idx
  ON public.reconciliation_cases(work_item_id)
  WHERE work_item_id IS NOT NULL;

ALTER TABLE public.reconciliation_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reconciliation_cases_manager_select ON public.reconciliation_cases;
CREATE POLICY reconciliation_cases_manager_select ON public.reconciliation_cases
  FOR SELECT TO authenticated
  USING (public.can_manage_property_scope(manager_id));

CREATE OR REPLACE FUNCTION public.set_reconciliation_case_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_reconciliation_cases_updated_at ON public.reconciliation_cases;
CREATE TRIGGER trg_reconciliation_cases_updated_at
BEFORE UPDATE ON public.reconciliation_cases
FOR EACH ROW EXECUTE FUNCTION public.set_reconciliation_case_updated_at();
REVOKE ALL ON FUNCTION public.set_reconciliation_case_updated_at() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.sync_manager_reconciliation_command_center(p_manager_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_manager uuid := COALESCE(p_manager_id,v_uid); v_ok boolean;
  v_created integer := 0; v_reopened integer := 0; v_active integer := 0; r record; v_case_id uuid; v_work_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Reconciliation scope unauthorized' USING ERRCODE='42501'; END IF;

  -- Lease without a current invoice in the last 45 days: revenue continuity exception.
  FOR r IN SELECT l.id,l.property,l.unit,l.end_date,l.monthly_rent
    FROM public.leases l
    WHERE l.manager_id=v_manager AND l.status='active'
      AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.manager_id=v_manager AND i.lease_id=l.id AND i.status<>'cancelled' AND i.due_date >= CURRENT_DATE-45)
    LIMIT 200 LOOP
    INSERT INTO public.reconciliation_cases(manager_id,issue_type,source_id,title,description,severity,due_at,context)
    VALUES(v_manager,'lease_invoice_gap',r.id,'Lease has no recent invoice',
      'Active lease for '||COALESCE(r.property,'Property')||' · '||COALESCE(r.unit,'Unit')||' has no non-cancelled invoice due in the last 45 days.',
      'high',r.end_date::timestamptz,jsonb_build_object('property',r.property,'unit',r.unit,'monthly_rent',r.monthly_rent,'lease_end',r.end_date))
    ON CONFLICT (manager_id,issue_type,source_id) WHERE status IN ('open','in_progress') DO UPDATE SET description=EXCLUDED.description,context=EXCLUDED.context,updated_at=now();
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;

  -- Invoice paid amount must agree with completed allocations.
  FOR r IN SELECT i.id,i.invoice_number,i.amount,i.paid_amount,
      COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id WHERE pa.invoice_id=i.id AND pt.status='completed'),0) allocated
    FROM public.invoices i WHERE i.manager_id=v_manager AND i.status<>'cancelled'
    AND ABS(COALESCE(i.paid_amount,0)-COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id WHERE pa.invoice_id=i.id AND pt.status='completed'),0))>0.01
    LIMIT 200 LOOP
    INSERT INTO public.reconciliation_cases(manager_id,issue_type,source_id,title,description,severity,due_at,context)
    VALUES(v_manager,'invoice_payment_gap',r.id,'Invoice payment balance mismatch',
      'Invoice '||r.invoice_number||' has recorded paid amount '||COALESCE(r.paid_amount,0)::text||' but completed allocations total '||COALESCE(r.allocated,0)::text||'.',
      'critical',now(),jsonb_build_object('invoice_number',r.invoice_number,'invoice_amount',r.amount,'paid_amount',r.paid_amount,'allocated_amount',r.allocated))
    ON CONFLICT (manager_id,issue_type,source_id) WHERE status IN ('open','in_progress') DO UPDATE SET description=EXCLUDED.description,context=EXCLUDED.context,updated_at=now();
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;

  -- Completed payment must be fully allocated unless it is explicitly held as credit.
  FOR r IN SELECT pt.id,pt.amount,COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa WHERE pa.transaction_id=pt.id),0) allocated,COALESCE(pt.credit_amount,0) credit
    FROM public.payment_transactions pt WHERE pt.manager_id=v_manager AND pt.status='completed'
    AND ABS(pt.amount-COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa WHERE pa.transaction_id=pt.id),0)-COALESCE(pt.credit_amount,0))>0.01
    LIMIT 200 LOOP
    INSERT INTO public.reconciliation_cases(manager_id,issue_type,source_id,title,description,severity,due_at,context)
    VALUES(v_manager,'payment_allocation_gap',r.id,'Payment allocation does not reconcile',
      'Completed payment is not fully represented by invoice allocations plus recorded credit.',
      'critical',now(),jsonb_build_object('payment_amount',r.amount,'allocated_amount',r.allocated,'credit_amount',r.credit))
    ON CONFLICT (manager_id,issue_type,source_id) WHERE status IN ('open','in_progress') DO UPDATE SET description=EXCLUDED.description,context=EXCLUDED.context,updated_at=now();
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;

  -- Bank rows remain exceptions until matched.
  FOR r IN SELECT bt.id,bt.amount,bt.reference,bt.transaction_date FROM public.bank_transactions bt
    WHERE bt.manager_id=v_manager AND bt.matched=false AND bt.transaction_date >= CURRENT_DATE-90 LIMIT 200 LOOP
    INSERT INTO public.reconciliation_cases(manager_id,issue_type,source_id,title,description,severity,due_at,context)
    VALUES(v_manager,'bank_match_gap',r.id,'Unmatched bank transaction',
      'Bank transaction of '||COALESCE(r.amount,0)::text||' remains unmatched.',
      CASE WHEN r.transaction_date < CURRENT_DATE-7 THEN 'high' ELSE 'medium' END,
      r.transaction_date::timestamptz,jsonb_build_object('amount',r.amount,'reference',r.reference,'transaction_date',r.transaction_date))
    ON CONFLICT (manager_id,issue_type,source_id) WHERE status IN ('open','in_progress') DO UPDATE SET description=EXCLUDED.description,context=EXCLUDED.context,updated_at=now();
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;

  -- Payouts marked paid must have a settlement batch; processing batches need a reference.
  FOR r IN SELECT pr.id,pr.amount,pr.period_start,pr.period_end FROM public.payout_requests pr
    WHERE pr.manager_id=v_manager AND pr.status='paid'
    AND NOT EXISTS (SELECT 1 FROM public.owner_payout_batch_items bi WHERE bi.payout_request_id=pr.id) LIMIT 200 LOOP
    INSERT INTO public.reconciliation_cases(manager_id,issue_type,source_id,title,description,severity,due_at,context)
    VALUES(v_manager,'payout_settlement_gap',r.id,'Paid payout missing settlement batch',
      'Owner payout is marked paid but is not linked to an owner settlement batch.', 'critical',now(),jsonb_build_object('amount',r.amount,'period_start',r.period_start,'period_end',r.period_end))
    ON CONFLICT (manager_id,issue_type,source_id) WHERE status IN ('open','in_progress') DO UPDATE SET description=EXCLUDED.description,context=EXCLUDED.context,updated_at=now();
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;

  FOR r IN SELECT b.id,b.status,b.settlement_reference,b.net_amount FROM public.owner_payout_batches b
    WHERE b.manager_id=v_manager AND b.status='processing' AND NULLIF(trim(b.settlement_reference),'') IS NULL LIMIT 100 LOOP
    INSERT INTO public.reconciliation_cases(manager_id,issue_type,source_id,title,description,severity,due_at,context)
    VALUES(v_manager,'payout_settlement_gap',r.id,'Settlement batch missing reference',
      'Processing owner settlement has no external settlement reference.', 'high',now(),jsonb_build_object('net_amount',r.net_amount,'status',r.status))
    ON CONFLICT (manager_id,issue_type,source_id) WHERE status IN ('open','in_progress') DO UPDATE SET description=EXCLUDED.description,context=EXCLUDED.context,updated_at=now();
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;

  -- Open financial close periods with unresolved checks remain visible here.
  FOR r IN SELECT f.id,f.period_start,f.period_end,c.data FROM public.financial_close_periods f
    CROSS JOIN LATERAL (SELECT public.get_manager_financial_close(v_manager,f.period_start,f.period_end) AS data) c
    WHERE f.manager_id=v_manager AND f.status<>'closed' AND COALESCE((c.data->>'ready_to_close')::boolean,false)=false LIMIT 50 LOOP
    INSERT INTO public.reconciliation_cases(manager_id,issue_type,source_id,title,description,severity,due_at,context)
    VALUES(v_manager,'close_readiness_gap',r.id,'Financial close has unresolved checks',
      'Period '||r.period_start||' → '||r.period_end||' is not ready to close.', 'high',r.period_end::timestamptz,jsonb_build_object('period_start',r.period_start,'period_end',r.period_end,'checks',r.data->'checks'))
    ON CONFLICT (manager_id,issue_type,source_id) WHERE status IN ('open','in_progress') DO UPDATE SET description=EXCLUDED.description,context=EXCLUDED.context,updated_at=now();
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;

  -- Evidence exceptions: visible documents that are unverified or expiring within 30 days.
  FOR r IN SELECT d.id,d.title,d.expires_at,d.verification_status FROM public.landlord_documents d
    WHERE d.manager_id=v_manager AND d.is_visible=true AND (d.verification_status='unverified' OR (d.expires_at IS NOT NULL AND d.expires_at::date BETWEEN CURRENT_DATE AND CURRENT_DATE+30)) LIMIT 200 LOOP
    INSERT INTO public.reconciliation_cases(manager_id,issue_type,source_id,title,description,severity,due_at,evidence_document_id,context)
    VALUES(v_manager,'evidence_gap',r.id,CASE WHEN r.verification_status='unverified' THEN 'Document needs verification' ELSE 'Document nearing expiry' END,
      COALESCE(r.title,'Document')||CASE WHEN r.expires_at IS NOT NULL THEN ' · expires '||r.expires_at::date::text ELSE '' END,
      CASE WHEN r.verification_status='unverified' THEN 'medium' ELSE 'high' END,r.expires_at,r.id,jsonb_build_object('verification_status',r.verification_status,'expires_at',r.expires_at))
    ON CONFLICT (manager_id,issue_type,source_id) WHERE status IN ('open','in_progress') DO UPDATE SET description=EXCLUDED.description,due_at=EXCLUDED.due_at,evidence_document_id=EXCLUDED.evidence_document_id,context=EXCLUDED.context,updated_at=now();
    IF FOUND THEN v_created:=v_created+1; END IF;
  END LOOP;

  -- Auto-resolve open cases when the underlying exception has disappeared.
  UPDATE public.reconciliation_cases c SET status='resolved',resolved_at=now(),resolved_by=v_uid,resolution_note='Automatically resolved by reconciliation scan.',updated_at=now()
  WHERE c.manager_id=v_manager AND c.status IN ('open','in_progress') AND (
    (c.issue_type='lease_invoice_gap' AND NOT EXISTS (SELECT 1 FROM public.leases l WHERE l.id=c.source_id AND l.manager_id=v_manager AND l.status='active' AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.manager_id=v_manager AND i.lease_id=l.id AND i.status<>'cancelled' AND i.due_date>=CURRENT_DATE-45)))
    OR (c.issue_type='invoice_payment_gap' AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id=c.source_id AND i.manager_id=v_manager AND i.status<>'cancelled' AND ABS(COALESCE(i.paid_amount,0)-COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa JOIN public.payment_transactions pt ON pt.id=pa.transaction_id WHERE pa.invoice_id=i.id AND pt.status='completed'),0))>0.01))
    OR (c.issue_type='payment_allocation_gap' AND NOT EXISTS (SELECT 1 FROM public.payment_transactions pt WHERE pt.id=c.source_id AND pt.manager_id=v_manager AND pt.status='completed' AND ABS(pt.amount-COALESCE((SELECT SUM(pa.allocated_amount) FROM public.payment_allocations pa WHERE pa.transaction_id=pt.id),0)-COALESCE(pt.credit_amount,0))>0.01))
    OR (c.issue_type='bank_match_gap' AND NOT EXISTS (SELECT 1 FROM public.bank_transactions bt WHERE bt.id=c.source_id AND bt.manager_id=v_manager AND bt.matched=false AND bt.transaction_date>=CURRENT_DATE-90))
    OR (c.issue_type='payout_settlement_gap' AND NOT EXISTS (SELECT 1 FROM public.payout_requests pr WHERE pr.id=c.source_id AND pr.manager_id=v_manager AND pr.status='paid' AND NOT EXISTS (SELECT 1 FROM public.owner_payout_batch_items bi WHERE bi.payout_request_id=pr.id)))
    OR (c.issue_type='payout_settlement_gap' AND NOT EXISTS (SELECT 1 FROM public.owner_payout_batches b WHERE b.id=c.source_id AND b.manager_id=v_manager AND b.status='processing' AND NULLIF(trim(b.settlement_reference),'') IS NULL))
    OR (c.issue_type='close_readiness_gap' AND NOT EXISTS (SELECT 1 FROM public.financial_close_periods f WHERE f.id=c.source_id AND f.manager_id=v_manager AND f.status<>'closed' AND COALESCE((public.get_manager_financial_close(v_manager,f.period_start,f.period_end)->>'ready_to_close')::boolean,false)=false))
    OR (c.issue_type='evidence_gap' AND NOT EXISTS (SELECT 1 FROM public.landlord_documents d WHERE d.id=c.source_id AND d.manager_id=v_manager AND d.is_visible=true AND (d.verification_status='unverified' OR (d.expires_at IS NOT NULL AND d.expires_at::date BETWEEN CURRENT_DATE AND CURRENT_DATE+30)))
  );

  -- Convert each active reconciliation case into the existing canonical work queue.
  FOR r IN SELECT c.* FROM public.reconciliation_cases c WHERE c.manager_id=v_manager AND c.status IN ('open','in_progress') LOOP
    v_work_id := r.work_item_id;
    IF v_work_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.operation_work_items w WHERE w.id=v_work_id AND w.status NOT IN ('completed','cancelled')) THEN
      INSERT INTO public.operation_work_items(manager_id,source_type,source_id,title,description,href,priority,due_at)
      VALUES(v_manager,'reconciliation_case',r.id,r.title,r.description,'/dashboard',r.severity::text,r.due_at)
      ON CONFLICT (manager_id,source_type,source_id) WHERE status NOT IN ('completed','cancelled') DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,due_at=EXCLUDED.due_at,priority=EXCLUDED.priority
      RETURNING id INTO v_work_id;
      UPDATE public.reconciliation_cases SET work_item_id=v_work_id WHERE id=r.id;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_active FROM public.reconciliation_cases WHERE manager_id=v_manager AND status IN ('open','in_progress');
  RETURN jsonb_build_object('created',v_created,'active',v_active);
END $$;

CREATE OR REPLACE FUNCTION public.get_manager_reconciliation_command_center(p_manager_id uuid DEFAULT auth.uid(), p_status text DEFAULT 'active')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid:=auth.uid(); v_manager uuid:=COALESCE(p_manager_id,v_uid); v_ok boolean; v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT v_manager=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Reconciliation scope unauthorized' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'summary',jsonb_build_object(
      'active',count(*) FILTER (WHERE c.status IN ('open','in_progress')),
      'critical',count(*) FILTER (WHERE c.status IN ('open','in_progress') AND c.severity='critical'),
      'high',count(*) FILTER (WHERE c.status IN ('open','in_progress') AND c.severity='high'),
      'medium',count(*) FILTER (WHERE c.status IN ('open','in_progress') AND c.severity='medium'),
      'low',count(*) FILTER (WHERE c.status IN ('open','in_progress') AND c.severity='low'),
      'resolved_30d',count(*) FILTER (WHERE c.status='resolved' AND c.resolved_at>=now()-interval '30 days')
    ),
    'cases',coalesce(jsonb_agg(jsonb_build_object('id',c.id,'issue_type',c.issue_type,'source_id',c.source_id,'title',c.title,'description',c.description,'severity',c.severity,'status',c.status,'due_at',c.due_at,'work_item_id',c.work_item_id,'evidence_document_id',c.evidence_document_id,'detected_at',c.detected_at,'resolved_at',c.resolved_at,'resolution_note',c.resolution_note,'context',c.context,'updated_at',c.updated_at) ORDER BY CASE c.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,c.due_at NULLS LAST,c.updated_at DESC),'[]'::jsonb)
  ) INTO v_result
  FROM public.reconciliation_cases c
  WHERE c.manager_id=v_manager AND (p_status='all' OR (p_status='active' AND c.status IN ('open','in_progress')) OR c.status=p_status);
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.transition_reconciliation_case_atomic(p_case_id uuid,p_target_status text,p_resolution_note text DEFAULT NULL,p_evidence_document_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid:=auth.uid(); v_case public.reconciliation_cases%ROWTYPE; v_ok boolean; v_work public.operation_work_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR p_target_status NOT IN ('open','in_progress','resolved','dismissed') THEN RAISE EXCEPTION 'Invalid reconciliation transition' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_case FROM public.reconciliation_cases WHERE id=p_case_id FOR UPDATE;
  IF v_case.id IS NULL THEN RAISE EXCEPTION 'Reconciliation case not found' USING ERRCODE='P0002'; END IF;
  SELECT v_case.manager_id=v_uid OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_case.manager_id AND ms.submanager_user_id=v_uid) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Reconciliation scope unauthorized' USING ERRCODE='42501'; END IF;
  UPDATE public.reconciliation_cases SET status=p_target_status,resolved_at=CASE WHEN p_target_status IN ('resolved','dismissed') THEN now() ELSE NULL END,resolved_by=CASE WHEN p_target_status IN ('resolved','dismissed') THEN v_uid ELSE NULL END,resolution_note=CASE WHEN p_resolution_note IS NULL THEN resolution_note ELSE nullif(trim(p_resolution_note),'') END,evidence_document_id=COALESCE(p_evidence_document_id,evidence_document_id),updated_at=now() WHERE id=p_case_id RETURNING * INTO v_case;
  IF v_case.work_item_id IS NOT NULL THEN
    IF p_target_status IN ('resolved','dismissed') THEN
      UPDATE public.operation_work_items SET status='completed',completed_at=now(),completed_by=v_uid,updated_at=now() WHERE id=v_case.work_item_id AND status NOT IN ('completed','cancelled');
    ELSIF p_target_status='in_progress' THEN
      UPDATE public.operation_work_items SET status='in_progress',updated_at=now() WHERE id=v_case.work_item_id AND status='open';
    ELSIF p_target_status='open' THEN
      UPDATE public.operation_work_items SET status='open',completed_at=NULL,completed_by=NULL,updated_at=now() WHERE id=v_case.work_item_id AND status='in_progress';
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'id',v_case.id,'status',v_case.status,'work_item_id',v_case.work_item_id,'evidence_document_id',v_case.evidence_document_id);
END $$;

REVOKE ALL ON FUNCTION public.sync_manager_reconciliation_command_center(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_manager_reconciliation_command_center(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.transition_reconciliation_case_atomic(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_manager_reconciliation_command_center(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_manager_reconciliation_command_center(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.transition_reconciliation_case_atomic(uuid,text,text,uuid) TO authenticated,service_role;

COMMENT ON TABLE public.reconciliation_cases IS 'Canonical cross-domain exception tracker. Issues converge into operation_work_items for ownership, SLA and resolution.';
