-- CALQULUS PMS — Financial Close & Owner Statement Integrity
-- Turns the existing financial truth layer into an auditable period-close workflow.
-- No values are invented: all close checks and statement totals derive from
-- authoritative invoices, payment allocations, expenditures, bank transactions
-- and payout requests.

CREATE TABLE IF NOT EXISTS public.financial_close_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','reopened')),
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reopened_at timestamptz,
  reopened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reopen_reason text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_start <= period_end),
  UNIQUE (manager_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS financial_close_periods_manager_idx
  ON public.financial_close_periods(manager_id, period_start DESC);

CREATE TABLE IF NOT EXISTS public.financial_close_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  close_period_id uuid NOT NULL REFERENCES public.financial_close_periods(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('closed','reopened')),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_close_audit_period_idx
  ON public.financial_close_audit(close_period_id, created_at DESC);

ALTER TABLE public.financial_close_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_close_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_close_manager_scope ON public.financial_close_periods;
CREATE POLICY financial_close_manager_scope ON public.financial_close_periods
  FOR SELECT USING (public.can_manage_property_scope(manager_id));

DROP POLICY IF EXISTS financial_close_audit_manager_scope ON public.financial_close_audit;
CREATE POLICY financial_close_audit_manager_scope ON public.financial_close_audit
  FOR SELECT USING (public.can_manage_property_scope(manager_id));

REVOKE ALL ON public.financial_close_periods FROM PUBLIC, anon;
REVOKE ALL ON public.financial_close_audit FROM PUBLIC, anon;
GRANT SELECT ON public.financial_close_periods, public.financial_close_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.get_manager_financial_close(
  p_manager_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_close public.financial_close_periods;
  v_invoice_count integer := 0;
  v_invoice_amount numeric := 0;
  v_collected numeric := 0;
  v_expenses numeric := 0;
  v_unmatched_bank integer := 0;
  v_pending_payments integer := 0;
  v_pending_payouts integer := 0;
  v_checks jsonb;
BEGIN
  IF auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start > p_period_end THEN
    RAISE EXCEPTION 'Invalid financial period' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_close
  FROM public.financial_close_periods
  WHERE manager_id = p_manager_id AND period_start = p_period_start AND period_end = p_period_end;

  SELECT count(*), coalesce(sum(coalesce(i.original_amount, i.amount)),0)
  INTO v_invoice_count, v_invoice_amount
  FROM public.invoices i
  WHERE i.manager_id = p_manager_id
    AND i.created_at::date BETWEEN p_period_start AND p_period_end
    AND i.status <> 'cancelled';

  SELECT coalesce(sum(pa.allocated_amount),0)
  INTO v_collected
  FROM public.payment_allocations pa
  JOIN public.payment_transactions pt ON pt.id = pa.transaction_id
  WHERE pa.manager_id = p_manager_id
    AND pt.status = 'completed'
    AND pa.created_at::date BETWEEN p_period_start AND p_period_end;

  SELECT coalesce(sum(e.amount),0)
  INTO v_expenses
  FROM public.expenditures e
  WHERE e.manager_id = p_manager_id
    AND e.created_at::date BETWEEN p_period_start AND p_period_end;

  SELECT count(*) INTO v_unmatched_bank
  FROM public.bank_transactions bt
  WHERE bt.manager_id = p_manager_id
    AND bt.transaction_date BETWEEN p_period_start AND p_period_end
    AND bt.matched = false;

  SELECT count(*) INTO v_pending_payments
  FROM public.payment_transactions pt
  WHERE pt.manager_id = p_manager_id
    AND pt.created_at::date BETWEEN p_period_start AND p_period_end
    AND pt.status IN ('pending','processing');

  SELECT count(*) INTO v_pending_payouts
  FROM public.payout_requests pr
  WHERE pr.manager_id = p_manager_id
    AND pr.period_start <= p_period_end
    AND pr.period_end >= p_period_start
    AND pr.status IN ('pending','approved');

  v_checks := jsonb_build_object(
    'unmatched_bank_transactions', v_unmatched_bank,
    'pending_payment_transactions', v_pending_payments,
    'pending_owner_payouts', v_pending_payouts
  );

  RETURN jsonb_build_object(
    'manager_id', p_manager_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'status', coalesce(v_close.status, 'open'),
    'closed_at', v_close.closed_at,
    'invoice_count', v_invoice_count,
    'invoiced_amount', round(v_invoice_amount,2),
    'collected_amount', round(v_collected,2),
    'expenses', round(v_expenses,2),
    'net_cash_movement', round(v_collected - v_expenses,2),
    'checks', v_checks,
    'ready_to_close', (v_unmatched_bank = 0 AND v_pending_payments = 0 AND v_pending_payouts = 0),
    'snapshot', v_close.snapshot
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.close_manager_financial_period_atomic(
  p_manager_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_state jsonb;
  v_close public.financial_close_periods;
BEGIN
  IF auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;

  v_state := public.get_manager_financial_close(p_manager_id, p_period_start, p_period_end);
  IF coalesce((v_state->>'ready_to_close')::boolean, false) = false THEN
    RAISE EXCEPTION 'Financial period has unresolved close checks: %', v_state->'checks' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.financial_close_periods (
    manager_id, period_start, period_end, status, closed_at, closed_by, snapshot, updated_at
  ) VALUES (
    p_manager_id, p_period_start, p_period_end, 'closed', now(), auth.uid(), v_state, now()
  )
  ON CONFLICT (manager_id, period_start, period_end)
  DO UPDATE SET
    status = 'closed',
    closed_at = now(),
    closed_by = auth.uid(),
    reopened_at = NULL,
    reopened_by = NULL,
    reopen_reason = NULL,
    snapshot = EXCLUDED.snapshot,
    updated_at = now()
  RETURNING * INTO v_close;

  INSERT INTO public.financial_close_audit(close_period_id, manager_id, action, actor_id, snapshot)
  VALUES (v_close.id, p_manager_id, 'closed', auth.uid(), v_state);

  RETURN jsonb_build_object('ok', true, 'status', 'closed', 'close_period_id', v_close.id, 'snapshot', v_state);
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_manager_financial_period(
  p_manager_id uuid,
  p_period_start date,
  p_period_end date,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_close public.financial_close_periods;
BEGIN
  IF auth.role() <> 'authenticated' OR NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501';
  END IF;
  IF coalesce(trim(p_reason),'') = '' THEN
    RAISE EXCEPTION 'A reopen reason is required' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_close FROM public.financial_close_periods
  WHERE manager_id=p_manager_id AND period_start=p_period_start AND period_end=p_period_end
  FOR UPDATE;
  IF NOT FOUND OR v_close.status <> 'closed' THEN
    RAISE EXCEPTION 'Closed financial period not found' USING ERRCODE='P0002';
  END IF;

  UPDATE public.financial_close_periods
  SET status='reopened', reopened_at=now(), reopened_by=auth.uid(), reopen_reason=trim(p_reason), updated_at=now()
  WHERE id=v_close.id;

  INSERT INTO public.financial_close_audit(close_period_id, manager_id, action, actor_id, reason, snapshot)
  VALUES (v_close.id, p_manager_id, 'reopened', auth.uid(), trim(p_reason), v_close.snapshot);

  RETURN jsonb_build_object('ok', true, 'status', 'reopened', 'close_period_id', v_close.id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_manager_financial_close(uuid,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_manager_financial_period_atomic(uuid,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_manager_financial_period(uuid,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_financial_close(uuid,date,date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_manager_financial_period_atomic(uuid,date,date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_manager_financial_period(uuid,date,date,text) TO authenticated, service_role;
