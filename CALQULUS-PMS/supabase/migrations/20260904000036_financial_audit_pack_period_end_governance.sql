-- CALQULUS PMS — Period-End Financial Audit Pack Governance
-- Converts a closed period into a reproducible, evidence-linked audit pack.
-- The pack is a snapshot of authoritative application data; it does not invent forecasts.

CREATE TABLE IF NOT EXISTS public.financial_audit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_period_id uuid NOT NULL REFERENCES public.financial_close_periods(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','finalized','superseded')),
  snapshot jsonb NOT NULL,
  artifact_sha256 text,
  finalized_at timestamptz,
  finalized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, close_period_id, status) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS financial_audit_packs_manager_idx
  ON public.financial_audit_packs(manager_id, period_end DESC);
CREATE INDEX IF NOT EXISTS financial_audit_packs_close_idx
  ON public.financial_audit_packs(close_period_id, created_at DESC);

ALTER TABLE public.financial_audit_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financial_audit_packs_manager_scope ON public.financial_audit_packs;
CREATE POLICY financial_audit_packs_manager_scope ON public.financial_audit_packs
  FOR SELECT USING (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.financial_audit_packs FROM PUBLIC, anon;
GRANT SELECT ON public.financial_audit_packs TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_manager_financial_audit_pack(
  p_manager_id uuid,
  p_close_period_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_close public.financial_close_periods;
  v_snapshot jsonb;
  v_active_recon integer := 0;
  v_critical_recon integer := 0;
  v_invoice_count integer := 0;
  v_invoice_amount numeric := 0;
  v_collected numeric := 0;
  v_expenses numeric := 0;
  v_bank_count integer := 0;
  v_unmatched_bank integer := 0;
  v_payout_count integer := 0;
  v_paid_payouts numeric := 0;
  v_document_count integer := 0;
  v_unverified_documents integer := 0;
  v_work_open integer := 0;
  v_pack public.financial_audit_packs;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_close FROM public.financial_close_periods
  WHERE id = p_close_period_id AND manager_id = p_manager_id;
  IF NOT FOUND OR v_close.status <> 'closed' THEN
    RAISE EXCEPTION 'A closed financial period is required' USING ERRCODE='55000';
  END IF;

  SELECT count(*) FILTER (WHERE status IN ('open','in_progress')), count(*) FILTER (WHERE status IN ('open','in_progress') AND severity='critical')
  INTO v_active_recon, v_critical_recon
  FROM public.reconciliation_cases
  WHERE manager_id=p_manager_id AND detected_at::date <= v_close.period_end
    AND (resolved_at IS NULL OR resolved_at::date > v_close.period_end);

  SELECT count(*), coalesce(sum(coalesce(i.original_amount,i.amount)),0)
  INTO v_invoice_count, v_invoice_amount
  FROM public.invoices i
  WHERE i.manager_id=p_manager_id AND i.created_at::date BETWEEN v_close.period_start AND v_close.period_end AND i.status <> 'cancelled';

  SELECT coalesce(sum(pa.allocated_amount),0)
  INTO v_collected
  FROM public.payment_allocations pa
  JOIN public.payment_transactions pt ON pt.id=pa.transaction_id
  WHERE pa.manager_id=p_manager_id AND pt.status='completed' AND pa.created_at::date BETWEEN v_close.period_start AND v_close.period_end;

  SELECT coalesce(sum(e.amount),0)
  INTO v_expenses
  FROM public.expenditures e
  WHERE e.manager_id=p_manager_id AND e.created_at::date BETWEEN v_close.period_start AND v_close.period_end;

  SELECT count(*), count(*) FILTER (WHERE matched=false)
  INTO v_bank_count, v_unmatched_bank
  FROM public.bank_transactions bt
  WHERE bt.manager_id=p_manager_id AND bt.transaction_date BETWEEN v_close.period_start AND v_close.period_end;

  SELECT count(*), coalesce(sum(CASE WHEN status='paid' THEN amount ELSE 0 END),0)
  INTO v_payout_count, v_paid_payouts
  FROM public.payout_requests pr
  WHERE pr.manager_id=p_manager_id AND pr.period_start <= v_close.period_end AND pr.period_end >= v_close.period_start;

  SELECT count(*), count(*) FILTER (WHERE verification_status='unverified')
  INTO v_document_count, v_unverified_documents
  FROM public.landlord_documents d
  WHERE d.manager_id=p_manager_id AND d.created_at::date <= v_close.period_end AND d.is_visible=true;

  SELECT count(*) INTO v_work_open
  FROM public.operation_work_items w
  WHERE w.manager_id=p_manager_id AND w.status IN ('open','in_progress')
    AND w.created_at::date <= v_close.period_end;

  v_snapshot := jsonb_build_object(
    'schema_version','1.0',
    'generated_at',now(),
    'manager_id',p_manager_id,
    'close_period',jsonb_build_object('id',v_close.id,'period_start',v_close.period_start,'period_end',v_close.period_end,'closed_at',v_close.closed_at,'closed_by',v_close.closed_by),
    'financials',jsonb_build_object('invoice_count',v_invoice_count,'invoiced_amount',round(v_invoice_amount,2),'collected_amount',round(v_collected,2),'expenses',round(v_expenses,2),'net_cash_movement',round(v_collected-v_expenses,2)),
    'bank_reconciliation',jsonb_build_object('transaction_count',v_bank_count,'unmatched_count',v_unmatched_bank),
    'owner_settlement',jsonb_build_object('payout_request_count',v_payout_count,'paid_payout_amount',round(v_paid_payouts,2)),
    'evidence',jsonb_build_object('visible_document_count',v_document_count,'unverified_document_count',v_unverified_documents),
    'operations',jsonb_build_object('open_work_item_count',v_work_open),
    'reconciliation',jsonb_build_object('active_at_period_end',v_active_recon,'critical_at_period_end',v_critical_recon),
    'close_snapshot',v_close.snapshot
  );

  INSERT INTO public.financial_audit_packs(manager_id,close_period_id,period_start,period_end,status,snapshot,updated_at)
  VALUES(p_manager_id,v_close.id,v_close.period_start,v_close.period_end,'generated',v_snapshot,now())
  ON CONFLICT (manager_id,close_period_id,status) DO UPDATE SET snapshot=EXCLUDED.snapshot,updated_at=now()
  RETURNING * INTO v_pack;

  RETURN jsonb_build_object('ok',true,'pack_id',v_pack.id,'status',v_pack.status,'snapshot',v_pack.snapshot);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_manager_financial_audit_pack(
  p_pack_id uuid,
  p_artifact_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_pack public.financial_audit_packs;
  v_ok boolean;
BEGIN
  IF v_uid IS NULL OR auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_artifact_sha256 !~ '^[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'A SHA-256 artifact hash is required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_pack FROM public.financial_audit_packs WHERE id=p_pack_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Audit pack not found' USING ERRCODE='P0002'; END IF;
  SELECT public.can_manage_property_scope(v_pack.manager_id) INTO v_ok;
  IF NOT COALESCE(v_ok,false) THEN RAISE EXCEPTION 'Audit pack scope unauthorized' USING ERRCODE='42501'; END IF;
  IF v_pack.status <> 'generated' THEN RAISE EXCEPTION 'Only generated packs can be finalized' USING ERRCODE='55000'; END IF;

  UPDATE public.financial_audit_packs
  SET status='finalized',artifact_sha256=lower(trim(p_artifact_sha256)),finalized_at=now(),finalized_by=v_uid,updated_at=now()
  WHERE id=v_pack.id;

  -- Retain exactly one active finalized pack for a close period. Older finalized
  -- packs become historical superseded records before a regenerated pack is used.
  UPDATE public.financial_audit_packs SET status='superseded',updated_at=now()
  WHERE manager_id=v_pack.manager_id AND close_period_id=v_pack.close_period_id
    AND status='finalized' AND id<>v_pack.id;

  RETURN jsonb_build_object('ok',true,'pack_id',v_pack.id,'status','finalized','artifact_sha256',lower(trim(p_artifact_sha256)));
END;
$$;

REVOKE ALL ON FUNCTION public.generate_manager_financial_audit_pack(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.finalize_manager_financial_audit_pack(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_manager_financial_audit_pack(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.finalize_manager_financial_audit_pack(uuid,text) TO authenticated,service_role;

COMMENT ON TABLE public.financial_audit_packs IS 'Reproducible period-end snapshot derived from closed financial periods and linked operational/evidence controls.';
