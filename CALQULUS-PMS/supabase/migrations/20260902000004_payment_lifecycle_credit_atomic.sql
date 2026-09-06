-- Phase 12-13: payment lifecycle state safety + atomic tenant-credit application.
-- Never mutate payment/invoice/credit financial state outside an atomic RPC.

CREATE OR REPLACE FUNCTION public.process_payment_atomic(
  p_tenant_id          uuid,
  p_manager_id         uuid,
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
  v_transaction_id uuid;
  v_existing_tx record;
  v_allocations jsonb := '[]'::jsonb;
  v_remaining numeric;
  v_allocation_amount numeric;
  v_invoice_record record;
  v_credit_after numeric := 0;
  v_is_authorized boolean := false;
  v_payable text[] := ARRAY['pending', 'overdue', 'partially_paid'];
BEGIN
  v_remaining := round(coalesce(p_amount, 0), 2);
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
      RAISE EXCEPTION 'Unauthorized payment processing attempt' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Serialize the same tenant/reference pair so concurrent callbacks cannot both create a new payment.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || coalesce(p_reference, ''), 0));

  IF p_existing_transaction_id IS NOT NULL THEN
    SELECT id, tenant_id, manager_id, status, amount
    INTO v_existing_tx
    FROM public.payment_transactions
    WHERE id = p_existing_transaction_id
    FOR UPDATE;

    IF v_existing_tx.id IS NULL THEN
      RAISE EXCEPTION 'Existing payment transaction not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing_tx.tenant_id IS DISTINCT FROM p_tenant_id
       OR v_existing_tx.manager_id IS DISTINCT FROM p_manager_id THEN
      RAISE EXCEPTION 'Payment transaction ownership mismatch' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (SELECT 1 FROM public.payment_allocations WHERE transaction_id = p_existing_transaction_id) THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true,
        'transaction_id', p_existing_transaction_id,
        'allocations', '[]'::jsonb, 'advance_credit', 0,
        'total_allocated', 0
      );
    END IF;

    IF v_existing_tx.status <> 'pending' THEN
      RAISE EXCEPTION 'Payment transaction is not pending and has no allocations' USING ERRCODE = '55000';
    END IF;

    UPDATE public.payment_transactions SET
      payment_type = COALESCE(p_payment_method, payment_type),
      payment_method = COALESCE(p_payment_method, payment_method),
      bank_reference = COALESCE(NULLIF(p_reference, ''), bank_reference),
      unit_id = COALESCE(p_unit_id, unit_id),
      property_id = COALESCE(p_property_id, property_id),
      unit_number = COALESCE(p_unit_number, unit_number),
      amount = v_remaining,
      status = 'completed',
      completed_at = COALESCE(completed_at, now()),
      updated_at = now()
    WHERE id = p_existing_transaction_id;
    v_transaction_id := p_existing_transaction_id;
  ELSE
    SELECT id INTO v_existing_tx
    FROM public.payment_transactions
    WHERE tenant_id = p_tenant_id AND bank_reference = p_reference AND status = 'completed'
    FOR UPDATE;
    IF v_existing_tx.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true,
        'transaction_id', v_existing_tx.id,
        'allocations', '[]'::jsonb, 'advance_credit', 0,
        'total_allocated', 0
      );
    END IF;

    INSERT INTO public.payment_transactions (
      tenant_id, manager_id, unit_id, property_id, unit_number,
      amount, payment_type, payment_method, phone_number,
      bank_reference, status, initiated_at, completed_at,
      recorded_by, notes
    ) VALUES (
      p_tenant_id, p_manager_id, p_unit_id, p_property_id, p_unit_number,
      v_remaining, p_payment_method, p_payment_method, COALESCE(p_phone, ''),
      p_reference, 'completed', now(), now(), COALESCE(p_recorded_by, auth.uid()), p_notes
    ) RETURNING id INTO v_transaction_id;
  END IF;

  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    FOR v_invoice_record IN
      SELECT id, balance_due
      FROM public.invoices
      WHERE id = ANY(p_invoice_ids) AND tenant_id = p_tenant_id AND status = ANY(v_payable)
      ORDER BY due_date ASC
      FOR UPDATE
    LOOP
      SELECT public.process_invoice_payment(v_invoice_record.id, v_transaction_id, v_remaining)
      INTO v_allocation_amount;
      IF v_allocation_amount > 0 THEN
        v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
          'invoice_id', v_invoice_record.id,
          'amount', v_allocation_amount,
          'closed', round(coalesce(v_invoice_record.balance_due, 0) - v_allocation_amount, 2) <= 0
        ));
        v_remaining := round(v_remaining - v_allocation_amount, 2);
      END IF;
      IF v_remaining <= 0 THEN EXIT; END IF;
    END LOOP;
  ELSIF p_invoice_id IS NOT NULL THEN
    SELECT id, balance_due INTO v_invoice_record
    FROM public.invoices
    WHERE id = p_invoice_id AND tenant_id = p_tenant_id AND status = ANY(v_payable)
    FOR UPDATE;
    IF v_invoice_record.id IS NOT NULL THEN
      SELECT public.process_invoice_payment(v_invoice_record.id, v_transaction_id, v_remaining)
      INTO v_allocation_amount;
      IF v_allocation_amount > 0 THEN
        v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
          'invoice_id', v_invoice_record.id,
          'amount', v_allocation_amount,
          'closed', round(coalesce(v_invoice_record.balance_due, 0) - v_allocation_amount, 2) <= 0
        ));
        v_remaining := round(v_remaining - v_allocation_amount, 2);
      END IF;
    END IF;
  ELSE
    FOR v_invoice_record IN
      SELECT id, balance_due
      FROM public.invoices
      WHERE tenant_id = p_tenant_id AND status = ANY(v_payable)
      ORDER BY due_date ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      SELECT public.process_invoice_payment(v_invoice_record.id, v_transaction_id, v_remaining)
      INTO v_allocation_amount;
      IF v_allocation_amount > 0 THEN
        v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
          'invoice_id', v_invoice_record.id,
          'amount', v_allocation_amount,
          'closed', round(coalesce(v_invoice_record.balance_due, 0) - v_allocation_amount, 2) <= 0
        ));
        v_remaining := round(v_remaining - v_allocation_amount, 2);
      END IF;
    END LOOP;
  END IF;

  IF v_remaining > 0 THEN
    SELECT coalesce((
      SELECT balance_after FROM public.tenant_credit_ledger
      WHERE tenant_id = p_tenant_id
      ORDER BY created_at DESC, id DESC
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
    ) ON CONFLICT DO NOTHING;
    UPDATE public.payment_transactions SET
      is_advance = true, credit_amount = v_remaining,
      allocated_amount = round(p_amount - v_remaining, 2), updated_at = now()
    WHERE id = v_transaction_id;
  ELSE
    UPDATE public.payment_transactions SET
      is_partial = EXISTS (
        SELECT 1 FROM public.payment_allocations WHERE transaction_id = v_transaction_id AND closes_invoice = false
      ),
      allocated_amount = round(p_amount, 2), updated_at = now()
    WHERE id = v_transaction_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'transaction_id', v_transaction_id,
    'allocations', v_allocations,
    'advance_credit', greatest(v_remaining, 0),
    'credit_balance', v_credit_after,
    'total_allocated', round(p_amount, 2) - greatest(v_remaining, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_payment_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_payment_atomic TO authenticated, service_role;

-- Credit application needs no fake zero-value payment transaction. A credit
-- allocation is represented by a debit ledger entry plus a nullable allocation
-- row linked to the invoice.
ALTER TABLE public.payment_allocations
  ALTER COLUMN transaction_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_tenant_credit_atomic(
  p_tenant_id uuid,
  p_manager_id uuid DEFAULT NULL,
  p_recorded_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit numeric := 0;
  v_remaining numeric := 0;
  v_applied numeric := 0;
  v_cleared integer := 0;
  v_manager_id uuid;
  v_ledger record;
  v_invoice record;
  v_to_apply numeric;
  v_new_balance numeric;
BEGIN
  SELECT manager_id INTO v_manager_id FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;
  IF v_manager_id IS NULL THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_manager_id IS NOT NULL AND p_manager_id <> v_manager_id THEN
    RAISE EXCEPTION 'Tenant is outside the requested manager portfolio' USING ERRCODE = '42501';
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000'; END IF;
    IF NOT (
      auth.uid() = v_manager_id OR EXISTS (
        SELECT 1 FROM public.manager_submanagers
        WHERE submanager_user_id = auth.uid() AND manager_id = v_manager_id
      )
    ) THEN
      RAISE EXCEPTION 'Unauthorized credit application' USING ERRCODE = '42501';
    END IF;
    IF p_recorded_by IS NULL THEN p_recorded_by := auth.uid(); END IF;
  END IF;

  -- Lock the latest ledger row to serialize competing credit applications.
  SELECT id, balance_after, manager_id INTO v_ledger
  FROM public.tenant_credit_ledger
  WHERE tenant_id = p_tenant_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;
  v_credit := round(coalesce(v_ledger.balance_after, 0), 2);
  IF v_credit <= 0 THEN
    RETURN jsonb_build_object('applied', 0, 'invoices_cleared', 0, 'remaining_credit', 0);
  END IF;
  v_remaining := v_credit;

  FOR v_invoice IN
    SELECT id, invoice_number, balance_due, paid_amount
    FROM public.invoices
    WHERE tenant_id = p_tenant_id AND manager_id = v_manager_id
      AND status IN ('pending', 'overdue', 'partially_paid')
      AND round(coalesce(balance_due, amount), 2) > 0
    ORDER BY due_date ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_to_apply := least(v_remaining, greatest(round(coalesce(v_invoice.balance_due, 0), 2), 0));
    IF v_to_apply <= 0 THEN CONTINUE; END IF;
    v_new_balance := greatest(round(coalesce(v_invoice.balance_due, 0) - v_to_apply, 2), 0);

    UPDATE public.invoices SET
      paid_amount = round(coalesce(paid_amount, 0) + v_to_apply, 2),
      balance_due = v_new_balance,
      status = CASE WHEN v_new_balance <= 0 THEN 'paid' ELSE 'partially_paid' END,
      paid_date = CASE WHEN v_new_balance <= 0 THEN current_date ELSE paid_date END,
      credit_applied = round(coalesce(credit_applied, 0) + v_to_apply, 2),
      updated_at = now()
    WHERE id = v_invoice.id;

    INSERT INTO public.payment_allocations (
      transaction_id, invoice_id, tenant_id, manager_id, allocated_amount, closes_invoice
    ) VALUES (
      NULL, v_invoice.id, p_tenant_id, v_manager_id, v_to_apply, v_new_balance <= 0
    );

    v_remaining := round(v_remaining - v_to_apply, 2);
    v_applied := round(v_applied + v_to_apply, 2);
    IF v_new_balance <= 0 THEN v_cleared := v_cleared + 1; END IF;

    INSERT INTO public.tenant_credit_ledger (
      tenant_id, manager_id, invoice_id, entry_type, amount, balance_after, description
    ) VALUES (
      p_tenant_id, v_manager_id, v_invoice.id, 'debit', v_to_apply, v_remaining,
      'Credit applied to invoice ' || coalesce(v_invoice.invoice_number, v_invoice.id::text)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'applied', v_applied,
    'invoices_cleared', v_cleared,
    'remaining_credit', v_remaining
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_tenant_credit_atomic(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_tenant_credit_atomic(uuid, uuid, uuid) TO authenticated, service_role;
