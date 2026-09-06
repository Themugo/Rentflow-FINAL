-- ============================================================
-- Security hardening — deep audit pass (2026-09-04)
--
-- 1. public.payments / public.payouts views were created without
--    security_invoker, so they run with the VIEW OWNER's privileges
--    (the migration-runner role) instead of the querying user's.
--    Table owners are exempt from their own RLS unless
--    FORCE ROW LEVEL SECURITY is set, so every authenticated user
--    querying these views could read every row of
--    payment_transactions / payout_requests platform-wide,
--    completely bypassing the carefully scoped RLS policies on the
--    underlying tables. Edge functions and some frontend code query
--    "payments"/"payouts" by these exact names, so this is live,
--    reachable surface, not dead schema.
--
-- 2. payout_requests' "manager_manages_payouts" policy used
--    `USING (manager_id = auth.uid() OR manager_id IS NULL)` with no
--    role check at all — so ANY authenticated user (not just
--    managers, and not just webhost admins) could read/update/delete
--    every "system landlord" payout request (the rows routed to
--    webhost review, per the table's own design comment). Split into
--    an owner-scoped manager policy and a role-checked webhost policy.
-- ============================================================

-- 1. Force the payments/payouts views to evaluate RLS as the calling
--    user, not the view owner.
ALTER VIEW IF EXISTS public.payments SET (security_invoker = true);
ALTER VIEW IF EXISTS public.payouts SET (security_invoker = true);

-- Underlying tables must also deny table-owner bypass, since a
-- service-role/owner connection is otherwise exempt from its own RLS.
ALTER TABLE IF EXISTS public.payment_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payout_requests FORCE ROW LEVEL SECURITY;

-- Defense in depth: anon has no business reading either view directly.
REVOKE SELECT ON public.payments FROM anon;
REVOKE SELECT ON public.payouts FROM anon;

-- 2. Tighten payout_requests RLS: managers only manage their own rows;
--    only webhost/platform_admin roles may touch the unassigned
--    ("system landlord") rows previously open to everyone.
DROP POLICY IF EXISTS "manager_manages_payouts" ON public.payout_requests;

CREATE POLICY "manager_manages_own_payouts"
  ON public.payout_requests FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "webhost_manages_unassigned_payouts"
  ON public.payout_requests FOR ALL
  USING (
    manager_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
    )
  )
  WITH CHECK (
    manager_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
    )
  );

-- 3. ingest_bank_webhook_atomic: a replayed/duplicate bank webhook whose
--    payload carries neither an external id nor a reference/narration
--    previously slipped past deduplication entirely — `ON CONFLICT
--    (manager_id, external_id) DO NOTHING` never matches when external_id
--    is NULL (Postgres treats NULLs as distinct for uniqueness), and the
--    downstream process_payment_atomic fallback dedup
--    (`bank_reference = p_reference`) likewise never matches a NULL
--    reference. Each replay therefore inserted a brand-new
--    bank_transactions row and, with auto_reconcile on, could re-credit
--    the same real-world transfer repeatedly. Fail safe instead: reject
--    (and let the caller dead-letter) any webhook that cannot be
--    deduplicated by either field, rather than silently accepting
--    unlimited re-crediting risk. This is the same function body as
--    20260903000002_atomic_bank_webhook_reconciliation.sql with only
--    this one guard added.
CREATE OR REPLACE FUNCTION public.ingest_bank_webhook_atomic(
  p_manager_id uuid,
  p_bank_integration_id uuid,
  p_external_id text,
  p_reference text,
  p_description text,
  p_amount numeric,
  p_transaction_date date,
  p_bank_name text,
  p_account_number text DEFAULT NULL,
  p_payer_name text DEFAULT NULL,
  p_payer_phone text DEFAULT NULL,
  p_raw_payload jsonb DEFAULT '{}'::jsonb,
  p_auto_reconcile boolean DEFAULT false,
  p_match_by text DEFAULT 'amount_and_unit'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_tx record;
  v_invoice record;
  v_payment jsonb;
  v_ref text := upper(coalesce(p_reference, '') || ' ' || coalesce(p_description, ''));
  v_match_confidence numeric;
  v_match_method text;
  v_is_new boolean := false;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized bank webhook ingestion' USING ERRCODE = '42501';
  END IF;

  IF p_manager_id IS NULL OR p_bank_integration_id IS NULL THEN
    RAISE EXCEPTION 'manager_id and bank_integration_id are required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Invalid bank transaction amount' USING ERRCODE = '22003';
  END IF;
  IF p_transaction_date IS NULL THEN
    RAISE EXCEPTION 'transaction_date is required' USING ERRCODE = '22023';
  END IF;
  IF nullif(trim(p_external_id), '') IS NULL AND nullif(trim(p_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Bank webhook payload has neither an external id nor a reference — cannot deduplicate safely' USING ERRCODE = '22023';
  END IF;

  -- Serialize the same external transaction across concurrent bank retries.
  IF nullif(trim(p_external_id), '') IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_manager_id::text || ':' || trim(p_external_id), 0)
    );
  END IF;

  -- Insert exactly once. A duplicate unmatched row is deliberately reusable:
  -- the bank may retry after a transient invoice/payment failure.
  INSERT INTO public.bank_transactions (
    manager_id, bank_integration_id, external_id, reference, description,
    amount, transaction_date, bank_name, account_number, payer_name,
    payer_phone, matched, source, raw_payload
  ) VALUES (
    p_manager_id, p_bank_integration_id, nullif(trim(p_external_id), ''),
    p_reference, p_description, round(p_amount, 2), p_transaction_date,
    p_bank_name, p_account_number, p_payer_name, p_payer_phone, false,
    'webhook', coalesce(p_raw_payload, '{}'::jsonb)
  )
  ON CONFLICT (manager_id, external_id) DO NOTHING
  RETURNING * INTO v_bank_tx;

  IF v_bank_tx.id IS NULL THEN
    SELECT * INTO v_bank_tx
    FROM public.bank_transactions
    WHERE manager_id = p_manager_id
      AND external_id = nullif(trim(p_external_id), '')
    FOR UPDATE;
  ELSE
    v_is_new := true;
  END IF;

  IF v_bank_tx.matched THEN
    RETURN jsonb_build_object(
      'received', true,
      'duplicate', true,
      'matched', true,
      'bank_transaction_id', v_bank_tx.id,
      'invoice_id', v_bank_tx.matched_invoice_id
    );
  END IF;

  IF NOT p_auto_reconcile THEN
    RETURN jsonb_build_object(
      'received', true,
      'duplicate', NOT v_is_new,
      'matched', false,
      'bank_transaction_id', v_bank_tx.id
    );
  END IF;

  -- 1) Exact invoice-reference match.
  SELECT i.id, i.invoice_number, i.amount, i.balance_due, i.tenant_id,
         t.unit, t.property_id, t.unit_id, t.phone
    INTO v_invoice
  FROM public.invoices i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.manager_id = p_manager_id
    AND i.status IN ('pending', 'overdue', 'partially_paid')
    AND i.invoice_number IS NOT NULL
    AND position(upper(i.invoice_number) IN v_ref) > 0
  ORDER BY i.due_date ASC NULLS LAST
  LIMIT 1;

  IF v_invoice.id IS NOT NULL THEN
    v_match_confidence := 95;
    v_match_method := 'auto_reference';
  ELSE
    -- 2) Unit reference + amount within 5%.
    SELECT i.id, i.invoice_number, i.amount, i.balance_due, i.tenant_id,
           t.unit, t.property_id, t.unit_id, t.phone
      INTO v_invoice
    FROM public.invoices i
    JOIN public.tenants t ON t.id = i.tenant_id
    WHERE i.manager_id = p_manager_id
      AND i.status IN ('pending', 'overdue', 'partially_paid')
      AND nullif(trim(t.unit), '') IS NOT NULL
      AND position(upper(t.unit) IN v_ref) > 0
      AND greatest(coalesce(i.balance_due, i.amount), 0) > 0
      AND abs(p_amount - greatest(coalesce(i.balance_due, i.amount), 0))
          / greatest(coalesce(i.balance_due, i.amount), 1) < 0.05
    ORDER BY i.due_date ASC NULLS LAST
    LIMIT 1;

    IF v_invoice.id IS NOT NULL THEN
      v_match_confidence := 85;
      v_match_method := 'auto_amount_unit';
    END IF;
  END IF;

  -- 3) Exact amount only when there is one unique candidate.
  IF v_invoice.id IS NULL AND p_match_by <> 'reference' THEN
    IF (
      SELECT count(*)
      FROM public.invoices i
      JOIN public.tenants t ON t.id = i.tenant_id
      WHERE i.manager_id = p_manager_id
        AND i.status IN ('pending', 'overdue', 'partially_paid')
        AND greatest(coalesce(i.balance_due, i.amount), 0) > 0
        AND abs(p_amount - greatest(coalesce(i.balance_due, i.amount), 0)) < 1
    ) = 1 THEN
      SELECT i.id, i.invoice_number, i.amount, i.balance_due, i.tenant_id,
             t.unit, t.property_id, t.unit_id, t.phone
        INTO v_invoice
      FROM public.invoices i
      JOIN public.tenants t ON t.id = i.tenant_id
      WHERE i.manager_id = p_manager_id
        AND i.status IN ('pending', 'overdue', 'partially_paid')
        AND greatest(coalesce(i.balance_due, i.amount), 0) > 0
        AND abs(p_amount - greatest(coalesce(i.balance_due, i.amount), 0)) < 1
      LIMIT 1;
      v_match_confidence := 70;
      v_match_method := 'auto_amount';
    END IF;
  END IF;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object(
      'received', true,
      'duplicate', NOT v_is_new,
      'matched', false,
      'bank_transaction_id', v_bank_tx.id
    );
  END IF;

  -- The central payment RPC performs ownership, amount, idempotency and
  -- invoice-allocation checks. Because this is called inside this function,
  -- a failure rolls back the bank insert/match as one transaction.
  v_payment := public.process_payment_atomic(
    v_invoice.tenant_id,
    p_manager_id,
    round(p_amount, 2),
    'bank_transfer',
    p_transaction_date,
    coalesce(nullif(trim(p_reference), ''), nullif(trim(p_external_id), '')),
    v_invoice.id,
    NULL,
    v_invoice.unit_id,
    v_invoice.property_id,
    v_invoice.unit,
    v_invoice.phone,
    NULL,
    'Auto-matched from ' || coalesce(p_bank_name, 'bank') || ' webhook. Payer: ' || coalesce(p_payer_name, ''),
    NULL
  );

  UPDATE public.bank_transactions
  SET matched = true,
      matched_invoice_id = v_invoice.id,
      matched_tenant_id = v_invoice.tenant_id,
      match_confidence = v_match_confidence,
      match_method = v_match_method
  WHERE id = v_bank_tx.id;

  RETURN jsonb_build_object(
    'received', true,
    'duplicate', NOT v_is_new,
    'matched', true,
    'bank_transaction_id', v_bank_tx.id,
    'invoice_id', v_invoice.id,
    'payment', v_payment
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_bank_webhook_atomic(
  uuid, uuid, text, text, text, numeric, date, text, text, text, text, jsonb, boolean, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_bank_webhook_atomic(
  uuid, uuid, text, text, text, numeric, date, text, text, text, text, jsonb, boolean, text
) TO service_role;
