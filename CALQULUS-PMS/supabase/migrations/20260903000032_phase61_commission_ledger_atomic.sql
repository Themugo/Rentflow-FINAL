-- CALQULUS Phase 61: legacy commission ledger lockdown and service-role atomicity.
-- No browser/client code currently owns this dormant ledger. Keep all financial
-- mutation authority server-side while preserving a canonical service API.

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_amount_nonnegative_ck CHECK (amount >= 0),
  ADD CONSTRAINT commissions_rate_valid_ck CHECK (rate_applied >= 0 AND rate_applied <= 100);

CREATE OR REPLACE FUNCTION public.record_commission_atomic(
  p_invoice_id uuid,
  p_manager_id uuid,
  p_amount numeric,
  p_rate_applied numeric
)
RETURNS public.commissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_row public.commissions%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  IF p_invoice_id IS NULL OR p_manager_id IS NULL OR p_amount < 0 OR p_rate_applied < 0 OR p_rate_applied > 100 THEN
    RAISE EXCEPTION 'Invalid commission values' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.properties p ON p.id = i.property_id
    WHERE i.id = p_invoice_id AND p.manager_id = p_manager_id
  ) THEN
    RAISE EXCEPTION 'Invoice and manager relationship is invalid' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.commissions(invoice_id, manager_id, amount, rate_applied, status)
  VALUES (p_invoice_id, p_manager_id, round(p_amount,2), p_rate_applied, 'pending')
  ON CONFLICT (invoice_id) WHERE invoice_id IS NOT NULL
  DO UPDATE SET manager_id = EXCLUDED.manager_id,
                amount = EXCLUDED.amount,
                rate_applied = EXCLUDED.rate_applied
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_commission_atomic(
  p_commission_id uuid,
  p_status text
)
RETURNS public.commissions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_row public.commissions%ROWTYPE;
  v_status text := lower(trim(p_status));
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;
  IF v_status NOT IN ('pending','collected','refunded') THEN
    RAISE EXCEPTION 'Invalid commission status' USING ERRCODE='22023';
  END IF;

  UPDATE public.commissions
  SET status = v_status,
      collected_at = CASE WHEN v_status = 'collected' THEN COALESCE(collected_at, now()) ELSE collected_at END
  WHERE id = p_commission_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Commission not found'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_commission_atomic(uuid,uuid,numeric,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_commission_atomic(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_commission_atomic(uuid,uuid,numeric,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_commission_atomic(uuid,text) TO service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.commissions FROM authenticated, anon;
