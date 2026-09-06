-- Phase 64: Payment-processing provider lifecycle hardening.
-- The table was referenced by the webhost marketplace UI but had no canonical
-- migration in the repository. Keep the schema minimal and server-controlled.
CREATE TABLE IF NOT EXISTS public.payment_processing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid,
  partner_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('mpesa','card','bank_transfer','mobile_money')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active','inactive','pending')),
  transaction_fee numeric(10,4) NOT NULL DEFAULT 0 CHECK (transaction_fee >= 0),
  processing_time text NOT NULL DEFAULT '',
  daily_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK (daily_limit >= 0),
  monthly_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK (monthly_limit >= 0),
  setup_date timestamptz NOT NULL DEFAULT now(),
  last_transaction_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_processing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhost_manages_payment_processing" ON public.payment_processing;
CREATE POLICY "webhost_reads_payment_processing"
  ON public.payment_processing FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));

CREATE OR REPLACE FUNCTION public.transition_payment_processing_atomic(
  p_id uuid,
  p_status text
)
RETURNS public.payment_processing
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.payment_processing%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost') THEN
    RAISE EXCEPTION 'Unauthorized payment processing transition' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active','inactive','pending') THEN
    RAISE EXCEPTION 'Invalid payment processing status';
  END IF;
  SELECT * INTO v_row FROM public.payment_processing WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment processing provider not found'; END IF;
  UPDATE public.payment_processing
  SET status = p_status, updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.payment_processing FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.transition_payment_processing_atomic(uuid,text) TO authenticated;
