-- CALQULUS PMS — Ledger Adjustments & Immutable Reversals Governance
-- Adds controlled adjustment requests and append-only reversal entries without
-- replacing the existing source financial systems.

CREATE TABLE IF NOT EXISTS public.ledger_adjustment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  entry_date date NOT NULL,
  description text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','posted','cancelled')),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejection_reason text,
  posted_journal_entry_id uuid REFERENCES public.ledger_journal_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_start <= period_end),
  CHECK (entry_date BETWEEN period_start AND period_end)
);

CREATE TABLE IF NOT EXISTS public.ledger_adjustment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_request_id uuid NOT NULL REFERENCES public.ledger_adjustment_requests(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE INDEX IF NOT EXISTS ledger_adjustments_manager_period_idx
  ON public.ledger_adjustment_requests(manager_id, period_end DESC, status);
CREATE INDEX IF NOT EXISTS ledger_adjustment_lines_request_idx
  ON public.ledger_adjustment_lines(adjustment_request_id);

ALTER TABLE public.ledger_adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_adjustment_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_adjustments_manager_scope ON public.ledger_adjustment_requests;
CREATE POLICY ledger_adjustments_manager_scope ON public.ledger_adjustment_requests
  FOR SELECT USING (public.can_manage_property_scope(manager_id));
DROP POLICY IF EXISTS ledger_adjustment_lines_manager_scope ON public.ledger_adjustment_lines;
CREATE POLICY ledger_adjustment_lines_manager_scope ON public.ledger_adjustment_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ledger_adjustment_requests r
      WHERE r.id = ledger_adjustment_lines.adjustment_request_id
        AND public.can_manage_property_scope(r.manager_id)
    )
  );

REVOKE ALL ON public.ledger_adjustment_requests, public.ledger_adjustment_lines FROM PUBLIC, anon;
GRANT SELECT ON public.ledger_adjustment_requests, public.ledger_adjustment_lines TO authenticated;

CREATE OR REPLACE FUNCTION public.set_ledger_adjustment_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_ledger_adjustment_updated_at ON public.ledger_adjustment_requests;
CREATE TRIGGER trg_ledger_adjustment_updated_at BEFORE UPDATE ON public.ledger_adjustment_requests
FOR EACH ROW EXECUTE FUNCTION public.set_ledger_adjustment_updated_at();

-- Journal entries are append-only. Corrections are represented by reversals.
CREATE OR REPLACE FUNCTION public.prevent_ledger_entry_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Ledger journal entries are immutable; use a controlled reversal' USING ERRCODE='55000'; END; $$;
DROP TRIGGER IF EXISTS trg_prevent_ledger_entry_update ON public.ledger_journal_entries;
CREATE TRIGGER trg_prevent_ledger_entry_update BEFORE UPDATE ON public.ledger_journal_entries
FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_entry_mutation();
DROP TRIGGER IF EXISTS trg_prevent_ledger_entry_delete ON public.ledger_journal_entries;
CREATE TRIGGER trg_prevent_ledger_entry_delete BEFORE DELETE ON public.ledger_journal_entries
FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_entry_mutation();

CREATE OR REPLACE FUNCTION public.submit_ledger_adjustment_atomic(p_adjustment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.ledger_adjustment_requests; v_uid uuid := auth.uid(); v_debit numeric; v_credit numeric;
BEGIN
  SELECT * INTO r FROM public.ledger_adjustment_requests WHERE id=p_adjustment_id FOR UPDATE;
  IF NOT FOUND OR v_uid IS NULL OR auth.role()<>'authenticated' OR NOT public.can_manage_property_scope(r.manager_id) THEN RAISE EXCEPTION 'Adjustment not accessible' USING ERRCODE='42501'; END IF;
  IF r.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'Adjustment cannot be submitted from current status' USING ERRCODE='55000'; END IF;
  SELECT coalesce(sum(debit),0), coalesce(sum(credit),0) INTO v_debit,v_credit FROM public.ledger_adjustment_lines WHERE adjustment_request_id=r.id;
  IF v_debit=0 OR round(v_debit,2)<>round(v_credit,2) THEN RAISE EXCEPTION 'Adjustment must contain balanced debit and credit lines' USING ERRCODE='22023'; END IF;
  UPDATE public.ledger_adjustment_requests SET status='submitted', rejection_reason=NULL, rejected_by=NULL, rejected_at=NULL WHERE id=r.id;
  RETURN jsonb_build_object('ok',true,'status','submitted','debits',round(v_debit,2),'credits',round(v_credit,2));
END; $$;

CREATE OR REPLACE FUNCTION public.approve_ledger_adjustment_atomic(p_adjustment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.ledger_adjustment_requests; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO r FROM public.ledger_adjustment_requests WHERE id=p_adjustment_id FOR UPDATE;
  IF NOT FOUND OR v_uid IS NULL OR auth.role()<>'authenticated' OR NOT public.can_manage_property_scope(r.manager_id) THEN RAISE EXCEPTION 'Adjustment not accessible' USING ERRCODE='42501'; END IF;
  IF r.status<>'submitted' THEN RAISE EXCEPTION 'Only submitted adjustments can be approved' USING ERRCODE='55000'; END IF;
  IF r.requested_by=v_uid THEN RAISE EXCEPTION 'A requester cannot approve their own adjustment' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.financial_close_periods f WHERE f.manager_id=r.manager_id AND f.period_start=r.period_start AND f.period_end=r.period_end AND f.status='closed') THEN RAISE EXCEPTION 'Closed periods require controlled reversal/reconciliation workflow' USING ERRCODE='55000'; END IF;
  UPDATE public.ledger_adjustment_requests SET status='approved', approved_by=v_uid, approved_at=now() WHERE id=r.id;
  RETURN jsonb_build_object('ok',true,'status','approved');
END; $$;

CREATE OR REPLACE FUNCTION public.reject_ledger_adjustment_atomic(p_adjustment_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.ledger_adjustment_requests; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO r FROM public.ledger_adjustment_requests WHERE id=p_adjustment_id FOR UPDATE;
  IF NOT FOUND OR v_uid IS NULL OR auth.role()<>'authenticated' OR NOT public.can_manage_property_scope(r.manager_id) THEN RAISE EXCEPTION 'Adjustment not accessible' USING ERRCODE='42501'; END IF;
  IF r.status<>'submitted' THEN RAISE EXCEPTION 'Only submitted adjustments can be rejected' USING ERRCODE='55000'; END IF;
  IF coalesce(trim(p_reason),'')='' THEN RAISE EXCEPTION 'Rejection reason is required' USING ERRCODE='22023'; END IF;
  UPDATE public.ledger_adjustment_requests SET status='rejected', rejected_by=v_uid, rejected_at=now(), rejection_reason=trim(p_reason) WHERE id=r.id;
  RETURN jsonb_build_object('ok',true,'status','rejected');
END; $$;

CREATE OR REPLACE FUNCTION public.post_ledger_adjustment_atomic(p_adjustment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.ledger_adjustment_requests; l record; v_uid uuid:=auth.uid(); v_entry uuid;
BEGIN
  SELECT * INTO r FROM public.ledger_adjustment_requests WHERE id=p_adjustment_id FOR UPDATE;
  IF NOT FOUND OR v_uid IS NULL OR auth.role()<>'authenticated' OR NOT public.can_manage_property_scope(r.manager_id) THEN RAISE EXCEPTION 'Adjustment not accessible' USING ERRCODE='42501'; END IF;
  IF r.status<>'approved' THEN RAISE EXCEPTION 'Only approved adjustments can be posted' USING ERRCODE='55000'; END IF;
  IF EXISTS (SELECT 1 FROM public.financial_close_periods f WHERE f.manager_id=r.manager_id AND f.period_start=r.period_start AND f.period_end=r.period_end AND f.status='closed') THEN RAISE EXCEPTION 'Cannot post into a closed period' USING ERRCODE='55000'; END IF;
  INSERT INTO public.ledger_journal_entries(manager_id,entry_date,description,source_type,source_id,posted_by)
  VALUES(r.manager_id,r.entry_date,r.description,'adjustment_request',r.id,v_uid) RETURNING id INTO v_entry;
  FOR l IN SELECT * FROM public.ledger_adjustment_lines WHERE adjustment_request_id=r.id LOOP
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,debit,credit,memo)
    VALUES(v_entry,l.account_id,l.property_id,l.debit,l.credit,l.memo);
  END LOOP;
  UPDATE public.ledger_adjustment_requests SET status='posted',posted_journal_entry_id=v_entry WHERE id=r.id;
  RETURN jsonb_build_object('ok',true,'status','posted','journal_entry_id',v_entry);
END; $$;

CREATE OR REPLACE FUNCTION public.reverse_ledger_entry_atomic(p_journal_entry_id uuid,p_reason text,p_reversal_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.ledger_journal_entries; v_uid uuid:=auth.uid(); v_entry uuid; l record; v_close_exists boolean;
BEGIN
  SELECT * INTO e FROM public.ledger_journal_entries WHERE id=p_journal_entry_id FOR UPDATE;
  IF NOT FOUND OR v_uid IS NULL OR auth.role()<>'authenticated' OR NOT public.can_manage_property_scope(e.manager_id) THEN RAISE EXCEPTION 'Journal entry not accessible' USING ERRCODE='42501'; END IF;
  IF e.status<>'posted' THEN RAISE EXCEPTION 'Only posted journal entries can be reversed' USING ERRCODE='55000'; END IF;
  IF coalesce(trim(p_reason),'')='' OR p_reversal_date IS NULL THEN RAISE EXCEPTION 'Reversal reason and date are required' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_journal_entries WHERE reversal_of=e.id) THEN RAISE EXCEPTION 'Journal entry already has a reversal' USING ERRCODE='55000'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.financial_close_periods f WHERE f.manager_id=e.manager_id AND p_reversal_date BETWEEN f.period_start AND f.period_end AND f.status='closed') INTO v_close_exists;
  IF v_close_exists THEN RAISE EXCEPTION 'Reversal date falls in a closed period' USING ERRCODE='55000'; END IF;
  INSERT INTO public.ledger_journal_entries(manager_id,entry_date,description,source_type,source_id,reversal_of,posted_by)
  VALUES(e.manager_id,p_reversal_date,'Reversal of '||e.description||': '||trim(p_reason),'journal_reversal',e.id,e.id,v_uid) RETURNING id INTO v_entry;
  FOR l IN SELECT * FROM public.ledger_journal_lines WHERE journal_entry_id=e.id LOOP
    INSERT INTO public.ledger_journal_lines(journal_entry_id,account_id,property_id,debit,credit,memo)
    VALUES(v_entry,l.account_id,l.property_id,l.credit,l.debit,coalesce(l.memo,'')||' | reversal');
  END LOOP;
  -- Original journal row is intentionally untouched; reversal_of provides the immutable linkage.
  RETURN jsonb_build_object('ok',true,'reversal_journal_entry_id',v_entry,'reversed_entry_id',e.id);
END; $$;

CREATE OR REPLACE FUNCTION public.get_manager_ledger_adjustment_governance(p_manager_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid:=auth.uid();
BEGIN
  IF v_uid IS NULL OR auth.role()<>'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'ok',true,
    'adjustments',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT id,period_start,period_end,entry_date,description,reason,status,requested_by,approved_by,approved_at,rejection_reason,posted_journal_entry_id,created_at FROM public.ledger_adjustment_requests WHERE manager_id=p_manager_id ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb),
    'recent_journals',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.entry_date DESC,x.created_at DESC) FROM (SELECT id,entry_date,description,source_type,source_id,status,reversal_of,posted_by,created_at FROM public.ledger_journal_entries WHERE manager_id=p_manager_id ORDER BY entry_date DESC,created_at DESC LIMIT 100) x),'[]'::jsonb)
  );
END; $$;

REVOKE ALL ON FUNCTION public.submit_ledger_adjustment_atomic(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.approve_ledger_adjustment_atomic(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.reject_ledger_adjustment_atomic(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.post_ledger_adjustment_atomic(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.reverse_ledger_entry_atomic(uuid,text,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_manager_ledger_adjustment_governance(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_ledger_adjustment_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ledger_adjustment_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_ledger_adjustment_atomic(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_ledger_adjustment_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_ledger_entry_atomic(uuid,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_ledger_adjustment_governance(uuid) TO authenticated;

COMMENT ON TABLE public.ledger_adjustment_requests IS 'Controlled, approval-gated accounting adjustments. Posted journal entries remain immutable and corrections use reversals.';
