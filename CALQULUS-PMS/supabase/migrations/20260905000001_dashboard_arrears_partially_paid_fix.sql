-- Product-wide audit fix: partially_paid invoices were vanishing from every
-- outstanding/arrears total (Manager dashboard RPC, Agency portfolio hook,
-- Units portfolio balances, Property billing tab) because those aggregates
-- only ever summed status = 'overdue'. A partial payment moves an invoice's
-- status to 'partially_paid' while balance_due stays > 0 (see
-- 20260902000004_payment_lifecycle_credit_atomic.sql line ~317), so real
-- money still owed was silently dropped out of every arrears figure the
-- moment a tenant made a partial payment.
--
-- This migration only widens arrears_total's status filter to also include
-- 'partially_paid'. overdue_invoices (the *count* used in "N overdue
-- invoices" copy) intentionally stays scoped to status = 'overdue' only —
-- that is a distinct, correctly-named metric. Every other clause is
-- unchanged from 20260819000004_manager_dashboard_stats_complete.sql.

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
      WHERE manager_id = p_manager_id AND status IN ('overdue', 'partially_paid')
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
  'Single-call manager dashboard stats. Occupancy uses properties.occupied. arrears_total includes partially_paid balances (20260905000001).';
