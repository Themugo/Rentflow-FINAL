-- Phase 68: Fraud flag integrity and detection-path convergence
ALTER TABLE public.fraud_flags ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payment_transactions(id) ON DELETE CASCADE;
ALTER TABLE public.fraud_flags ADD COLUMN IF NOT EXISTS risk_score integer;
ALTER TABLE public.fraud_flags DROP CONSTRAINT IF EXISTS fraud_flags_risk_score_check;
ALTER TABLE public.fraud_flags ADD CONSTRAINT fraud_flags_risk_score_check CHECK (risk_score IS NULL OR risk_score BETWEEN 0 AND 100);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_payment ON public.fraud_flags(payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS fraud_flags_open_payment_unique ON public.fraud_flags(payment_id) WHERE payment_id IS NOT NULL AND resolved_at IS NULL;

DROP POLICY IF EXISTS "Managers can update fraud_flags for their properties" ON public.fraud_flags;
CREATE OR REPLACE FUNCTION public.create_fraud_flag_atomic(
  p_payment_id uuid,
  p_reason text,
  p_risk_score integer
) RETURNS public.fraud_flags
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_payment public.payment_transactions%ROWTYPE; v_row public.fraud_flags%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF trim(coalesce(p_reason,''))='' THEN RAISE EXCEPTION 'Fraud reason is required' USING ERRCODE='22023'; END IF;
  IF p_risk_score < 0 OR p_risk_score > 100 THEN RAISE EXCEPTION 'Risk score must be between 0 and 100' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_payment FROM public.payment_transactions WHERE id=p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Payment transaction not found' USING ERRCODE='P0002'; END IF;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id=v_uid LIMIT 1;
  IF v_role<>'webhost' AND NOT EXISTS (
    SELECT 1 FROM public.properties p WHERE p.manager_id=v_uid AND p.id IN (SELECT i.property_id FROM public.invoices i WHERE i.id=v_payment.invoice_id)
  ) AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.id=v_payment.invoice_id AND i.manager_id=v_uid) THEN
    RAISE EXCEPTION 'Fraud flag portfolio authorization required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_row FROM public.fraud_flags WHERE payment_id=p_payment_id AND resolved_at IS NULL LIMIT 1 FOR UPDATE;
  IF v_row.id IS NOT NULL THEN
    UPDATE public.fraud_flags SET flag_reason=p_reason, risk_score=p_risk_score, flag_severity=CASE WHEN p_risk_score>=80 THEN 'critical' WHEN p_risk_score>=60 THEN 'high' WHEN p_risk_score>=40 THEN 'medium' ELSE 'low' END WHERE id=v_row.id RETURNING * INTO v_row;
    RETURN v_row;
  END IF;
  INSERT INTO public.fraud_flags(invoice_id,tenant_id,payment_id,flag_reason,risk_score,flag_severity) VALUES(v_payment.invoice_id,v_payment.tenant_id,p_payment_id,p_reason,p_risk_score,CASE WHEN p_risk_score>=80 THEN 'critical' WHEN p_risk_score>=60 THEN 'high' WHEN p_risk_score>=40 THEN 'medium' ELSE 'low' END) RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.fraud_flags FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_fraud_flag_atomic(uuid,text,integer) TO authenticated;
