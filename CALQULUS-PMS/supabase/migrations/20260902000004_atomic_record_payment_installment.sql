-- Phase 11: make manual installment-plan payment recording atomic.
-- The payment and its installment-plan side effects must commit or roll back together.

ALTER TABLE public.arrears_schedule
  ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS arrears_schedule_payment_reference_uidx
  ON public.arrears_schedule(tenant_id, payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_payment_with_installment_atomic(
  p_tenant_id uuid,
  p_manager_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_reference text,
  p_invoice_id uuid DEFAULT NULL,
  p_recorded_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_instalment_count integer DEFAULT NULL,
  p_is_installment boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_effective_manager uuid;
  v_property_id uuid;
  v_invoice_manager uuid;
  v_invoice_tenant uuid;
  v_total_owed numeric := 0;
  v_instalment_amount numeric;
  v_start_date date := COALESCE(p_payment_date, CURRENT_DATE);
  v_next_due_date date := COALESCE(p_payment_date, CURRENT_DATE) + 30;
  v_payment_result jsonb;
BEGIN
  IF auth.role() <> 'authenticated' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
  END IF;

  IF p_tenant_id IS NULL OR p_manager_id IS NULL OR p_amount IS NULL OR p_amount <= 0
     OR NULLIF(trim(COALESCE(p_reference, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid payment request' USING ERRCODE = '22023';
  END IF;

  SELECT ur.role::text
    INTO v_user_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
    AND ur.role IN ('manager', 'submanager')
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Manager or submanager role required' USING ERRCODE = '42501';
  END IF;

  IF v_user_role = 'manager' THEN
    IF v_user_id <> p_manager_id THEN
      RAISE EXCEPTION 'Manager scope mismatch' USING ERRCODE = '42501';
    END IF;
    v_effective_manager := v_user_id;
  ELSE
    SELECT ms.manager_id
      INTO v_effective_manager
    FROM public.manager_submanagers ms
    WHERE ms.submanager_user_id = v_user_id
      AND ms.manager_id = p_manager_id
    LIMIT 1;

    IF v_effective_manager IS NULL THEN
      RAISE EXCEPTION 'Submanager is not assigned to this manager' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT t.manager_id, t.property_id
    INTO v_invoice_manager, v_property_id
  FROM public.tenants t
  WHERE t.id = p_tenant_id
  FOR UPDATE;

  IF v_invoice_manager IS NULL OR v_invoice_manager <> v_effective_manager THEN
    RAISE EXCEPTION 'Tenant is outside your managed portfolio' USING ERRCODE = '42501';
  END IF;

  IF v_user_role = 'submanager'
     AND EXISTS (
       SELECT 1
       FROM public.submanager_permissions sp
       WHERE sp.submanager_user_id = v_user_id
         AND sp.restrict_to_assigned_properties = true
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.submanager_property_assignments spa
       WHERE spa.submanager_user_id = v_user_id
         AND spa.property_id = v_property_id
     ) THEN
    RAISE EXCEPTION 'Tenant is outside your assigned properties' USING ERRCODE = '42501';
  END IF;

  IF p_invoice_id IS NOT NULL THEN
    SELECT i.manager_id, i.tenant_id
      INTO v_invoice_manager, v_invoice_tenant
    FROM public.invoices i
    WHERE i.id = p_invoice_id
    FOR UPDATE;

    IF v_invoice_tenant IS NULL OR v_invoice_tenant <> p_tenant_id
       OR v_invoice_manager <> v_effective_manager THEN
      RAISE EXCEPTION 'Invoice is outside your managed portfolio' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_is_installment AND COALESCE(p_instalment_count, 0) > 1 THEN
    SELECT COALESCE(SUM(COALESCE(i.balance_due, i.amount)), 0)
      INTO v_total_owed
    FROM public.invoices i
    WHERE i.tenant_id = p_tenant_id
      AND i.status IN ('pending', 'overdue');

    v_instalment_amount := CEIL(v_total_owed / p_instalment_count);

    INSERT INTO public.arrears_schedule (
      tenant_id, manager_id, invoice_id, total_owed, instalment_count,
      instalment_amount, status, start_date, next_due_date, notes, payment_reference
    ) VALUES (
      p_tenant_id, v_effective_manager, p_invoice_id, v_total_owed,
      p_instalment_count, v_instalment_amount, 'active', v_start_date,
      v_next_due_date,
      COALESCE(p_notes, 'Installment plan: ' || p_instalment_count || ' payments of ' || v_instalment_amount),
      p_reference
    )
    ON CONFLICT (tenant_id, payment_reference) WHERE payment_reference IS NOT NULL
    DO NOTHING;

    IF p_invoice_id IS NOT NULL THEN
      UPDATE public.invoices
      SET installment_plan = true
      WHERE id = p_invoice_id
        AND tenant_id = p_tenant_id
        AND manager_id = v_effective_manager;
    END IF;
  END IF;

  v_payment_result := public.process_payment_atomic(
    p_tenant_id,
    v_effective_manager,
    p_amount,
    p_payment_method,
    COALESCE(p_payment_date, CURRENT_DATE),
    p_reference,
    p_invoice_id,
    NULL,
    NULL,
    v_property_id,
    NULL,
    NULL,
    COALESCE(p_recorded_by, v_user_id),
    p_notes,
    NULL
  );

  RETURN v_payment_result || jsonb_build_object(
    'installment_plan_created',
    (p_is_installment AND COALESCE(p_instalment_count, 0) > 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment_with_installment_atomic(
  uuid, uuid, numeric, text, date, text, uuid, uuid, text, integer, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_with_installment_atomic(
  uuid, uuid, numeric, text, date, text, uuid, uuid, text, integer, boolean
) TO authenticated, service_role;

COMMENT ON FUNCTION public.record_payment_with_installment_atomic IS
  'Phase 11: atomically records a manual payment and its optional installment-plan side effects.';
