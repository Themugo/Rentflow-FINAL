-- CALQULUS Phase 60: payment audit-log integrity.
-- payment_logs is an append-only audit trail for payment_transactions.
-- All client writes converge through an authorization-aware RPC.

CREATE INDEX IF NOT EXISTS payment_logs_payment_event_idx
  ON public.payment_logs(payment_id, event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.append_payment_log_atomic(
  p_payment_id uuid,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}'::jsonb
)
RETURNS public.payment_logs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment public.payment_transactions%ROWTYPE;
  v_row public.payment_logs%ROWTYPE;
  v_event text := lower(trim(p_event_type));
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authenticated caller required' USING ERRCODE='28000';
  END IF;
  IF p_payment_id IS NULL OR v_event = '' THEN
    RAISE EXCEPTION 'Payment and event type are required' USING ERRCODE='22023';
  END IF;
  IF length(v_event) > 80 THEN
    RAISE EXCEPTION 'Event type is too long' USING ERRCODE='22023';
  END IF;
  IF p_event_data IS NULL OR jsonb_typeof(p_event_data) <> 'object' THEN
    RAISE EXCEPTION 'Event data must be a JSON object' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE id = p_payment_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment transaction not found'; END IF;

  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.invoices i ON i.property_id = p.id
      WHERE i.id = v_payment.invoice_id
        AND p.manager_id = v_uid
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_uid
        AND ur.role = 'tenant'
        AND ur.tenant_id = v_payment.tenant_id
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized payment log access' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.payment_logs(payment_id, event_type, event_data)
  VALUES (p_payment_id, v_event, p_event_data)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.append_payment_log_atomic(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_payment_log_atomic(uuid,text,jsonb) TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.payment_logs FROM authenticated, anon;
