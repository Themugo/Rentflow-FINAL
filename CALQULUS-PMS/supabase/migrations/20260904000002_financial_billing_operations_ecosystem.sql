-- CALQULUS PMS — Financial & Billing Operations Ecosystem
-- One coherent financial truth layer over invoices, payments, allocations,
-- credits, expenditures and landlord ownership.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_period_start date,
  ADD COLUMN IF NOT EXISTS billing_period_end date;

CREATE INDEX IF NOT EXISTS invoices_manager_due_idx
  ON public.invoices(manager_id, due_date, status);
CREATE INDEX IF NOT EXISTS invoices_lease_period_idx
  ON public.invoices(lease_id, billing_period_start, billing_period_end)
  WHERE lease_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_allocations_invoice_idx
  ON public.payment_allocations(invoice_id, created_at);

-- ---------------------------------------------------------------------------
-- Derived append-only financial ledger.
-- Nothing in this view overwrites history: invoice issuance, payment allocation,
-- credit and expenditure events remain traceable to their source records.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.financial_ledger AS
SELECT
  i.id AS source_id,
  'invoice'::text AS event_type,
  i.created_at AS event_at,
  i.manager_id,
  i.property_id,
  i.unit_id,
  i.tenant_id,
  i.id AS invoice_id,
  NULL::uuid AS transaction_id,
  i.invoice_number AS reference,
  COALESCE(i.original_amount, i.amount)::numeric(14,2) AS debit,
  0::numeric(14,2) AS credit,
  COALESCE(i.original_amount, i.amount)::numeric(14,2) AS amount,
  COALESCE(i.invoice_type, 'other') AS category,
  i.description
FROM public.invoices i
WHERE i.status <> 'cancelled'
UNION ALL
SELECT
  pa.id,
  'payment_allocation',
  pa.created_at,
  pa.manager_id,
  pt.property_id,
  pt.unit_id,
  pa.tenant_id,
  pa.invoice_id,
  pa.transaction_id,
  COALESCE(pt.bank_reference, pt.mpesa_receipt_number, pt.id::text),
  0::numeric(14,2),
  pa.allocated_amount::numeric(14,2),
  pa.allocated_amount::numeric(14,2),
  'payment',
  'Payment allocated to invoice'
FROM public.payment_allocations pa
JOIN public.payment_transactions pt ON pt.id = pa.transaction_id
WHERE pt.status = 'completed'
UNION ALL
SELECT
  t.id,
  'payment_credit',
  t.created_at,
  t.manager_id,
  t.property_id,
  t.unit_id,
  t.tenant_id,
  NULL::uuid,
  t.id,
  COALESCE(t.bank_reference, t.mpesa_receipt_number, t.id::text),
  0::numeric(14,2),
  COALESCE(t.credit_amount, 0)::numeric(14,2),
  COALESCE(t.credit_amount, 0)::numeric(14,2),
  'credit',
  'Advance payment held as tenant credit'
FROM public.payment_transactions t
WHERE t.status = 'completed' AND COALESCE(t.credit_amount, 0) > 0
UNION ALL
SELECT
  e.id,
  'expenditure',
  e.created_at,
  e.manager_id,
  e.property_id,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  NULL::uuid,
  e.id::text,
  e.amount::numeric(14,2),
  0::numeric(14,2),
  e.amount::numeric(14,2),
  e.category,
  e.description
FROM public.expenditures e;

-- ---------------------------------------------------------------------------
-- Canonical monthly rent generation.
-- Service-role only so scheduled jobs and UI cannot create competing invoices.
-- Prorates leases that begin/end inside the billing period.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_rent_invoices_atomic(
  p_period_start date,
  p_period_end date,
  p_manager_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_manager uuid;
  v_days numeric;
  v_overlap_days numeric;
  v_amount numeric;
  v_due_date date;
  v_config record;
  v_result jsonb := '[]'::jsonb;
  v_created integer := 0;
  v_existing_count integer := 0;
  v_exists boolean := false;
  v_invoice jsonb;
  v_key text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only the billing service may generate rent invoices' USING ERRCODE='42501';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_start > p_period_end THEN
    RAISE EXCEPTION 'Invalid billing period' USING ERRCODE='22023';
  END IF;

  v_days := (p_period_end - p_period_start + 1);

  FOR r IN
    SELECT l.id AS lease_id, l.manager_id, l.tenant_id, l.property_id, l.unit_id,
           l.monthly_rent, l.start_date, l.end_date,
           p.name AS property_name, u.unit_number
    FROM public.leases l
    JOIN public.properties p ON p.id = l.property_id
    LEFT JOIN public.units u ON u.id = l.unit_id
    WHERE l.status = 'active'
      AND l.archived_at IS NULL
      AND l.tenant_id IS NOT NULL
      AND l.property_id IS NOT NULL
      AND l.monthly_rent > 0
      AND l.start_date <= p_period_end
      AND l.end_date >= p_period_start
      AND (p_manager_id IS NULL OR l.manager_id = p_manager_id)
    ORDER BY l.manager_id, l.property_id, l.unit_id, l.id
  LOOP
    v_overlap_days := (LEAST(r.end_date, p_period_end) - GREATEST(r.start_date, p_period_start) + 1);
    v_amount := round((r.monthly_rent * v_overlap_days / v_days), 2);
    IF v_amount <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_config
    FROM public.property_billing_config c
    WHERE c.property_id = r.property_id;

    v_due_date := make_date(
      EXTRACT(YEAR FROM p_period_start)::int,
      EXTRACT(MONTH FROM p_period_start)::int,
      LEAST(COALESCE(v_config.due_day_of_month, 1), EXTRACT(DAY FROM p_period_end)::int)
    );
    IF v_due_date < p_period_start THEN v_due_date := p_period_start; END IF;

    v_key := format('rent:%s:%s:%s', r.lease_id, p_period_start, p_period_end);

    SELECT EXISTS (
      SELECT 1 FROM public.invoices WHERE generation_key = v_key
    ) INTO v_exists;
    IF v_exists THEN
      v_existing_count := v_existing_count + 1;
      CONTINUE;
    END IF;

    v_invoice := public.create_invoice_atomic_v2(
      v_key,
      r.lease_id,
      r.tenant_id,
      r.property_id,
      r.unit_id,
      r.manager_id,
      v_amount,
      format('Rent — %s %s', to_char(p_period_start, 'Mon YYYY'), COALESCE(r.unit_number, 'Unit')),
      v_due_date,
      'rent',
      jsonb_build_array(jsonb_build_object(
        'charge_type','rent',
        'charge_label','Monthly rent',
        'quantity',v_overlap_days,
        'unit_price',round(r.monthly_rent / v_days, 6),
        'amount',v_amount,
        'is_manual',false
      ))
    );

    UPDATE public.invoices
    SET billing_period_start = COALESCE(billing_period_start, p_period_start),
        billing_period_end = COALESCE(billing_period_end, p_period_end),
        updated_at = now()
    WHERE id = (v_invoice->>'id')::uuid;

    IF COALESCE((v_invoice->>'created')::boolean, false) THEN
      v_created := v_created + 1;
    ELSE
      v_existing_count := v_existing_count + 1;
    END IF;
    v_result := v_result || jsonb_build_array(v_invoice || jsonb_build_object(
      'lease_id', r.lease_id,
      'amount', v_amount,
      'billing_period_start', p_period_start,
      'billing_period_end', p_period_end
    ));
  END LOOP;

  RETURN jsonb_build_object('success',true,'created',v_created,'existing',v_existing_count,'period_start',p_period_start,'period_end',p_period_end,'invoices',v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_rent_invoices_atomic(date,date,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_rent_invoices_atomic(date,date,uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Canonical overdue projection. Does not touch paid/cancelled/failed history.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_rent_invoices_overdue_atomic(p_as_of date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only the billing service may mark invoices overdue' USING ERRCODE='42501';
  END IF;
  UPDATE public.invoices
  SET status = 'overdue', updated_at = now()
  WHERE due_date < p_as_of
    AND status IN ('pending','partially_paid')
    AND COALESCE(balance_due, amount) > 0;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_rent_invoices_overdue_atomic(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_rent_invoices_overdue_atomic(date) TO service_role;

-- ---------------------------------------------------------------------------
-- Tenant financial truth: invoices + allocated payments + unapplied credit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_financial_position(p_tenant_id uuid)
RETURNS TABLE(
  tenant_id uuid,
  total_invoiced numeric,
  total_paid numeric,
  total_credited numeric,
  outstanding numeric,
  overdue numeric,
  invoice_count bigint,
  open_invoice_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_uid uuid := auth.uid(); v_manager uuid;
BEGIN
  SELECT t.manager_id INTO v_manager FROM public.tenants t WHERE t.id=p_tenant_id;
  IF v_manager IS NULL THEN RAISE EXCEPTION 'Tenant not found' USING ERRCODE='P0002'; END IF;
  IF auth.role() <> 'service_role' AND NOT (
    v_uid = p_tenant_id OR v_uid = v_manager OR EXISTS(
      SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=v_manager AND ms.submanager_user_id=v_uid
    )
  ) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;

  RETURN QUERY
  WITH inv AS (
    SELECT COALESCE(SUM(COALESCE(i.original_amount,i.amount)),0) total,
           COALESCE(SUM(COALESCE(i.balance_due,0)) FILTER(WHERE i.status IN ('pending','partially_paid','overdue')),0) open,
           COALESCE(SUM(COALESCE(i.balance_due,0)) FILTER(WHERE i.status='overdue'),0) late,
           COUNT(*) cnt,
           COUNT(*) FILTER(WHERE i.status IN ('pending','partially_paid','overdue')) open_cnt
    FROM public.invoices i WHERE i.tenant_id=p_tenant_id AND i.status <> 'cancelled'
  ),
  pay AS (
    SELECT COALESCE(SUM(pa.allocated_amount),0) paid
    FROM public.payment_allocations pa
    JOIN public.payment_transactions pt ON pt.id=pa.transaction_id
    WHERE pa.tenant_id=p_tenant_id AND pt.status='completed'
  ),
  cred AS (
    SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) credited
    FROM public.tenant_credit_ledger WHERE tenant_id=p_tenant_id
  )
  SELECT p_tenant_id, inv.total, pay.paid, GREATEST(cred.credited,0), GREATEST(inv.open,0), GREATEST(inv.late,0), inv.cnt, inv.open_cnt
  FROM inv,pay,cred;
END;
$$;
REVOKE ALL ON FUNCTION public.get_tenant_financial_position(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_financial_position(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Manager portfolio truth: allocated rent collections, receivables, arrears,
-- credits, expenditures and collection rate. Submanagers inherit manager scope.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_manager_financial_position(
  p_manager_id uuid,
  p_period_start date DEFAULT date_trunc('month',CURRENT_DATE)::date,
  p_period_end date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  manager_id uuid,
  expected numeric,
  collected numeric,
  outstanding numeric,
  overdue numeric,
  credits numeric,
  expenditures numeric,
  net_income numeric,
  collection_rate numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.can_manage_property_scope(p_manager_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH inv AS (
    SELECT COALESCE(SUM(COALESCE(i.original_amount,i.amount)) FILTER(WHERE i.due_date BETWEEN p_period_start AND p_period_end AND i.status<>'cancelled'),0) expected,
           COALESCE(SUM(i.balance_due) FILTER(WHERE i.status IN ('pending','partially_paid','overdue')),0) outstanding,
           COALESCE(SUM(i.balance_due) FILTER(WHERE i.status='overdue'),0) overdue
    FROM public.invoices i WHERE i.manager_id=p_manager_id
  ),
  col AS (
    SELECT COALESCE(SUM(pa.allocated_amount),0) collected
    FROM public.payment_allocations pa
    JOIN public.payment_transactions pt ON pt.id=pa.transaction_id
    WHERE pa.manager_id=p_manager_id AND pt.status='completed'
      AND COALESCE(pt.completed_at::date,pt.created_at::date) BETWEEN p_period_start AND p_period_end
  ),
  cr AS (
    SELECT COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) credits
    FROM public.tenant_credit_ledger WHERE manager_id=p_manager_id
  ),
  ex AS (
    SELECT COALESCE(SUM(amount),0) expenditures
    FROM public.expenditures WHERE manager_id=p_manager_id AND to_date(month,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end
  )
  SELECT p_manager_id, inv.expected, col.collected, inv.outstanding, inv.overdue, GREATEST(cr.credits,0), ex.expenditures,
         round(col.collected-ex.expenditures,2), CASE WHEN inv.expected>0 THEN round(col.collected/inv.expected*100,2) ELSE 0 END
  FROM inv,col,cr,ex;
END;
$$;
REVOKE ALL ON FUNCTION public.get_manager_financial_position(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_financial_position(uuid,date,date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Landlord financial truth: allocated collections tied to owned properties,
-- property expenses, share and net payable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_landlord_financial_position(
  p_landlord_user_id uuid,
  p_period_start date DEFAULT date_trunc('month',CURRENT_DATE)::date,
  p_period_end date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  landlord_user_id uuid,
  expected numeric,
  collected numeric,
  outstanding numeric,
  expenditures numeric,
  gross_income numeric,
  net_to_landlord numeric,
  owner_share_pct numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND p_landlord_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH property_finance AS (
    SELECT
      pl.property_id,
      pl.revenue_share_pct AS share_pct,
      COALESCE((SELECT SUM(COALESCE(i.original_amount,i.amount))
                FROM public.invoices i
                WHERE i.property_id=pl.property_id
                  AND i.due_date BETWEEN p_period_start AND p_period_end
                  AND i.status<>'cancelled'),0) expected,
      COALESCE((SELECT SUM(pa.allocated_amount)
                FROM public.payment_allocations pa
                JOIN public.payment_transactions pt ON pt.id=pa.transaction_id
                WHERE pt.property_id=pl.property_id AND pt.status='completed'
                  AND COALESCE(pt.completed_at::date,pt.created_at::date) BETWEEN p_period_start AND p_period_end),0) collected,
      COALESCE((SELECT SUM(i.balance_due)
                FROM public.invoices i
                WHERE i.property_id=pl.property_id
                  AND i.status IN ('pending','partially_paid','overdue')),0) outstanding,
      COALESCE((SELECT SUM(e.amount)
                FROM public.expenditures e
                WHERE e.property_id=pl.property_id
                  AND to_date(e.month,'YYYY-MM-DD') BETWEEN p_period_start AND p_period_end),0) expenditures
    FROM public.property_landlords pl
    WHERE pl.landlord_user_id=p_landlord_user_id
  )
  SELECT p_landlord_user_id,
         round(COALESCE(SUM(expected),0),2),
         round(COALESCE(SUM(collected),0),2),
         round(COALESCE(SUM(outstanding),0),2),
         round(COALESCE(SUM(expenditures),0),2),
         round(COALESCE(SUM(collected-expenditures),0),2),
         round(COALESCE(SUM((collected-expenditures)*share_pct/100),0),2),
         CASE WHEN COUNT(*)=0 THEN 100 ELSE round(SUM(share_pct*GREATEST(collected-expenditures,0))/NULLIF(SUM(GREATEST(collected-expenditures,0)),0) END
  FROM property_finance;
END;
$$;
REVOKE ALL ON FUNCTION public.get_landlord_financial_position(uuid,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_landlord_financial_position(uuid,date,date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Financial reconciliation audit: reports inconsistencies without silently
-- rewriting financial history.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_financial_integrity()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_manager uuid;
  v_result jsonb;
BEGIN
  IF auth.role() = 'service_role' THEN
    v_manager := NULL;
  ELSE
    SELECT CASE WHEN EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='manager') THEN v_uid ELSE (
      SELECT manager_id FROM public.manager_submanagers WHERE submanager_user_id=v_uid LIMIT 1) END INTO v_manager;
    IF v_manager IS NULL THEN RAISE EXCEPTION 'Manager scope required' USING ERRCODE='42501'; END IF;
  END IF;

  SELECT jsonb_build_object(
    'invoice_balance_mismatches', COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE (v_manager IS NULL OR i.manager_id=v_manager) AND i.status NOT IN ('cancelled','refunded') AND round(COALESCE(i.balance_due,0),2) <> round(GREATEST(COALESCE(i.amount,0)-COALESCE(i.paid_amount,0),0),2)),0),
    'allocation_over_invoice', COALESCE((SELECT COUNT(*) FROM (SELECT pa.invoice_id, SUM(pa.allocated_amount) allocated, MAX(COALESCE(i.amount,0)) amount FROM public.payment_allocations pa JOIN public.invoices i ON i.id=pa.invoice_id WHERE (v_manager IS NULL OR pa.manager_id=v_manager) GROUP BY pa.invoice_id HAVING SUM(pa.allocated_amount) > MAX(COALESCE(i.amount,0)) + 0.01) x),0),
    'completed_payments_with_negative_amount', COALESCE((SELECT COUNT(*) FROM public.payment_transactions WHERE (v_manager IS NULL OR manager_id=v_manager) AND status='completed' AND amount <= 0),0),
    'credit_ledger_negative_running_balance', COALESCE((SELECT COUNT(*) FROM public.tenant_credit_ledger WHERE (v_manager IS NULL OR manager_id=v_manager) AND balance_after < 0),0),
    'status', CASE WHEN (
      COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE (v_manager IS NULL OR i.manager_id=v_manager) AND i.status NOT IN ('cancelled','refunded') AND round(COALESCE(i.balance_due,0),2) <> round(GREATEST(COALESCE(i.amount,0)-COALESCE(i.paid_amount,0),0),2)),0)
      + COALESCE((SELECT COUNT(*) FROM public.payment_transactions WHERE (v_manager IS NULL OR manager_id=v_manager) AND status='completed' AND amount <= 0),0)
    ) = 0 THEN 'PASS' ELSE 'REVIEW' END
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_financial_integrity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_financial_integrity() TO authenticated, service_role;

COMMENT ON VIEW public.financial_ledger IS 'Derived, append-only financial truth across invoice issuance, payment allocation, tenant credit and expenditure events.';
