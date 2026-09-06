-- ============================================================
-- CALQULUS RMS: Security Definer RPC Hardening Migration
-- Migration: 20260811000001_security_definer_rpc_hardening.sql
-- Phase 3 - Hardening Privileged Database RPC Functions
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: Manager Dashboard & Reporting Functions
-- ══════════════════════════════════════════════════════════════

-- 1. get_manager_dashboard_stats
CREATE OR REPLACE FUNCTION public.get_manager_dashboard_stats(p_manager_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
  v_prev_start_date DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
BEGIN
  -- Security validation: Caller must be authenticated or service_role
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    -- Validate caller ownership: Must be manager, assigned submanager, or webhost/admin
    IF p_manager_id != auth.uid() 
       AND NOT EXISTS (
         SELECT 1 FROM public.manager_submanagers 
         WHERE submanager_user_id = auth.uid() AND manager_id = p_manager_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles 
         WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
       ) THEN
      RAISE EXCEPTION 'Unauthorized: Manager ID mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'total_tenants', (
      SELECT COUNT(*) FROM tenants WHERE manager_id = p_manager_id
    ),
    'active_tenants', (
      SELECT COUNT(*) FROM tenants WHERE manager_id = p_manager_id AND status = 'active'
    ),
    'total_properties', (
      SELECT COUNT(*) FROM properties WHERE manager_id = p_manager_id AND status != 'inactive'
    ),
    'total_units', COALESCE((
      SELECT SUM(units) FROM properties WHERE manager_id = p_manager_id AND status != 'inactive'
    ), 0),
    'occupied_units', COALESCE((
      SELECT SUM(occupied_units) FROM properties WHERE manager_id = p_manager_id AND status != 'inactive'
    ), 0),
    'revenue_mtd', COALESCE((
      SELECT COALESCE(SUM(amount), 0) 
      FROM invoices 
      WHERE manager_id = p_manager_id 
        AND status = 'paid'
        AND paid_date >= v_start_date
    ), 0),
    'revenue_prev_month', COALESCE((
      SELECT COALESCE(SUM(amount), 0) 
      FROM invoices 
      WHERE manager_id = p_manager_id 
        AND status = 'paid'
        AND paid_date >= v_prev_start_date
        AND paid_date < v_start_date
    ), 0),
    'pending_invoices', (
      SELECT COUNT(*) FROM invoices WHERE manager_id = p_manager_id AND status = 'pending'
    ),
    'overdue_invoices', (
      SELECT COUNT(*) FROM invoices WHERE manager_id = p_manager_id AND status = 'overdue'
    ),
    'arrears_total', COALESCE((
      SELECT COALESCE(SUM(balance_due), 0) 
      FROM invoices 
      WHERE manager_id = p_manager_id AND status = 'overdue'
    ), 0),
    'active_leases', (
      SELECT COUNT(*) FROM leases WHERE manager_id = p_manager_id AND status = 'active'
    ),
    'expiring_leases_30d', (
      SELECT COUNT(*) FROM leases 
      WHERE manager_id = p_manager_id 
        AND status = 'active'
        AND end_date <= CURRENT_DATE + INTERVAL '30 days'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_manager_dashboard_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_dashboard_stats(UUID) TO authenticated, service_role;


-- 2. get_tenants_with_properties
CREATE OR REPLACE FUNCTION public.get_tenants_with_properties(p_manager_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  status TEXT,
  property_name TEXT,
  property_id UUID,
  unit_id UUID,
  unit_label TEXT,
  monthly_rent NUMERIC,
  move_in_date DATE,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security validation: Caller must be authenticated or service_role
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    -- Webhosts are strictly denied access to tenant PII per Role Architecture Firewall
    IF p_manager_id != auth.uid() 
       AND NOT EXISTS (
         SELECT 1 FROM public.manager_submanagers 
         WHERE submanager_user_id = auth.uid() AND manager_id = p_manager_id
       ) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot access tenant data for manager %', p_manager_id USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.email,
    t.phone,
    t.status,
    p.name as property_name,
    t.property_id,
    t.unit_id,
    pu.label as unit_label,
    t.monthly_rent,
    t.move_in_date,
    t.created_at
  FROM tenants t
  LEFT JOIN properties p ON p.id = t.property_id
  LEFT JOIN property_units pu ON pu.id = t.unit_id
  WHERE t.manager_id = p_manager_id
  ORDER BY t.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_tenants_with_properties(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenants_with_properties(UUID) TO authenticated, service_role;


-- 3. get_properties_with_tenant_counts
CREATE OR REPLACE FUNCTION public.get_properties_with_tenant_counts(p_manager_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  address TEXT,
  units INTEGER,
  occupied_units INTEGER,
  revenue NUMERIC,
  image_url TEXT,
  tenant_count BIGINT,
  active_tenant_count BIGINT,
  occupancy_rate NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security validation
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF p_manager_id != auth.uid() 
       AND NOT EXISTS (
         SELECT 1 FROM public.manager_submanagers 
         WHERE submanager_user_id = auth.uid() AND manager_id = p_manager_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles 
         WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
       ) THEN
      RAISE EXCEPTION 'Unauthorized: Manager ID mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    pr.id,
    pr.name,
    pr.address,
    pr.units,
    pr.occupied_units,
    pr.revenue,
    pr.image_url,
    COUNT(t.id) as tenant_count,
    COUNT(t.id) FILTER (WHERE t.status = 'active') as active_tenant_count,
    CASE WHEN pr.units > 0 THEN ROUND((pr.occupied_units::NUMERIC / pr.units) * 100, 1) ELSE 0 END as occupancy_rate,
    pr.status
  FROM properties pr
  LEFT JOIN tenants t ON t.property_id = pr.id
  WHERE pr.manager_id = p_manager_id AND pr.status != 'inactive'
  GROUP BY pr.id, pr.name, pr.address, pr.units, pr.occupied_units, pr.revenue, pr.image_url, pr.status
  ORDER BY pr.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_properties_with_tenant_counts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_properties_with_tenant_counts(UUID) TO authenticated, service_role;


-- 4. get_manager_recent_activity
CREATE OR REPLACE FUNCTION public.get_manager_recent_activity(p_manager_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE(
  id UUID,
  action TEXT,
  description TEXT,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security validation
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF p_manager_id != auth.uid() 
       AND NOT EXISTS (
         SELECT 1 FROM public.manager_submanagers 
         WHERE submanager_user_id = auth.uid() AND manager_id = p_manager_id
       ) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot access activity logs for manager %', p_manager_id USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.action,
    a.description,
    a.entity_type,
    a.entity_id,
    a.created_at
  FROM activity_logs a
  WHERE a.actor_id = p_manager_id
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_manager_recent_activity(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_recent_activity(UUID, INTEGER) TO authenticated, service_role;


-- ══════════════════════════════════════════════════════════════
-- SECTION 2: Atomic Payment Processing Functions
-- ══════════════════════════════════════════════════════════════

-- 5. process_payment_atomic
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
  v_remaining          numeric := p_amount;
  v_allocation_amount  numeric;
  v_invoice_record     record;
  v_existing_tx        record;
  v_is_authorized      boolean := false;
BEGIN
  -- 1. Input Validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid payment amount: must be greater than zero' USING ERRCODE = '22003';
  END IF;

  -- 2. Security & Caller Authorization Check
  IF auth.role() = 'service_role' THEN
    v_is_authorized := true;
  ELSE
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    -- Check if caller is tenant performing self-service payment
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND role = 'tenant'
    ) OR auth.uid() = p_tenant_id THEN
      v_is_authorized := true;
    -- Check if caller is manager or authorized submanager for this tenant
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

  -- 3. Idempotency & Duplicate Transaction Check
  IF p_existing_transaction_id IS NOT NULL THEN
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
        'allocations', '[]'::jsonb
      );
    END IF;

    INSERT INTO public.payment_transactions (
      tenant_id, manager_id, unit_id, property_id, unit_number,
      amount, payment_type, payment_method, phone_number,
      bank_reference, status, initiated_at, completed_at,
      recorded_by, notes
    ) VALUES (
      p_tenant_id, p_manager_id, p_unit_id, p_property_id, p_unit_number,
      p_amount, p_payment_method, p_payment_method, p_phone,
      p_reference, 'completed', now(), now(),
      COALESCE(p_recorded_by, auth.uid()), p_notes
    )
    RETURNING id INTO v_transaction_id;
  END IF;

  -- 4. Process Invoices (Guaranteed Tenant/Manager Scope)
  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    FOR v_invoice_record IN
      SELECT id, invoice_number, amount, balance_due, status
      FROM public.invoices
      WHERE id = ANY(p_invoice_ids)
        AND tenant_id = p_tenant_id
        AND manager_id = p_manager_id
        AND status IN ('pending', 'overdue')
      ORDER BY due_date ASC
      FOR UPDATE
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
      IF v_remaining <= 0 THEN EXIT; END IF;
    END LOOP;
  ELSIF p_invoice_id IS NOT NULL THEN
    SELECT id, amount, balance_due INTO v_invoice_record
    FROM public.invoices
    WHERE id = p_invoice_id 
      AND tenant_id = p_tenant_id
      AND manager_id = p_manager_id
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
    FOR v_invoice_record IN
      SELECT id, invoice_number, amount, balance_due, status
      FROM public.invoices
      WHERE tenant_id = p_tenant_id
        AND manager_id = p_manager_id
        AND status IN ('pending', 'overdue')
      ORDER BY due_date ASC
      FOR UPDATE
    LOOP
      IF v_remaining <= 0 THEN EXIT; END IF;

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

  -- 5. Excess Payment to Tenant Credit Ledger
  IF v_remaining > 0 THEN
    INSERT INTO public.tenant_credit_ledger (
      tenant_id, transaction_id, amount, created_at, description
    ) VALUES (
      p_tenant_id, v_transaction_id, v_remaining, now(),
      'Advance payment credit from ' || p_reference
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'allocations', v_allocations,
    'advance_credit', GREATEST(v_remaining, 0),
    'total_allocated', p_amount - GREATEST(v_remaining, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_payment_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_payment_atomic TO authenticated, service_role;


-- 6. process_invoice_payment
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
  v_remaining        numeric := p_amount;
BEGIN
  -- Caller verification: Internal helper restricted to service_role or authorized invoice owner
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.tenants t ON i.tenant_id = t.id
      WHERE i.id = p_invoice_id 
        AND (
          t.manager_id = auth.uid() 
          OR EXISTS (
            SELECT 1 FROM public.manager_submanagers 
            WHERE submanager_user_id = auth.uid() AND manager_id = t.manager_id
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND tenant_id = t.id
          )
        )
    ) THEN
      RAISE EXCEPTION 'Unauthorized access to invoice %', p_invoice_id USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT id, amount, balance_due, paid_amount, status, tenant_id
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RETURN 0;
  END IF;

  v_allocation := LEAST(v_remaining, v_invoice.balance_due);

  INSERT INTO public.payments (
    invoice_id, transaction_id, tenant_id, amount,
    paid_at, method, status, reference
  ) VALUES (
    p_invoice_id, p_transaction_id, v_invoice.tenant_id,
    v_allocation, now(), 'mpesa', 'success', p_transaction_id::text
  );

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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_invoice_payment FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_invoice_payment TO service_role;


-- 7. lock_invoices_for_update
CREATE OR REPLACE FUNCTION public.lock_invoices_for_update(
  p_invoice_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    -- Verify that all requested invoices belong to caller's tenant or manager scope
    IF EXISTS (
      SELECT 1 FROM public.invoices i
      LEFT JOIN public.tenants t ON i.tenant_id = t.id
      WHERE i.id = ANY(p_invoice_ids)
        AND t.manager_id != auth.uid()
        AND NOT EXISTS (
          SELECT 1 FROM public.manager_submanagers 
          WHERE submanager_user_id = auth.uid() AND manager_id = t.manager_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND tenant_id = t.id
        )
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Contains invoices outside caller scope' USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM id FROM public.invoices
  WHERE id = ANY(p_invoice_ids)
  FOR UPDATE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lock_invoices_for_update FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_invoices_for_update TO authenticated, service_role;


-- ══════════════════════════════════════════════════════════════
-- SECTION 3: Account Lifecycle & Reinstatement Functions
-- ══════════════════════════════════════════════════════════════

-- 8. reinstate_manager_on_payment
CREATE OR REPLACE FUNCTION public.reinstate_manager_on_payment(p_invoice_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE 
  v_manager_id uuid;
  v_invoice_status text;
  v_balance_due numeric;
BEGIN
  -- Verify invoice details
  SELECT manager_user_id, status, balance_due 
  INTO v_manager_id, v_invoice_status, v_balance_due
  FROM public.manager_invoices WHERE id = p_invoice_id;

  IF v_manager_id IS NULL THEN 
    RETURN; 
  END IF;

  -- Caller authorization: Service role, Webhost, or the Manager themselves
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF auth.uid() != v_manager_id AND NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
    ) THEN
      RAISE EXCEPTION 'Unauthorized to reinstate manager account for invoice %', p_invoice_id USING ERRCODE = '42501';
    END IF;
  END IF;

  -- FINANCIAL GUARANTEE: Only reinstate if invoice is actually paid
  IF v_invoice_status != 'paid' AND COALESCE(v_balance_due, 1) > 0 THEN
    RAISE EXCEPTION 'Cannot reinstate manager: Invoice % is unpaid (status: %)', p_invoice_id, v_invoice_status 
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.manager_profiles
    WHERE manager_user_id = v_manager_id
      AND status = 'suspended_nonpayment'
  ) THEN
    UPDATE public.manager_profiles
    SET status = 'approved', suspension_reason = NULL
    WHERE manager_user_id = v_manager_id;

    UPDATE public.user_roles
    SET approval_status = 'approved'
    WHERE user_id = v_manager_id AND role = 'manager';

    INSERT INTO public.billing_events (event_type, client_type, client_user_id, invoice_id, notes)
    VALUES ('account_reinstated', 'manager', v_manager_id, p_invoice_id, 'Reinstated after payment');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reinstate_manager_on_payment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reinstate_manager_on_payment TO authenticated, service_role;


-- 9. create_account_activation
CREATE OR REPLACE FUNCTION public.create_account_activation(
  p_user_id uuid,
  p_token text,
  p_expires_at timestamptz DEFAULT now() + interval '24 hours'
) 
RETURNS uuid 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_activation_id uuid;
BEGIN
  -- Caller authorization: Service role, Webhost, or the user creating token for themselves
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF auth.uid() != p_user_id AND NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot create activation token for user %', p_user_id USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.account_activations (user_id, token, expires_at)
  VALUES (p_user_id, p_token, p_expires_at)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_activation_id;

  RETURN v_activation_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_account_activation FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_account_activation TO service_role, authenticated;


-- ══════════════════════════════════════════════════════════════
-- SECTION 4: Operational Data Modification Functions
-- ══════════════════════════════════════════════════════════════

-- 10. sync_tenant_payment_details
CREATE OR REPLACE FUNCTION public.sync_tenant_payment_details(
  p_tenant_id uuid,
  p_manager_id uuid,
  p_property_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL,
  p_monthly_rent numeric DEFAULT NULL,
  p_house_deposit numeric DEFAULT NULL,
  p_water_deposit numeric DEFAULT NULL,
  p_other_charges numeric DEFAULT NULL,
  p_other_charges_desc text DEFAULT NULL,
  p_payment_day integer DEFAULT 1,
  p_paybill text DEFAULT NULL,
  p_account_ref text DEFAULT NULL,
  p_tenancy_type text DEFAULT 'standard'
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF p_manager_id != auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.manager_submanagers WHERE submanager_user_id = auth.uid() AND manager_id = p_manager_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Manager mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.tenants
  SET
    manager_id        = p_manager_id,
    property_id       = COALESCE(p_property_id, property_id),
    unit_id           = COALESCE(p_unit_id, unit_id),
    monthly_rent      = COALESCE(p_monthly_rent, monthly_rent),
    house_deposit     = COALESCE(p_house_deposit, house_deposit),
    water_deposit     = COALESCE(p_water_deposit, water_deposit),
    other_charges     = COALESCE(p_other_charges, other_charges),
    other_charges_desc= COALESCE(p_other_charges_desc, other_charges_desc),
    payment_day       = COALESCE(p_payment_day, payment_day),
    paybill           = COALESCE(p_paybill, paybill),
    account_ref       = COALESCE(p_account_ref, account_ref),
    tenancy_type      = COALESCE(p_tenancy_type, tenancy_type),
    updated_at        = now()
  WHERE id = p_tenant_id AND manager_id = p_manager_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_tenant_payment_details FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_tenant_payment_details TO authenticated, service_role;


-- 11. refresh_manager_stats
CREATE OR REPLACE FUNCTION public.refresh_manager_stats(p_manager_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
    END IF;

    IF p_manager_id != auth.uid() 
       AND NOT EXISTS (
         SELECT 1 FROM public.manager_submanagers 
         WHERE submanager_user_id = auth.uid() AND manager_id = p_manager_id
       ) 
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles 
         WHERE user_id = auth.uid() AND role IN ('webhost', 'platform_admin')
       ) THEN
      RAISE EXCEPTION 'Unauthorized: Manager mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.manager_profiles
  SET
    property_count = (SELECT COUNT(*) FROM public.properties WHERE manager_id = p_manager_id),
    unit_count     = (SELECT COUNT(*) FROM public.units u JOIN public.properties p ON p.id = u.property_id WHERE p.manager_id = p_manager_id),
    tenant_count   = (SELECT COUNT(*) FROM public.tenants WHERE manager_id = p_manager_id AND status = 'active'),
    last_active_at = now(),
    updated_at     = now()
  WHERE manager_user_id = p_manager_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_manager_stats FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_manager_stats TO authenticated, service_role;
