-- =============================================================================
-- PASTE THIS ENTIRE FILE into SQL Editor AFTER apply-live-p1-rls.sql succeeds.
-- Do NOT paste file paths. SQL only.
-- If tenant_credit_ledger or payment_allocations is missing, 20260819000003
-- will error; still apply 00000 / 00001 / 00004 first (dashboard RPCs).
-- =============================================================================

-- ========== 20260819000000_phase2_landlord_finance_rpc.sql ==========
-- Phase 2: landlord finance/ops without tenant PII.
-- get_landlord_revenue previously ran as invoker, so RLS blocked invoices
-- and payment_transactions for landlords. SECURITY DEFINER + ownership check.

CREATE OR REPLACE FUNCTION public.get_landlord_revenue(
  p_property_id       uuid,
  p_landlord_user_id  uuid,
  p_period_start      date DEFAULT (date_trunc('month', CURRENT_DATE))::date,
  p_period_end        date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  gross_rent_collected  numeric,
  management_fee        numeric,
  net_to_landlord       numeric,
  revenue_share_pct     numeric,
  total_units           bigint,
  occupied_units        bigint,
  occupancy_rate        numeric,
  arrears_total         numeric,
  payout_pending        numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
  END IF;
  IF p_landlord_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.property_landlords
    WHERE property_id = p_property_id AND landlord_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH
  link AS (
    SELECT pl.revenue_share_pct
    FROM public.property_landlords pl
    WHERE pl.property_id = p_property_id AND pl.landlord_user_id = p_landlord_user_id
  ),
  payments AS (
    SELECT COALESCE(SUM(pt.amount), 0) AS collected
    FROM public.payment_transactions pt
    WHERE pt.property_id = p_property_id
      AND pt.status = 'completed'
      AND pt.completed_at::date BETWEEN p_period_start AND p_period_end
  ),
  units AS (
    SELECT
      COUNT(*) FILTER (WHERE u.status IS DISTINCT FROM 'inactive') AS total_u,
      COUNT(*) FILTER (WHERE u.status = 'occupied') AS occupied_u
    FROM public.units u WHERE u.property_id = p_property_id
  ),
  arrears AS (
    SELECT COALESCE(SUM(i.balance_due), 0) AS total_arr
    FROM public.invoices i
    WHERE i.status IN ('pending', 'overdue')
      AND (
        i.property_id = p_property_id
        OR EXISTS (SELECT 1 FROM public.leases l WHERE l.id = i.lease_id AND l.property_id = p_property_id)
      )
  ),
  pending_payouts AS (
    SELECT COALESCE(SUM(pr.amount), 0) AS pending
    FROM public.payout_requests pr
    WHERE pr.property_id = p_property_id
      AND pr.landlord_user_id = p_landlord_user_id
      AND pr.status IN ('pending', 'approved')
  )
  SELECT
    payments.collected,
    ROUND(payments.collected * (1 - link.revenue_share_pct / 100), 2),
    ROUND(payments.collected * link.revenue_share_pct / 100, 2),
    link.revenue_share_pct,
    units.total_u,
    units.occupied_u,
    CASE WHEN units.total_u > 0 THEN ROUND((units.occupied_u::numeric / units.total_u) * 100, 1) ELSE 0 END,
    arrears.total_arr,
    pending_payouts.pending
  FROM payments, link, units, arrears, pending_payouts;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_landlord_revenue(uuid, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_landlord_revenue(uuid, uuid, date, date) TO authenticated, service_role;

-- Portfolio snapshot for the signed-in landlord (no tenant names/emails).
CREATE OR REPLACE FUNCTION public.get_landlord_portfolio_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_start date := date_trunc('month', CURRENT_DATE)::date;
  v_end date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
  END IF;

  SELECT jsonb_build_object(
    'properties', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT
          p.id,
          COALESCE(fin.expected_rent, 0) AS expected_rent,
          COALESCE(fin.collected_rent, 0) AS collected_rent,
          COALESCE(fin.arrears, 0) AS arrears,
          COALESCE(maint.open_count, 0) AS open_maintenance,
          COALESCE(maint.urgent_count, 0) AS urgent_maintenance
        FROM public.property_landlords pl
        JOIN public.properties p ON p.id = pl.property_id
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(i.amount) FILTER (
              WHERE i.due_date BETWEEN v_start AND v_end
            ), 0) AS expected_rent,
            COALESCE((
              SELECT SUM(pt.amount)
              FROM public.payment_transactions pt
              WHERE pt.property_id = p.id
                AND pt.status = 'completed'
                AND pt.completed_at::date BETWEEN v_start AND v_end
            ), 0) AS collected_rent,
            COALESCE(SUM(i.balance_due) FILTER (
              WHERE i.status IN ('pending', 'overdue')
            ), 0) AS arrears
          FROM public.invoices i
          WHERE COALESCE(
            i.property_id,
            (SELECT l.property_id FROM public.leases l WHERE l.id = i.lease_id)
          ) = p.id
        ) fin ON true
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE mr.status IN ('open', 'pending', 'in_progress')) AS open_count,
            COUNT(*) FILTER (
              WHERE mr.status IN ('open', 'pending', 'in_progress')
                AND mr.priority IN ('high', 'urgent')
            ) AS urgent_count
          FROM public.maintenance_requests mr
          WHERE mr.property_id = p.id
             OR mr.property_name = p.name
        ) maint ON true
        WHERE pl.landlord_user_id = v_uid
      ) x
    ), '[]'::jsonb),
    'active_leases', (
      SELECT COUNT(*)
      FROM public.leases l
      JOIN public.property_landlords pl ON pl.property_id = l.property_id AND pl.landlord_user_id = v_uid
      WHERE l.status = 'active'
    ),
    'expiring_leases', (
      SELECT COUNT(*)
      FROM public.leases l
      JOIN public.property_landlords pl ON pl.property_id = l.property_id AND pl.landlord_user_id = v_uid
      WHERE l.status = 'active'
        AND l.end_date IS NOT NULL
        AND l.end_date <= (CURRENT_DATE + INTERVAL '30 days')
    ),
    'activities', COALESCE((
      SELECT jsonb_agg(row_to_json(a))
      FROM (
        SELECT
          mr.id::text AS id,
          'maintenance'::text AS type,
          format(
            'Maintenance (%s) on unit %s',
            COALESCE(mr.priority, 'normal'),
            COALESCE(mr.unit_number, '—')
          ) AS description,
          mr.created_at AS timestamp,
          p.name AS property_name
        FROM public.maintenance_requests mr
        JOIN public.properties p
          ON p.id = COALESCE(mr.property_id, (
            SELECT px.id FROM public.properties px
            JOIN public.property_landlords plx ON plx.property_id = px.id AND plx.landlord_user_id = v_uid
            WHERE px.name = mr.property_name
            LIMIT 1
          ))
        JOIN public.property_landlords pl ON pl.property_id = p.id AND pl.landlord_user_id = v_uid
        WHERE mr.status IN ('open', 'pending', 'in_progress')
        ORDER BY mr.created_at DESC
        LIMIT 8
      ) a
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_landlord_portfolio_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_landlord_portfolio_stats() TO authenticated, service_role;

-- Per-property ops for landlord detail: unit totals, trend, maintenance without titles/tenant PII.
CREATE OR REPLACE FUNCTION public.get_landlord_property_ops(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.property_landlords
    WHERE property_id = p_property_id AND landlord_user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'unit_revenue', COALESCE((
      SELECT jsonb_object_agg(uid, jsonb_build_object('billed', billed, 'collected', collected))
      FROM (
        SELECT
          COALESCE(i.unit_id::text, 'unassigned') AS uid,
          SUM(i.amount) AS billed,
          SUM(COALESCE(i.paid_amount, 0)) AS collected
        FROM public.invoices i
        WHERE i.property_id = p_property_id
          AND i.due_date >= date_trunc('month', CURRENT_DATE)::date
          AND i.due_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
        GROUP BY i.unit_id
      ) s
    ), '{}'::jsonb),
    'trend', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.month)
      FROM (
        SELECT
          to_char(m, 'MM') AS month,
          COALESCE(SUM(i.paid_amount) FILTER (WHERE i.status IN ('paid', 'partially_paid')), 0) AS gross
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS m
        LEFT JOIN public.invoices i
          ON i.property_id = p_property_id
         AND i.due_date >= m::date
         AND i.due_date < (m + INTERVAL '1 month')::date
        GROUP BY m
      ) t
    ), '[]'::jsonb),
    'maintenance', COALESCE((
      SELECT jsonb_agg(row_to_json(m))
      FROM (
        SELECT
          mr.id,
          mr.unit_number,
          mr.unit_id,
          mr.category,
          mr.priority,
          mr.status,
          mr.requested_date,
          mr.completion_date,
          mr.budget,
          mr.deposit_deduction_amount,
          mr.created_at
        FROM public.maintenance_requests mr
        JOIN public.properties p ON p.id = p_property_id
        WHERE mr.property_id = p_property_id OR mr.property_name = p.name
        ORDER BY mr.created_at DESC
        LIMIT 30
      ) m
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_landlord_property_ops(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_landlord_property_ops(uuid) TO authenticated, service_role;

-- ========== 20260819000001_phase3_audit_log_insert.sql ==========
-- Phase 3: audit_logs INSERT must bind to the authenticated caller.
-- Previous WITH CHECK allowed any logged-in user to insert rows for any user_id.

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ========== 20260819000002_phase3_leftover_hardening.sql ==========
-- Phase 3 leftovers:
-- 1. Tenant visibility uses caller_tenant_ids() (auth.uid → user_roles), not email match.
-- 2. profile-photos / company-logos / property-images are private; SELECT is authenticated-only.
-- Invitation claim still binds to the JWT email claim (invitee identity), not tenants.email.

CREATE OR REPLACE FUNCTION public.caller_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role = 'tenant'
    AND tenant_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.caller_tenant_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.caller_tenant_ids() TO authenticated;

DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select"
  ON public.tenants FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      auth.jwt() ->> 'role' = 'service_role' OR
      (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'manager'
        ) AND
        EXISTS (
          SELECT 1 FROM public.units u
          JOIN public.properties p ON u.property_id = p.id
          WHERE u.id = tenants.unit_id AND p.manager_id = auth.uid()
        )
      ) OR
      (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'agency'
        ) AND
        EXISTS (
          SELECT 1 FROM public.units u
          JOIN public.properties p ON u.property_id = p.id
          WHERE u.id = tenants.unit_id AND p.manager_id = auth.uid()
        )
      ) OR
      id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Deposit deductions view policy" ON public.deposit_deductions;
CREATE POLICY "Deposit deductions view policy" ON public.deposit_deductions
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
         OR id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Deposit refunds view policy" ON public.deposit_refunds;
CREATE POLICY "Deposit refunds view policy" ON public.deposit_refunds
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
         OR id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Tenant history view policy" ON public.tenant_history;
CREATE POLICY "Tenant history view policy" ON public.tenant_history
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.tenants
      WHERE manager_id = auth.uid()
         OR unit_id IN (
           SELECT u.id FROM public.units u
           JOIN public.properties p ON u.property_id = p.id
           WHERE p.manager_id = auth.uid()
         )
         OR id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Vacation notices view policy" ON public.vacation_notices;
CREATE POLICY "Vacation notices view policy" ON public.vacation_notices
  FOR SELECT USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "Users manage vacation notices" ON public.vacation_notices;
CREATE POLICY "Users manage vacation notices" ON public.vacation_notices
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "Water meter readings view policy" ON public.water_meter_readings;
CREATE POLICY "Water meter readings view policy" ON public.water_meter_readings
  FOR SELECT USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR unit_id IN (
      SELECT unit_id FROM public.tenants WHERE id IN (SELECT public.caller_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Tenant unit links access policy" ON public.tenant_unit_links;
CREATE POLICY "Tenant unit links access policy" ON public.tenant_unit_links
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "Tenant guarantors access policy" ON public.tenant_guarantors;
CREATE POLICY "Tenant guarantors access policy" ON public.tenant_guarantors
  FOR ALL USING (
    manager_id = auth.uid()
    OR tenant_id IN (SELECT id FROM public.tenants WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "Unit utility meters access policy" ON public.unit_utility_meters;
CREATE POLICY "Unit utility meters access policy" ON public.unit_utility_meters
  FOR ALL USING (
    manager_id = auth.uid()
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR tenant_id IN (SELECT public.caller_tenant_ids())
  );

DROP POLICY IF EXISTS "tenant_invitations_invitee_claim" ON public.tenant_invitations;
CREATE POLICY "tenant_invitations_invitee_claim"
  ON public.tenant_invitations FOR UPDATE
  USING (
    status = 'pending'
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

UPDATE storage.buckets
SET public = false
WHERE id IN ('profile-photos', 'company-logos', 'property-images');

DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "property_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "property_images_authenticated_read" ON storage.objects;

CREATE POLICY "profile_photos_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos');

CREATE POLICY "company_logos_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos');

CREATE POLICY "property_images_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-images' AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('manager', 'submanager', 'agency', 'landlord', 'webhost', 'tenant')
      )
    )
  );

-- ========== 20260819000003_phase4_financial_integrity.sql ==========
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

-- ========== 20260819000004_manager_dashboard_stats_complete.sql ==========
-- Complete get_manager_dashboard_stats so the manager dashboard can load
-- with one round-trip. Uses properties.occupied (the live column) instead of
-- the non-existent occupied_units field that made the previous RPC fail.

CREATE OR REPLACE FUNCTION public.get_manager_dashboard_stats(p_manager_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
  v_end_date DATE := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_prev_start_date DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
  v_expected NUMERIC;
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
      RAISE EXCEPTION 'Unauthorized: Manager ID mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_expected
    FROM invoices
    WHERE manager_id = p_manager_id
      AND due_date >= v_start_date
      AND due_date <= v_end_date;

  IF v_expected = 0 THEN
    SELECT COALESCE(SUM(monthly_rent), 0)
      INTO v_expected
      FROM leases
      WHERE manager_id = p_manager_id AND status = 'active';
  END IF;

  SELECT jsonb_build_object(
    'total_tenants', (
      SELECT COUNT(*) FROM tenants WHERE manager_id = p_manager_id
    ),
    'active_tenants', (
      SELECT COUNT(*) FROM tenants WHERE manager_id = p_manager_id AND status = 'active'
    ),
    'inactive_tenants', (
      SELECT COUNT(*) FROM tenants WHERE manager_id = p_manager_id AND status = 'inactive'
    ),
    'new_tenants_this_month', (
      SELECT COUNT(*) FROM tenants WHERE manager_id = p_manager_id AND created_at >= v_start_date
    ),
    'total_properties', (
      SELECT COUNT(*) FROM properties WHERE manager_id = p_manager_id
    ),
    'total_units', COALESCE((
      SELECT SUM(units) FROM properties WHERE manager_id = p_manager_id
    ), 0),
    'occupied_units', COALESCE((
      SELECT SUM(occupied) FROM properties WHERE manager_id = p_manager_id
    ), 0),
    'revenue_mtd', COALESCE((
      SELECT SUM(amount)
      FROM invoices
      WHERE manager_id = p_manager_id
        AND status = 'paid'
        AND paid_date >= v_start_date
    ), 0),
    'revenue_prev_month', COALESCE((
      SELECT SUM(amount)
      FROM invoices
      WHERE manager_id = p_manager_id
        AND status = 'paid'
        AND paid_date >= v_prev_start_date
        AND paid_date < v_start_date
    ), 0),
    'expected_rent', v_expected,
    'pending_invoices', (
      SELECT COUNT(*) FROM invoices WHERE manager_id = p_manager_id AND status = 'pending'
    ),
    'overdue_invoices', (
      SELECT COUNT(*) FROM invoices WHERE manager_id = p_manager_id AND status = 'overdue'
    ),
    'arrears_total', COALESCE((
      SELECT SUM(balance_due)
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
    ),
    'open_maintenance', (
      SELECT COUNT(*) FROM maintenance_requests
      WHERE manager_id = p_manager_id AND status IN ('open', 'pending', 'in_progress')
    ),
    'urgent_maintenance', (
      SELECT COUNT(*) FROM maintenance_requests
      WHERE manager_id = p_manager_id
        AND status IN ('open', 'pending', 'in_progress')
        AND priority IN ('high', 'urgent')
    ),
    'pending_deposit_refunds', (
      SELECT COUNT(*) FROM deposit_refunds
      WHERE manager_id = p_manager_id AND status = 'pending'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_manager_dashboard_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_dashboard_stats(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_manager_dashboard_stats IS
  'Single-call manager dashboard stats. Occupancy uses properties.occupied.';


SELECT 'get_manager_dashboard_stats' AS fn, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_manager_dashboard_stats'
UNION ALL
SELECT 'get_landlord_portfolio_stats', pg_get_function_identity_arguments(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_landlord_portfolio_stats';

-- ========== 20260819000005_validate_invitation_token_invited_by_text.sql ==========
-- Live PostgREST returned:
--   PGRST: "Returned type text does not match expected type uuid" (column invited_by)
-- tenant_invitations.invited_by is text in base_schema (and in live). A later
-- function declared it uuid. Recreate the RPC so the return type matches the
-- column. Cast keeps this safe if the column is ever migrated to uuid.

DROP FUNCTION IF EXISTS public.validate_invitation_token(text);

CREATE OR REPLACE FUNCTION public.validate_invitation_token(token_value text)
RETURNS TABLE (
  id            uuid,
  email         text,
  tenant_name   text,
  property_id   uuid,
  property_name text,
  unit          text,
  invited_by    text,
  status        text,
  expires_at    timestamptz,
  monthly_rent  numeric,
  house_deposit numeric,
  water_deposit numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.id,
    ti.email,
    ti.tenant_name,
    ti.property_id,
    ti.property_name,
    ti.unit,
    ti.invited_by::text,
    ti.status,
    ti.expires_at,
    ti.monthly_rent,
    ti.house_deposit,
    ti.water_deposit
  FROM public.tenant_invitations ti
  WHERE ti.token = token_value
    AND ti.status = 'pending'
    AND ti.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.validate_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon, authenticated;


-- ========== 20260824000001_tenant_invitation_phase7.sql ==========
-- ============================================================
-- Phase 7 — Tenant invitation + registration hardening
--
-- 1. validate_invitation_token now also returns inviter_name
--    (company_settings.company_name -> profiles.full_name fallback)
--    so the invitation page can show "Invited by: <organization>"
--    without an unauthenticated query against profiles.
--
-- 2. New invitation_token_state(token) classifies a token as
--    'pending' | 'expired' | 'used' | 'invalid' with NO PII, so
--    the UI can show a distinct, honest state for each case.
-- ============================================================

-- 1. Recreate validate_invitation_token with inviter_name.
-- Return type changes, so it must be dropped first (same pattern as
-- 20260819000005).
DROP FUNCTION IF EXISTS public.validate_invitation_token(text);

CREATE OR REPLACE FUNCTION public.validate_invitation_token(token_value text)
RETURNS TABLE (
  id            uuid,
  email         text,
  tenant_name   text,
  phone         text,
  property_id   uuid,
  property_name text,
  unit          text,
  invited_by    text,
  inviter_name  text,
  status        text,
  expires_at    timestamptz,
  monthly_rent  numeric,
  house_deposit numeric,
  water_deposit numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.id,
    ti.email,
    ti.tenant_name,
    ti.phone,
    ti.property_id,
    ti.property_name,
    ti.unit,
    ti.invited_by::text,
    COALESCE(
      (SELECT cs.company_name FROM public.company_settings cs
        WHERE cs.manager_user_id::text = ti.invited_by LIMIT 1),
      (SELECT p.full_name FROM public.profiles p
        WHERE p.id::text = ti.invited_by LIMIT 1),
      'Your property manager'
    ) AS inviter_name,
    ti.status,
    ti.expires_at,
    ti.monthly_rent,
    ti.house_deposit,
    ti.water_deposit
  FROM public.tenant_invitations ti
  WHERE ti.token = token_value
    AND ti.status = 'pending'
    AND ti.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.validate_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon, authenticated;

-- 2. PII-free token classifier. Never returns invitation contents —
-- only enough for the UI to pick the right screen.
CREATE OR REPLACE FUNCTION public.invitation_token_state(token_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.tenant_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.tenant_invitations ti WHERE ti.token = token_value;
  IF NOT FOUND THEN
    RETURN 'invalid';
  END IF;
  IF inv.status = 'pending' AND inv.expires_at > now() THEN
    RETURN 'pending';
  END IF;
  IF inv.status = 'pending' THEN
    RETURN 'expired';
  END IF;
  IF inv.status = 'used' THEN
    RETURN 'used';
  END IF;
  RETURN 'invalid';
END;
$$;

REVOKE ALL ON FUNCTION public.invitation_token_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_token_state(text) TO anon, authenticated;


-- ========== 20260824000002_admin_invitation_phase8.sql ==========
-- ============================================================
-- Phase 8 — Admin invitation flow
--
-- Admin (webhost) access is invitation/authorization controlled.
-- There is NO public admin registration. This migration adds:
--
-- 1. admin_invitations — the invitation lifecycle (secure token,
--    expiry, single-use status) with RLS that keeps rows readable
--    only by webhosts. The acceptance path never touches the table
--    directly; it goes through SECURITY DEFINER RPCs.
--
-- 2. validate_admin_invitation_token(token) — pending + unexpired
--    rows only, returns exactly what the acceptance page needs
--    (email, display name, inviter name). No other PII.
--
-- 3. admin_invitation_token_state(token) — PII-free classifier:
--    'pending' | 'expired' | 'used' | 'revoked' | 'invalid'.
-- ============================================================

-- ── 1. admin_invitations ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  display_name text NOT NULL,
  token        text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'revoked')),
  invited_by   uuid NOT NULL REFERENCES auth.users(id),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '72 hours'),
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_invitations_token  ON public.admin_invitations(token);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_email  ON public.admin_invitations(email);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_status ON public.admin_invitations(status);

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

-- Only webhosts can read invitations (management screens). Nobody else —
-- including the invitee — reads rows directly; acceptance uses the RPCs.
DROP POLICY IF EXISTS "admin_invitations_webhost_select" ON public.admin_invitations;
CREATE POLICY "admin_invitations_webhost_select"
  ON public.admin_invitations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- Only webhosts can insert invitations.
DROP POLICY IF EXISTS "admin_invitations_webhost_insert" ON public.admin_invitations;
CREATE POLICY "admin_invitations_webhost_insert"
  ON public.admin_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- Only webhosts can revoke (update status away from pending).
DROP POLICY IF EXISTS "admin_invitations_webhost_update" ON public.admin_invitations;
CREATE POLICY "admin_invitations_webhost_update"
  ON public.admin_invitations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- ── 2. validate_admin_invitation_token ───────────────────────
-- Returns the invitation for a pending, unexpired token. Inviter name
-- resolved server-side (company_settings → profiles fallback).
CREATE OR REPLACE FUNCTION public.validate_admin_invitation_token(token_value text)
RETURNS TABLE (
  id            uuid,
  email         text,
  display_name  text,
  inviter_name  text,
  status        text,
  expires_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai.id,
    ai.email,
    ai.display_name,
    COALESCE(
      (SELECT cs.company_name FROM public.company_settings cs
        WHERE cs.manager_user_id = ai.invited_by LIMIT 1),
      (SELECT p.full_name FROM public.profiles p
        WHERE p.id = ai.invited_by LIMIT 1),
      'CALQULUS Platform'
    ) AS inviter_name,
    ai.status,
    ai.expires_at
  FROM public.admin_invitations ai
  WHERE ai.token = token_value
    AND ai.status = 'pending'
    AND ai.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.validate_admin_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_admin_invitation_token(text) TO anon, authenticated;

-- ── 3. admin_invitation_token_state ──────────────────────────
-- PII-free classifier so the UI can show the right screen without
-- exposing invitation contents.
CREATE OR REPLACE FUNCTION public.admin_invitation_token_state(token_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.admin_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.admin_invitations ai WHERE ai.token = token_value;
  IF NOT FOUND THEN
    RETURN 'invalid';
  END IF;
  IF inv.status = 'pending' AND inv.expires_at > now() THEN
    RETURN 'pending';
  END IF;
  IF inv.status = 'pending' THEN
    RETURN 'expired';
  END IF;
  IF inv.status = 'used' THEN
    RETURN 'used';
  END IF;
  IF inv.status = 'revoked' THEN
    RETURN 'revoked';
  END IF;
  RETURN 'invalid';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_invitation_token_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_invitation_token_state(text) TO anon, authenticated;


-- ========== 20260824000003_webhost_operator_phase9.sql ==========
-- ============================================================
-- Phase 9 — Secure operator (WebHost) onboarding
--
-- WebHost is NOT public registration. Operators are onboarded only
-- through an authorized invitation. This migration:
--
-- 1. Adds admin_type to admin_invitations so the inviter chooses the
--    operator tier (business | admin) at issuance. 'owner' can never
--    be granted through an invitation — there is exactly one owner.
--
-- 2. Replaces validate_admin_invitation_token to also return the
--    admin_type so the invitee sees the operator tier they are
--    accepting before they set credentials.
--
-- The platform_admins row itself is seeded server-side by the
-- accept-admin-invitation edge function (service role), never by the
-- client.
-- ============================================================

-- ── 1. admin_type on invitations ─────────────────────────────
ALTER TABLE public.admin_invitations
  ADD COLUMN IF NOT EXISTS admin_type text NOT NULL DEFAULT 'admin'
    CHECK (admin_type IN ('business', 'admin'));

-- ── 2. validate_admin_invitation_token returns admin_type ────
DROP FUNCTION IF EXISTS public.validate_admin_invitation_token(text);

CREATE OR REPLACE FUNCTION public.validate_admin_invitation_token(token_value text)
RETURNS TABLE (
  id            uuid,
  email         text,
  display_name  text,
  inviter_name  text,
  admin_type    text,
  status        text,
  expires_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai.id,
    ai.email,
    ai.display_name,
    COALESCE(
      (SELECT cs.company_name FROM public.company_settings cs
        WHERE cs.manager_user_id = ai.invited_by LIMIT 1),
      (SELECT p.full_name FROM public.profiles p
        WHERE p.id = ai.invited_by LIMIT 1),
      'CALQULUS Platform'
    ) AS inviter_name,
    ai.admin_type,
    ai.status,
    ai.expires_at
  FROM public.admin_invitations ai
  WHERE ai.token = token_value
    AND ai.status = 'pending'
    AND ai.expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.validate_admin_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_admin_invitation_token(text) TO anon, authenticated;
-- ========== 20260827000000_platform_authority_system_admin.sql ==========
-- Platform Authority, RBAC, Admin Hierarchy — Webhost -> System Admin
-- delegated hierarchy + unattached-tenant recovery boundary.

ALTER TABLE public.platform_admins
  ADD COLUMN IF NOT EXISTS can_manage_agencies           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_organizations      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_read_unattached_tenants   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_resolve_unattached_tenants boolean NOT NULL DEFAULT false;

ALTER TABLE public.admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_agencies           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_organizations      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_read_unattached_tenants   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_resolve_unattached_tenants boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.unattached_tenants_view AS
SELECT
  t.id            AS tenant_id,
  t.name          AS tenant_name,
  t.email         AS tenant_email,
  t.phone         AS tenant_phone,
  t.manager_id,
  t.property_id,
  t.unit_id,
  t.property      AS property_label,
  t.unit          AS unit_label,
  t.status,
  t.created_at,
  t.updated_at
FROM public.tenants t
WHERE t.manager_id IS NULL
  AND (t.property_id IS NULL OR t.unit_id IS NULL);

ALTER VIEW public.unattached_tenants_view OWNER TO postgres;
REVOKE ALL ON public.unattached_tenants_view FROM PUBLIC;
GRANT SELECT ON public.unattached_tenants_view TO service_role;

CREATE OR REPLACE FUNCTION public.user_is_platform_admin_any()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (
  SELECT 1 FROM public.platform_admins
  WHERE user_id = auth.uid() AND suspended = false
) $$;

REVOKE EXECUTE ON FUNCTION public.user_is_platform_admin_any() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_platform_admin_any() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_unattached_tenants()
RETURNS TABLE (
  tenant_id    uuid,
  tenant_name  text,
  tenant_email text,
  manager_id   uuid,
  property_id  uuid,
  unit_id      uuid,
  property_label text,
  unit_label   text,
  status       text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_is_platform_admin_any() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    u.tenant_id,
    u.tenant_name,
    u.tenant_email,
    u.manager_id,
    u.property_id,
    u.unit_id,
    u.property_label,
    u.unit_label,
    u.status
  FROM public.unattached_tenants_view u
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_unattached_tenants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unattached_tenants() TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_unattached_tenant(
  p_tenant_id uuid,
  p_manager_id uuid,
  p_property_id uuid,
  p_unit_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_may_resolve boolean;
BEGIN
  SELECT
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.suspended = false
        AND pa.admin_type IN ('owner', 'business')
    ) OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.suspended = false
        AND pa.admin_type = 'admin'
        AND pa.can_resolve_unattached_tenants = true
    )
  INTO v_may_resolve;

  IF auth.role() != 'service_role' AND NOT v_may_resolve THEN
    RAISE EXCEPTION 'Unauthorized: only Webhost or permitted System Admin can resolve unattached tenants'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id
      AND t.manager_id IS NULL
      AND (t.property_id IS NULL OR t.unit_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Tenant is not unattached or does not exist' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.tenants
  SET manager_id   = COALESCE(p_manager_id,   manager_id),
      property_id  = COALESCE(p_property_id,  property_id),
      unit_id      = COALESCE(p_unit_id,      unit_id),
      updated_at   = now()
  WHERE id = p_tenant_id;

  INSERT INTO public.activity_logs (
    actor_id, actor_role, actor_email,
    action, entity_type, entity_id, metadata
  )
  VALUES (
    auth.uid(), 'webhost', NULL,
    'unattached_tenant_resolved', 'tenant', p_tenant_id,
    jsonb_build_object(
      'manager_id', p_manager_id,
      'property_id', p_property_id,
      'unit_id', p_unit_id
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_unattached_tenant(uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_unattached_tenant(uuid,uuid,uuid,uuid) TO authenticated;

UPDATE public.platform_admins
   SET can_manage_agencies = true,
       can_manage_landlords = true,
       can_manage_managers = true,
       can_read_unattached_tenants = true,
       can_resolve_unattached_tenants = true
 WHERE admin_type = 'admin'
   AND suspended = false;
