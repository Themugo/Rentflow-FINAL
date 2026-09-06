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
