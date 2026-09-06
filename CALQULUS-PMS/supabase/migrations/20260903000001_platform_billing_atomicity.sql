-- CALQULUS PMS — Phases 14–15: Platform billing isolation and atomic Stripe lifecycle
--
-- Platform invoices (manager_invoices) are distinct from tenant rent invoices.
-- The legacy payments view points at payment_transactions, whose invoice_id FK
-- targets tenant invoices. Writing platform invoice IDs through that view is
-- therefore unsafe. This migration gives platform billing its own transaction
-- ledger and atomic lifecycle RPCs.

CREATE TABLE IF NOT EXISTS public.platform_payment_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_invoice_id  uuid NOT NULL REFERENCES public.manager_invoices(id) ON DELETE RESTRICT,
  manager_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider             text NOT NULL DEFAULT 'stripe',
  payment_method       text NOT NULL DEFAULT 'stripe_checkout',
  reference            text NOT NULL UNIQUE,
  provider_session_id  text UNIQUE,
  provider_payment_intent_id text UNIQUE,
  amount               numeric(12,2) NOT NULL CHECK (amount > 0),
  currency             text NOT NULL DEFAULT 'KES',
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','success','failed','refunded')),
  failure_reason      text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  initiated_at        timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_payment_transactions_invoice_idx
  ON public.platform_payment_transactions(manager_invoice_id);
CREATE INDEX IF NOT EXISTS platform_payment_transactions_manager_idx
  ON public.platform_payment_transactions(manager_user_id);
CREATE INDEX IF NOT EXISTS platform_payment_transactions_status_idx
  ON public.platform_payment_transactions(status);

ALTER TABLE public.platform_payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_reads_own_platform_payment_transactions"
  ON public.platform_payment_transactions;
CREATE POLICY "manager_reads_own_platform_payment_transactions"
  ON public.platform_payment_transactions FOR SELECT
  USING (manager_user_id = auth.uid());

DROP POLICY IF EXISTS "webhost_manages_platform_payment_transactions"
  ON public.platform_payment_transactions;
CREATE POLICY "webhost_manages_platform_payment_transactions"
  ON public.platform_payment_transactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('webhost','platform_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('webhost','platform_admin')
  ));

-- Atomic creation of a platform payment intent. A retry with the same
-- reference returns the existing transaction only when its ownership and
-- amount match exactly.
CREATE OR REPLACE FUNCTION public.create_platform_payment_atomic(
  p_manager_invoice_id uuid,
  p_manager_user_id uuid,
  p_amount numeric,
  p_reference text,
  p_provider_session_id text DEFAULT NULL,
  p_provider_payment_intent_id text DEFAULT NULL,
  p_currency text DEFAULT 'KES',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_existing record;
  v_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_manager_user_id THEN
    RAISE EXCEPTION 'Unauthorized platform payment creation' USING ERRCODE = '42501';
  END IF;
  IF p_amount <= 0 OR p_reference IS NULL OR btrim(p_reference) = '' THEN
    RAISE EXCEPTION 'Invalid platform payment amount or reference' USING ERRCODE = '22023';
  END IF;

  SELECT id, manager_user_id, amount, status
    INTO v_invoice
  FROM public.manager_invoices
  WHERE id = p_manager_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL OR v_invoice.manager_user_id IS DISTINCT FROM p_manager_user_id THEN
    RAISE EXCEPTION 'Platform invoice ownership mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_invoice.status = 'paid' THEN
    RAISE EXCEPTION 'Platform invoice is already paid' USING ERRCODE = '55000';
  END IF;
  IF round(v_invoice.amount, 2) <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Platform payment amount does not match invoice' USING ERRCODE = '22003';
  END IF;

  SELECT id, manager_invoice_id, manager_user_id, amount, status, provider_session_id
    INTO v_existing
  FROM public.platform_payment_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.manager_invoice_id IS DISTINCT FROM p_manager_invoice_id
       OR v_existing.manager_user_id IS DISTINCT FROM p_manager_user_id
       OR round(v_existing.amount, 2) <> round(p_amount, 2) THEN
      RAISE EXCEPTION 'Platform payment reference collision' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true,
      'transaction_id', v_existing.id, 'status', v_existing.status,
      'provider_session_id', v_existing.provider_session_id
    );
  END IF;

  INSERT INTO public.platform_payment_transactions (
    manager_invoice_id, manager_user_id, provider, payment_method,
    reference, provider_session_id, provider_payment_intent_id, amount, currency, status, metadata
  ) VALUES (
    p_manager_invoice_id, p_manager_user_id, 'stripe', 'stripe_checkout',
    p_reference, p_provider_session_id, p_provider_payment_intent_id, round(p_amount, 2), upper(coalesce(p_currency, 'KES')),
    'pending', coalesce(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'transaction_id', v_id, 'status', 'pending');
END;
$$;

-- Completes/refunds/fails one platform payment while keeping the invoice and
-- transaction state synchronized. Webhook retries are harmless because the
-- transaction row is locked and a terminal state is handled explicitly.
CREATE OR REPLACE FUNCTION public.update_platform_payment_atomic(
  p_reference text,
  p_status text,
  p_invoice_id uuid DEFAULT NULL,
  p_manager_user_id uuid DEFAULT NULL,
  p_provider_session_id text DEFAULT NULL,
  p_provider_payment_intent_id text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_failure_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_invoice record;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Platform payment lifecycle is internal only' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('success','failed','refunded') THEN
    RAISE EXCEPTION 'Invalid platform payment status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tx
  FROM public.platform_payment_transactions
  WHERE reference = p_reference
  FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Platform payment transaction not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_invoice_id IS NOT NULL AND v_tx.manager_invoice_id IS DISTINCT FROM p_invoice_id THEN
    RAISE EXCEPTION 'Platform payment invoice mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_manager_user_id IS NOT NULL AND v_tx.manager_user_id IS DISTINCT FROM p_manager_user_id THEN
    RAISE EXCEPTION 'Platform payment manager mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_provider_session_id IS NOT NULL
     AND v_tx.provider_session_id IS NOT NULL
     AND v_tx.provider_session_id IS DISTINCT FROM p_provider_session_id THEN
    RAISE EXCEPTION 'Stripe session mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_provider_payment_intent_id IS NOT NULL
     AND v_tx.provider_payment_intent_id IS NOT NULL
     AND v_tx.provider_payment_intent_id IS DISTINCT FROM p_provider_payment_intent_id THEN
    RAISE EXCEPTION 'Stripe payment intent mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NOT NULL AND round(v_tx.amount, 2) <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Platform payment amount mismatch' USING ERRCODE = '22003';
  END IF;

  -- Idempotent success/refund/failure handling. A refund is the only allowed
  -- transition from a successful transaction.
  IF v_tx.status = p_status THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'transaction_id', v_tx.id, 'status', v_tx.status);
  END IF;
  IF v_tx.status = 'refunded' THEN
    RAISE EXCEPTION 'Refunded platform payment cannot transition again' USING ERRCODE = '55000';
  END IF;
  IF p_status = 'refunded' AND v_tx.status <> 'success' THEN
    RAISE EXCEPTION 'Only a successful platform payment can be refunded' USING ERRCODE = '55000';
  END IF;
  IF v_tx.status = 'success' AND p_status = 'failed' THEN
    RAISE EXCEPTION 'Successful platform payment cannot be marked failed' USING ERRCODE = '55000';
  END IF;

  SELECT id, manager_user_id, amount, status, paid_date
    INTO v_invoice
  FROM public.manager_invoices
  WHERE id = v_tx.manager_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Platform invoice not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_status = 'success' THEN
    IF v_invoice.status = 'paid' THEN
      -- The invoice may have been reconciled by an older/manual path. Keep the
      -- transaction consistent without rewriting the paid date.
      UPDATE public.platform_payment_transactions
      SET status = 'success', completed_at = COALESCE(completed_at, now()), updated_at = now(),
          provider_session_id = COALESCE(provider_session_id, p_provider_session_id),
          provider_payment_intent_id = COALESCE(provider_payment_intent_id, p_provider_payment_intent_id)
      WHERE id = v_tx.id;
    ELSE
      UPDATE public.manager_invoices
      SET status = 'paid', paid_date = COALESCE(paid_date, CURRENT_DATE), updated_at = now()
      WHERE id = v_invoice.id;
      UPDATE public.platform_payment_transactions
      SET status = 'success', completed_at = COALESCE(completed_at, now()), updated_at = now(),
          provider_session_id = COALESCE(provider_session_id, p_provider_session_id),
          provider_payment_intent_id = COALESCE(provider_payment_intent_id, p_provider_payment_intent_id)
      WHERE id = v_tx.id;
    END IF;

    PERFORM public.reinstate_manager_on_payment(v_invoice.id);
  ELSIF p_status = 'refunded' THEN
    UPDATE public.platform_payment_transactions
    SET status = 'refunded', updated_at = now(), failure_reason = NULL
    WHERE id = v_tx.id;
  ELSE
    UPDATE public.platform_payment_transactions
    SET status = 'failed', updated_at = now(), failure_reason = p_failure_reason
    WHERE id = v_tx.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'transaction_id', v_tx.id, 'status', p_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_platform_payment_atomic FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_platform_payment_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_platform_payment_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_platform_payment_atomic TO service_role;

-- Existing UI used an unsupported invoice_type value. Preserve the schema's
-- intended enum-like contract and map one-time platform charges to 'other'.
-- (Application callers are also patched in this phase.)

CREATE OR REPLACE FUNCTION public.bind_platform_payment_provider_atomic(
  p_transaction_id uuid,
  p_manager_user_id uuid,
  p_provider_session_id text,
  p_provider_payment_intent_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_manager_user_id THEN
    RAISE EXCEPTION 'Unauthorized platform payment binding' USING ERRCODE = '42501';
  END IF;
  SELECT id, manager_user_id, status, provider_session_id, provider_payment_intent_id
    INTO v_tx
  FROM public.platform_payment_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;
  IF v_tx.id IS NULL OR v_tx.manager_user_id IS DISTINCT FROM p_manager_user_id THEN
    RAISE EXCEPTION 'Platform payment ownership mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_tx.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending platform payments can be bound' USING ERRCODE = '55000';
  END IF;
  IF v_tx.provider_session_id IS NOT NULL AND v_tx.provider_session_id IS DISTINCT FROM p_provider_session_id THEN
    RAISE EXCEPTION 'Stripe session already bound to another value' USING ERRCODE = '23505';
  END IF;

  UPDATE public.platform_payment_transactions
  SET provider_session_id = p_provider_session_id,
      provider_payment_intent_id = COALESCE(provider_payment_intent_id, p_provider_payment_intent_id),
      updated_at = now()
  WHERE id = v_tx.id;

  RETURN jsonb_build_object('success', true, 'transaction_id', v_tx.id, 'status', 'pending');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bind_platform_payment_provider_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bind_platform_payment_provider_atomic TO authenticated, service_role;
