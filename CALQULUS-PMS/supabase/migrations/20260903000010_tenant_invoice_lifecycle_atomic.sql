-- CALQULUS Phase 25: atomic tenant invoice lifecycle transitions.
-- Invoice creation and payment are already atomic; cancellation must use the same boundary.

CREATE OR REPLACE FUNCTION public.cancel_invoice_atomic(
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
BEGIN
  IF auth.role() NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() <> 'service_role' AND v_invoice.manager_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_invoice.status = 'paid' THEN
    RAISE EXCEPTION 'Paid invoice cannot be cancelled' USING ERRCODE = '55000';
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'invoice_id', v_invoice.id, 'status', 'cancelled');
  END IF;

  IF v_invoice.status NOT IN ('pending', 'overdue', 'partially_paid') THEN
    RAISE EXCEPTION 'Invoice status cannot be cancelled: %', v_invoice.status USING ERRCODE = '55000';
  END IF;

  IF COALESCE(v_invoice.paid_amount, 0) > 0 OR COALESCE(v_invoice.balance_due, v_invoice.amount) < v_invoice.amount THEN
    RAISE EXCEPTION 'Partially paid invoice cannot be cancelled; use a credit note instead' USING ERRCODE = '55000';
  END IF;

  UPDATE public.invoices
  SET status = 'cancelled', updated_at = now()
  WHERE id = v_invoice.id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'invoice_id', v_invoice.id, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_invoice_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_atomic(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_invoice_atomic(
  p_invoice_id uuid,
  p_amount numeric,
  p_due_date date,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_new_balance numeric;
BEGIN
  IF auth.role() NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_due_date IS NULL THEN
    RAISE EXCEPTION 'Amount and due date are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND v_invoice.manager_id <> auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF v_invoice.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Only unpaid invoices can be edited' USING ERRCODE = '55000';
  END IF;
  IF COALESCE(v_invoice.paid_amount, 0) > p_amount THEN
    RAISE EXCEPTION 'New invoice amount cannot be below paid amount' USING ERRCODE = '22023';
  END IF;

  v_new_balance := round(p_amount - COALESCE(v_invoice.paid_amount, 0), 2);
  UPDATE public.invoices
  SET amount = round(p_amount, 2),
      balance_due = v_new_balance,
      description = p_description,
      due_date = p_due_date,
      updated_at = now()
  WHERE id = v_invoice.id;

  RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice.id, 'amount', round(p_amount,2), 'balance_due', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.update_invoice_atomic(uuid, numeric, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, numeric, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_invoice_installment_plan_atomic(
  p_invoice_id uuid,
  p_plan jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
BEGIN
  IF auth.role() NOT IN ('authenticated', 'service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN RAISE EXCEPTION 'Installment plan must be an object' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND v_invoice.manager_id <> auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF v_invoice.status IN ('paid', 'cancelled', 'refunded', 'failed') THEN RAISE EXCEPTION 'Invoice cannot receive an installment plan in its current state' USING ERRCODE = '55000'; END IF;
  UPDATE public.invoices SET installment_plan = p_plan, updated_at = now() WHERE id = v_invoice.id;
  RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice.id);
END;
$$;
REVOKE ALL ON FUNCTION public.set_invoice_installment_plan_atomic(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_invoice_installment_plan_atomic(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_payment_receipt_atomic(
  p_receipt_id uuid,
  p_verified_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt public.payment_receipts%ROWTYPE;
  v_manager_id uuid;
  v_payment jsonb;
BEGIN
  IF auth.role() NOT IN ('authenticated', 'service_role') THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_receipt FROM public.payment_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF v_receipt.id IS NULL THEN RAISE EXCEPTION 'Receipt not found' USING ERRCODE = 'P0002'; END IF;
  SELECT manager_id INTO v_manager_id FROM public.tenants WHERE id = v_receipt.tenant_id FOR UPDATE;
  IF v_manager_id IS NULL THEN RAISE EXCEPTION 'Receipt tenant is not assigned to a manager' USING ERRCODE = '55000'; END IF;
  IF auth.role() <> 'service_role' AND v_manager_id <> auth.uid() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF auth.role() <> 'service_role' AND p_verified_by <> auth.uid() THEN RAISE EXCEPTION 'verified_by must be the authenticated manager' USING ERRCODE = '42501'; END IF;
  IF v_receipt.status = 'verified' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'receipt_id', v_receipt.id);
  END IF;
  IF v_receipt.status <> 'pending' THEN RAISE EXCEPTION 'Only pending receipts can be verified' USING ERRCODE = '55000'; END IF;

  IF v_receipt.invoice_id IS NOT NULL THEN
    SELECT public.process_payment_atomic(
      v_receipt.tenant_id, v_manager_id, v_receipt.amount, v_receipt.payment_method,
      v_receipt.payment_date, COALESCE(NULLIF(v_receipt.reference_number,''), 'RECEIPT-' || v_receipt.id::text),
      v_receipt.invoice_id, NULL, NULL, NULL, NULL, NULL, COALESCE(p_verified_by, auth.uid()), 'Payment receipt verified'
    ) INTO v_payment;
  END IF;

  UPDATE public.payment_receipts
  SET status = 'verified', verified_by = COALESCE(p_verified_by, auth.uid())::text, verified_at = now(), updated_at = now()
  WHERE id = v_receipt.id;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'receipt_id', v_receipt.id, 'payment', COALESCE(v_payment, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.verify_payment_receipt_atomic(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_payment_receipt_atomic(uuid, uuid) TO authenticated, service_role;
