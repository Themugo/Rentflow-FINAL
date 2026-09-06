-- ============================================================
-- CALQULUS RMS: Payment idempotency + process safety
-- ============================================================

-- ── 1. Unique constraint: one completed payment per reference per tenant ──
-- Prevents duplicate payment processing at the DB level.
-- If two concurrent requests both pass the application-level check
-- and try to INSERT with the same reference, only one succeeds.
CREATE UNIQUE INDEX IF NOT EXISTS payment_tx_ref_tenant_unique
  ON public.payment_transactions (bank_reference, tenant_id)
  WHERE status = 'completed' AND bank_reference IS NOT NULL;

-- ── 2. Unique constraint: one STK push per checkout request ID ────────────
-- Daraja sends one callback per CheckoutRequestID.
-- This ensures the callback is only processed once even under retry conditions.
CREATE UNIQUE INDEX IF NOT EXISTS payment_tx_checkout_id_unique
  ON public.payment_transactions (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

-- ── 3. Add processed_at timestamp for audit ───────────────────────────────
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotent_key text;
  -- idempotent_key: client-supplied UUID for manual recordings to prevent
  -- double-submission on network retries

-- Unique index on idempotent_key when present
CREATE UNIQUE INDEX IF NOT EXISTS payment_tx_idempotent_key_unique
  ON public.payment_transactions (idempotent_key)
  WHERE idempotent_key IS NOT NULL;

-- ── 4. Security audit log: log every payment processed ────────────────────
-- Gives webhost full payment audit trail independent of invoice records
CREATE OR REPLACE FUNCTION public.log_payment_processed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.security_audit_log (
      user_id, event_type, resource_type, resource_id,
      details, severity
    ) VALUES (
      NEW.tenant_id, 'payment_processed', 'payment_transaction', NEW.id,
      jsonb_build_object(
        'amount',         NEW.amount,
        'method',         NEW.payment_method,
        'reference',      NEW.bank_reference,
        'manager_id',     NEW.manager_id,
        'completed_at',   NEW.completed_at
      ),
      'info'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_payment_processed ON public.payment_transactions;
CREATE TRIGGER log_payment_processed
  AFTER INSERT OR UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_processed();
