-- CALQULUS PMS — payment closeout and integrity controls.
-- 1) Detect and expire STK attempts that have remained pending beyond a safe window.
-- 2) Audit completed transactions whose allocation totals do not reconcile to the transaction amount.
-- 3) Keep closeout service-only so normal portal users cannot mutate payment state.

CREATE OR REPLACE FUNCTION public.expire_stale_payment_transactions_atomic(p_age_minutes integer DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count integer := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Only the payment service may expire stale transactions' USING ERRCODE='42501'; END IF;
  IF p_age_minutes < 15 OR p_age_minutes > 1440 THEN RAISE EXCEPTION 'Invalid stale transaction age'; END IF;
  UPDATE public.payment_transactions
  SET status='failed', failure_reason=COALESCE(failure_reason,'STK payment attempt expired without a completion callback'), updated_at=now()
  WHERE status IN ('pending','initiating')
    AND initiated_at < now() - make_interval(mins => p_age_minutes)
    AND completed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.expire_stale_payment_transactions_atomic(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_payment_transactions_atomic(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.audit_payment_allocation_integrity(p_manager_id uuid DEFAULT NULL)
RETURNS TABLE(transaction_id uuid, transaction_amount numeric, allocated_amount numeric, difference numeric, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN NULL;
  ELSIF p_manager_id IS NULL OR NOT (p_manager_id=auth.uid() OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p_manager_id AND ms.submanager_user_id=auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT pt.id,
         round(pt.amount,2),
         round(COALESCE(SUM(pa.allocated_amount),0),2),
         round(pt.amount-COALESCE(SUM(pa.allocated_amount),0),2),
         CASE WHEN abs(pt.amount-COALESCE(SUM(pa.allocated_amount),0)) <= 0.01 THEN 'ok' ELSE 'mismatch' END
  FROM public.payment_transactions pt
  LEFT JOIN public.payment_allocations pa ON pa.transaction_id=pt.id
  WHERE pt.status='completed'
    AND (p_manager_id IS NULL OR pt.manager_id=p_manager_id)
  GROUP BY pt.id
  HAVING abs(pt.amount-COALESCE(SUM(pa.allocated_amount),0)) > 0.01
  ORDER BY pt.completed_at DESC NULLS LAST;
END $$;
GRANT EXECUTE ON FUNCTION public.audit_payment_allocation_integrity(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS payment_transactions_pending_closeout_idx
  ON public.payment_transactions (status, initiated_at)
  WHERE status IN ('pending','initiating');

-- Optional daily closeout when pg_cron is available; absence of pg_cron must not block deployment.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='calqulus-expire-stale-payments';
    PERFORM cron.schedule('calqulus-expire-stale-payments','*/15 * * * *', 'SELECT public.expire_stale_payment_transactions_atomic(60)');
  END IF;
EXCEPTION WHEN undefined_table OR undefined_function THEN NULL;
END $$;
