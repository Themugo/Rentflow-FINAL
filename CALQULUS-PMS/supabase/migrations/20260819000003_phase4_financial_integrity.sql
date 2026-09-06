-- Phase 4: honest invoice statuses, rounded atomic allocation, idempotent callbacks.

DO $$
DECLARE
  conname text;
BEGIN
  FOR conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'invoices'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS %I', conname);
  END LOOP;
END $$;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'failed', 'refunded', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_checkout_request_id_uidx
  ON public.payment_transactions (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_credit_ledger_tx_credit_uidx
  ON public.tenant_credit_ledger (transaction_id)
  WHERE transaction_id IS NOT NULL AND entry_type = 'credit';

-- Allocate one invoice inside the caller transaction. FOR UPDATE + ROUND 2dp.
CREATE OR REPLACE FUNCTION public.process_invoice_payment(
  p_invoice_id       uuid,
  p_transaction_id   uuid,
  p_amount            numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice         record;
  v_allocation       numeric;
  v_closes           boolean;
BEGIN
  IF p_amount IS NULL OR round(p_amount, 2) <= 0 THEN
    RETURN 0;
  END IF;

  SELECT id, amount, balance_due, paid_amount, status, tenant_id, manager_id
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RETURN 0;
  END IF;

  IF v_invoice.status IN ('paid', 'cancelled', 'failed', 'refunded') THEN
    RETURN 0;
  END IF;

  v_allocation := LEAST(round(p_amount, 2), GREATEST(round(COALESCE(v_invoice.balance_due, 0), 2), 0));
  IF v_allocation <= 0 THEN
    RETURN 0;
  END IF;

  v_closes := round(COALESCE(v_invoice.balance_due, 0) - v_allocation, 2) <= 0;

  UPDATE public.invoices SET
    paid_amount   = round(COALESCE(paid_amount, 0) + v_allocation, 2),
    balance_due   = GREATEST(round(COALESCE(balance_due, 0) - v_allocation, 2), 0),
    status        = CASE
                     WHEN v_closes THEN 'paid'
                     WHEN round(COALESCE(paid_amount, 0) + v_allocation, 2) > 0 THEN 'partially_paid'
                     ELSE status
                   END,
    paid_date     = CASE WHEN v_closes THEN now()::date ELSE paid_date END
  WHERE id = p_invoice_id;

  INSERT INTO public.payment_allocations (
    transaction_id, invoice_id, tenant_id, manager_id, allocated_amount, closes_invoice
  ) VALUES (
    p_transaction_id, p_invoice_id, v_invoice.tenant_id, v_invoice.manager_id, v_allocation, v_closes
  )
  ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

  RETURN v_allocation;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_invoice_payment FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_invoice_payment TO service_role;

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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id    uuid;
  v_allocations        jsonb := '[]'::jsonb;
  v_remaining          numeric;
  v_allocation_amount  numeric;
  v_invoice_record     record;
  v_existing_tx        record;
  v_is_authorized      boolean := false;
  v_credit_after       numeric := 0;
  v_payable            text[] := ARRAY['pending', 'overdue', 'partially_paid'];
BEGIN
  v_remaining := round(COALESCE(p_amount, 0), 2);

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'Invalid payment amount: must be greater than zero' USING ERRCODE = '22003';
  END IF;

  IF auth.role() = 'service_role' THEN
    v_is_authorized := true;
  ELSE
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND role = 'tenant'
    ) OR auth.uid() = p_tenant_id THEN
      v_is_authorized := true;
    ELSIF (p_manager_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.manager_submanagers
      WHERE submanager_user_id = auth.uid() AND manager_id = p_manager_id
    )) AND EXISTS (
      SELECT 1 FROM public.tenants
      WHERE id = p_tenant_id AND manager_id = p_manager_id
    ) THEN
      v_is_authorized := true;
    END IF;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'Unauthorized payment processing attempt for tenant % and manager %', p_tenant_id, p_manager_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_existing_transaction_id IS NOT NULL THEN
    SELECT id, status INTO v_existing_tx
    FROM public.payment_transactions
    WHERE id = p_existing_transaction_id
    FOR UPDATE;

    IF v_existing_tx.id IS NULL THEN
      RAISE EXCEPTION 'Existing payment transaction not found' USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.payment_allocations WHERE transaction_id = p_existing_transaction_id
    ) THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'transaction_id', p_existing_transaction_id,
        'allocations', '[]'::jsonb,
        'advance_credit', 0,
        'total_allocated', 0
      );
    END IF;

    UPDATE public.payment_transactions SET
      payment_type   = COALESCE(p_payment_method, payment_type),
      payment_method = COALESCE(p_payment_method, payment_method),
      bank_reference = COALESCE(NULLIF(p_reference, ''), bank_reference),
      unit_id        = COALESCE(p_unit_id, unit_id),
      property_id    = COALESCE(p_property_id, property_id),
      unit_number    = COALESCE(p_unit_number, unit_number),
      amount         = v_remaining,
      status         = 'completed',
      completed_at   = COALESCE(completed_at, now())
    WHERE id = p_existing_transaction_id;

    v_transaction_id := p_existing_transaction_id;
  ELSE
    SELECT id, status INTO v_existing_tx
    FROM public.payment_transactions
    WHERE tenant_id = p_tenant_id
      AND bank_reference = p_reference
      AND status = 'completed'
    FOR UPDATE;

    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'transaction_id', v_existing_tx.id,
        'allocations', '[]'::jsonb,
        'advance_credit', 0,
        'total_allocated', 0
      );
    END IF;

    BEGIN
      INSERT INTO public.payment_transactions (
        tenant_id, manager_id, unit_id, property_id, unit_number,
        amount, payment_type, payment_method, phone_number,
        bank_reference, status, initiated_at, completed_at,
        recorded_by, notes
      ) VALUES (
        p_tenant_id, p_manager_id, p_unit_id, p_property_id, p_unit_number,
        v_remaining, p_payment_method, p_payment_method, COALESCE(p_phone, ''),
        p_reference, 'completed', now(), now(),
        COALESCE(p_recorded_by, auth.uid()), p_notes
      )
      RETURNING id INTO v_transaction_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_transaction_id
      FROM public.payment_transactions
      WHERE tenant_id = p_tenant_id AND bank_reference = p_reference
      LIMIT 1;
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'transaction_id', v_transaction_id,
        'allocations', '[]'::jsonb,
        'advance_credit', 0,
        'total_allocated', 0
      );
    END;
  END IF;

  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    FOR v_invoice_record IN
      SELECT id, balance_due
      FROM public.invoices
      WHERE id = ANY(p_invoice_ids)
        AND tenant_id = p_tenant_id
        AND status = ANY(v_payable)
      ORDER BY due_date ASC
      FOR UPDATE
    LOOP
      SELECT process_invoice_payment(v_invoice_record.id, v_transaction_id, v_remaining)
        INTO v_allocation_amount;
      IF v_allocation_amount > 0 THEN
        v_allocations := v_allocations || jsonb_build_array(
          jsonb_build_object(
            'invoice_id', v_invoice_record.id,
            'amount', v_allocation_amount,
            'closed', round(COALESCE(v_invoice_record.balance_due, 0) - v_allocation_amount, 2) <= 0
          )
        );
        v_remaining := round(v_remaining - v_allocation_amount, 2);
      END IF;
      IF v_remaining <= 0 THEN EXIT; END IF;
    END LOOP;
  ELSIF p_invoice_id IS NOT NULL THEN
    SELECT id, balance_due INTO v_invoice_record
    FROM public.invoices
    WHERE id = p_invoice_id
      AND tenant_id = p_tenant_id
      AND status = ANY(v_payable)
    FOR UPDATE;

    IF v_invoice_record.id IS NOT NULL THEN
      SELECT process_invoice_payment(v_invoice_record.id, v_transaction_id, v_remaining)
        INTO v_allocation_amount;
      IF v_allocation_amount > 0 THEN
        v_allocations := v_allocations || jsonb_build_array(
          jsonb_build_object(
            'invoice_id', v_invoice_record.id,
            'amount', v_allocation_amount,
            'closed', round(COALESCE(v_invoice_record.balance_due, 0) - v_allocation_amount, 2) <= 0
          )
        );
        v_remaining := round(v_remaining - v_allocation_amount, 2);
      END IF;
    END IF;
  ELSE
    FOR v_invoice_record IN
      SELECT id, balance_due
      FROM public.invoices
      WHERE tenant_id = p_tenant_id
        AND status = ANY(v_payable)
      ORDER BY due_date ASC
      FOR UPDATE
    LOOP
      IF v_remaining <= 0 THEN EXIT; END IF;
      SELECT process_invoice_payment(v_invoice_record.id, v_transaction_id, v_remaining)
        INTO v_allocation_amount;
      IF v_allocation_amount > 0 THEN
        v_allocations := v_allocations || jsonb_build_array(
          jsonb_build_object(
            'invoice_id', v_invoice_record.id,
            'amount', v_allocation_amount,
            'closed', round(COALESCE(v_invoice_record.balance_due, 0) - v_allocation_amount, 2) <= 0
          )
        );
        v_remaining := round(v_remaining - v_allocation_amount, 2);
      END IF;
    END LOOP;
  END IF;

  IF v_remaining > 0 THEN
    SELECT COALESCE((
      SELECT balance_after FROM public.tenant_credit_ledger
      WHERE tenant_id = p_tenant_id
      ORDER BY created_at DESC
      LIMIT 1
    ), 0) INTO v_credit_after;
    v_credit_after := round(v_credit_after + v_remaining, 2);

    INSERT INTO public.tenant_credit_ledger (
      tenant_id, manager_id, property_id, transaction_id,
      entry_type, amount, balance_after, description
    ) VALUES (
      p_tenant_id, p_manager_id, p_property_id, v_transaction_id,
      'credit', v_remaining, v_credit_after,
      'Advance payment credit from ' || p_reference
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.payment_transactions SET
      is_advance = true,
      credit_amount = v_remaining,
      allocated_amount = round(p_amount, 2) - v_remaining
    WHERE id = v_transaction_id;
  ELSE
    UPDATE public.payment_transactions SET
      is_partial = EXISTS (
        SELECT 1 FROM public.payment_allocations
        WHERE transaction_id = v_transaction_id AND closes_invoice = false
      ),
      allocated_amount = round(p_amount, 2)
    WHERE id = v_transaction_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'transaction_id', v_transaction_id,
    'allocations', v_allocations,
    'advance_credit', GREATEST(v_remaining, 0),
    'credit_balance', v_credit_after,
    'total_allocated', round(p_amount, 2) - GREATEST(v_remaining, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_payment_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_payment_atomic TO authenticated, service_role;
