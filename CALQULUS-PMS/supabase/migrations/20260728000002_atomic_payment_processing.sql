-- ============================================================
-- CALQULUS RMS: Atomic Payment Processing
--
-- Adds RPC functions for atomic multi-table payment operations
-- wrapped in database transactions to guarantee consistency.
--
-- Key guarantees:
--   1. All payment operations complete as a single atomic unit
--   2. No partial updates on failure
--   3. Concurrent requests handled safely with row-level locking
--   4. Idempotency via unique constraint on (tenant_id, bank_reference)
-- ============================================================

-- ── 1. Atomic payment processing function ─────────────────────────────
-- Wraps invoice updates, payment insert, and balance updates in a
-- single transaction. Returns detailed result for notifications.
CREATE OR REPLACE FUNCTION public.process_payment_atomic(
  p_tenant_id          uuid,
  p_manager_id          uuid,
  p_amount              numeric,
  p_payment_method      text,
  p_payment_date        date,
  p_reference           text,
  p_invoice_id          uuid DEFAULT NULL,
  p_invoice_ids         uuid[] DEFAULT NULL,
  p_unit_id             uuid DEFAULT NULL,
  p_property_id         uuid DEFAULT NULL,
  p_unit_number         text DEFAULT NULL,
  p_phone               text DEFAULT NULL,
  p_recorded_by         uuid DEFAULT NULL,
  p_notes               text DEFAULT NULL,
  p_existing_transaction_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as table owner, bypasses RLS for atomic operations
AS $$
DECLARE
  v_transaction_id    uuid;
  v_invoice_id         uuid;
  v_allocations        jsonb := '[]'::jsonb;
  v_remaining          numeric := p_amount;
  v_invoice_amount     numeric;
  v_invoice_balance    numeric;
  v_allocation_amount  numeric;
  v_is_closed          boolean;
  v_invoice_record     record;
  v_payment_record     record;
  v_existing_tx        record;
BEGIN
  -- Check for duplicate transaction (idempotency)
  IF p_existing_transaction_id IS NOT NULL THEN
    -- This is a replay from mpesa-callback, skip transaction creation
    v_transaction_id := p_existing_transaction_id;
  ELSE
    -- Check if transaction already exists for this reference
    SELECT id, status INTO v_existing_tx
    FROM public.payment_transactions
    WHERE tenant_id = p_tenant_id
      AND bank_reference = p_reference
      AND status = 'completed'
    FOR UPDATE;  -- Lock row to prevent concurrent duplicates

    IF v_existing_tx.id IS NOT NULL THEN
      -- Duplicate detected, return success with existing transaction
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'transaction_id', v_existing_tx.id,
        'allocations', '[]'::jsonb
      );
    END IF;

    -- Create payment transaction record
    INSERT INTO public.payment_transactions (
      tenant_id, manager_id, unit_id, property_id, unit_number,
      amount, payment_type, payment_method, phone_number,
      bank_reference, status, initiated_at, completed_at,
      recorded_by, notes
    ) VALUES (
      p_tenant_id, p_manager_id, p_unit_id, p_property_id, p_unit_number,
      p_amount, p_payment_method, p_payment_method, p_phone,
      p_reference, 'completed', now(), now(),
      p_recorded_by, p_notes
    )
    RETURNING id INTO v_transaction_id;
  END IF;

  -- Get invoices to process (with row lock)
  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    -- Specific invoices provided
    FOR v_invoice_record IN
      SELECT id, invoice_number, amount, balance_due, status
      FROM public.invoices
      WHERE id = ANY(p_invoice_ids)
        AND tenant_id = p_tenant_id
        AND status IN ('pending', 'overdue')
      ORDER BY due_date ASC
      FOR UPDATE  -- Lock rows for safe concurrent updates
    LOOP
      SELECT process_invoice_payment(
        v_invoice_record.id,
        v_transaction_id,
        v_remaining
      ) INTO v_allocation_amount;

      v_allocations := v_allocations || jsonb_build_array(
        jsonb_build_object(
          'invoice_id', v_invoice_record.id,
          'amount', v_allocation_amount,
          'closed', v_invoice_record.balance_due <= v_allocation_amount
        )
      );

      v_remaining := v_remaining - v_allocation_amount;
      IF v_remaining <= 0 THEN
        EXIT;
      END IF;
    END LOOP;

  ELSIF p_invoice_id IS NOT NULL THEN
    -- Single invoice
    SELECT id, amount, balance_due INTO v_invoice_record
    FROM public.invoices
    WHERE id = p_invoice_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_invoice_record.id IS NOT NULL THEN
      SELECT process_invoice_payment(
        v_invoice_record.id,
        v_transaction_id,
        p_amount
      ) INTO v_allocation_amount;

      v_allocations := v_allocations || jsonb_build_array(
        jsonb_build_object(
          'invoice_id', v_invoice_record.id,
          'amount', v_allocation_amount,
          'closed', v_invoice_record.balance_due <= v_allocation_amount
        )
      );

      v_remaining := v_remaining - v_allocation_amount;
    END IF;

  ELSE
    -- Auto-allocate to oldest unpaid invoices
    FOR v_invoice_record IN
      SELECT id, invoice_number, amount, balance_due, status
      FROM public.invoices
      WHERE tenant_id = p_tenant_id
        AND status IN ('pending', 'overdue')
      ORDER BY due_date ASC
      FOR UPDATE
    LOOP
      IF v_remaining <= 0 THEN
        EXIT;
      END IF;

      SELECT process_invoice_payment(
        v_invoice_record.id,
        v_transaction_id,
        v_remaining
      ) INTO v_allocation_amount;

      v_allocations := v_allocations || jsonb_build_array(
        jsonb_build_object(
          'invoice_id', v_invoice_record.id,
          'amount', v_allocation_amount,
          'closed', v_invoice_record.balance_due <= v_allocation_amount
        )
      );

      v_remaining := v_remaining - v_allocation_amount;
    END LOOP;
  END IF;

  -- Handle advance credit (excess payment)
  IF v_remaining > 0 THEN
    INSERT INTO public.tenant_credit_ledger (
      tenant_id, transaction_id, amount, created_at, description
    ) VALUES (
      p_tenant_id, v_transaction_id, v_remaining, now(),
      'Advance payment credit from ' || p_reference
    );
  END IF;

  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'allocations', v_allocations,
    'advance_credit', GREATEST(v_remaining, 0),
    'total_allocated', p_amount - GREATEST(v_remaining, 0)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback is automatic in plpgsql functions
    RAISE;
END;
$$;

-- ── 2. Invoice payment processing helper ────────────────────────────
-- Updates invoice paid_amount and balance_due, creates payment record
CREATE OR REPLACE FUNCTION public.process_invoice_payment(
  p_invoice_id       uuid,
  p_transaction_id   uuid,
  p_amount            numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice         record;
  v_allocation       numeric;
  v_remaining        numeric := p_amount;
BEGIN
  -- Get invoice with lock
  SELECT id, amount, balance_due, paid_amount, status
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RETURN 0;  -- Invoice not found
  END IF;

  -- Calculate allocation
  v_allocation := LEAST(v_remaining, v_invoice.balance_due);

  -- Create payment record for this invoice
  INSERT INTO public.payments (
    invoice_id, transaction_id, tenant_id, amount,
    paid_at, method, status, reference
  ) VALUES (
    p_invoice_id, p_transaction_id, v_invoice.id,
    v_allocation, now(), 'mpesa', 'success', p_transaction_id
  );

  -- Update invoice totals
  UPDATE public.invoices SET
    paid_amount   = paid_amount + v_allocation,
    balance_due   = GREATEST(balance_due - v_allocation, 0),
    status        = CASE
                     WHEN balance_due <= v_allocation AND status != 'paid' THEN 'paid'
                     ELSE status
                   END,
    paid_date     = CASE
                     WHEN balance_due <= v_allocation THEN now()::date
                     ELSE paid_date
                   END
  WHERE id = p_invoice_id;

  RETURN v_allocation;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ── 3. Lock invoices for concurrent update safety ──────────────────
CREATE OR REPLACE FUNCTION public.lock_invoices_for_update(
  p_invoice_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM id FROM public.invoices
  WHERE id = ANY(p_invoice_ids)
  FOR UPDATE;

  -- Row-level lock acquired for all specified invoices
END;
$$;

-- ── 4. Ensure idempotency constraints exist ─────────────────────────
-- These may already exist from earlier migrations.
-- NOTE: partial uniqueness cannot be expressed as ALTER TABLE ... ADD CONSTRAINT
-- (PostgreSQL has no partial constraints) — use partial UNIQUE INDEXES instead.
CREATE UNIQUE INDEX IF NOT EXISTS payment_tx_idempotent_key_unique
  ON public.payment_transactions (idempotent_key)
  WHERE idempotent_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_tx_ref_tenant_unique
  ON public.payment_transactions (tenant_id, bank_reference)
  WHERE status = 'completed' AND bank_reference IS NOT NULL;

-- ── 5. Add idempotent_key column if not exists ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_transactions'
      AND column_name = 'idempotent_key'
  ) THEN
    ALTER TABLE public.payment_transactions
      ADD COLUMN idempotent_key text;

    CREATE UNIQUE INDEX payment_tx_idempotent_key_unique
      ON public.payment_transactions (idempotent_key)
      WHERE idempotent_key IS NOT NULL;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.process_payment_atomic IS
  'Atomically processes a payment, updating invoices and creating payment records within a single transaction';
COMMENT ON FUNCTION public.process_invoice_payment IS
  'Helper function to process payment for a single invoice with row locking';
COMMENT ON FUNCTION public.lock_invoices_for_update IS
  'Acquires row-level locks on specified invoices for safe concurrent updates';
