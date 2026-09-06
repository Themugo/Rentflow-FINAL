-- CALQULUS PMS — Unit-first payment reconciliation portal
-- Managers/agencies reconcile by unit; landlords see the same unit truth without tenant PII.

CREATE OR REPLACE FUNCTION public.get_unit_payment_reconciliation(
  p_property_id uuid,
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  unit_id uuid,
  unit_number text,
  unit_status text,
  monthly_rent numeric,
  invoiced_amount numeric,
  paid_amount numeric,
  balance_due numeric,
  overdue_amount numeric,
  invoice_count bigint,
  open_invoice_count bigint,
  payment_count bigint,
  payer_count bigint,
  last_payment_at timestamptz,
  payment_status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH scope AS (
    SELECT p.id, p.manager_id
    FROM public.properties p
    WHERE p.id=p_property_id
      AND (
        p.manager_id=auth.uid()
        OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=auth.uid())
        OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p.id AND pl.landlord_user_id=auth.uid())
      )
  ),
  inv AS (
    SELECT
      i.id,
      COALESCE(i.unit_id,l.unit_id) AS unit_id,
      i.amount,
      COALESCE(i.paid_amount,0) AS paid_amount,
      GREATEST(COALESCE(i.balance_due,i.amount-COALESCE(i.paid_amount,0)),0) AS balance_due,
      i.status,
      i.due_date
    FROM public.invoices i
    LEFT JOIN public.leases l ON l.id=i.lease_id
    JOIN public.units u ON u.id=COALESCE(i.unit_id,l.unit_id)
    JOIN scope s ON s.id=u.property_id
  ),
  alloc AS (
    SELECT
      pa.invoice_id,
      COALESCE(pa.unit_id, inv.unit_id) AS unit_id,
      pa.allocated_amount,
      pt.id AS transaction_id,
      pt.completed_at,
      pa.payer_party_id
    FROM public.payment_allocations pa
    JOIN public.payment_transactions pt ON pt.id=pa.transaction_id AND pt.status='completed'
    JOIN inv ON inv.id=pa.invoice_id
    WHERE COALESCE(pt.completed_at,pt.created_at)::date <= p_as_of
  ),
  inv_totals AS (
    SELECT unit_id,
      COALESCE(SUM(amount),0)::numeric AS invoiced_amount,
      COALESCE(SUM(paid_amount),0)::numeric AS paid_amount,
      COALESCE(SUM(balance_due),0)::numeric AS balance_due,
      COALESCE(SUM(CASE WHEN status='overdue' THEN balance_due ELSE 0 END),0)::numeric AS overdue_amount,
      COUNT(DISTINCT id) AS invoice_count,
      COUNT(DISTINCT id) FILTER (WHERE balance_due>0) AS open_invoice_count
    FROM inv GROUP BY unit_id
  ),
  alloc_totals AS (
    SELECT unit_id, COUNT(DISTINCT transaction_id) AS payment_count,
      COUNT(DISTINCT payer_party_id) FILTER (WHERE payer_party_id IS NOT NULL) AS payer_count,
      MAX(completed_at) AS last_payment_at
    FROM alloc GROUP BY unit_id
  ),
  rows AS (
    SELECT u.id,u.unit_number,u.status,COALESCE(u.monthly_rent,0)::numeric,
      COALESCE(it.invoiced_amount,0),COALESCE(it.paid_amount,0),COALESCE(it.balance_due,0),COALESCE(it.overdue_amount,0),
      COALESCE(it.invoice_count,0),COALESCE(it.open_invoice_count,0),
      COALESCE(at.payment_count,0),COALESCE(at.payer_count,0),at.last_payment_at
    FROM public.units u
    JOIN scope s ON s.id=u.property_id
    LEFT JOIN inv_totals it ON it.unit_id=u.id
    LEFT JOIN alloc_totals at ON at.unit_id=u.id
  )
  SELECT r.*,
    CASE
      WHEN r.invoice_count=0 THEN 'no_billing'
      WHEN r.balance_due<=0 THEN 'paid'
      WHEN r.paid_amount>0 AND r.balance_due>0 THEN 'partially_paid'
      WHEN r.overdue_amount>0 THEN 'overdue'
      ELSE 'pending'
    END AS payment_status
  FROM rows r
  ORDER BY r.unit_number;
$$;
GRANT EXECUTE ON FUNCTION public.get_unit_payment_reconciliation(uuid,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_manager_unit_payment_reconciliation(
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  property_id uuid,
  property_name text,
  unit_id uuid,
  unit_number text,
  unit_status text,
  monthly_rent numeric,
  invoiced_amount numeric,
  paid_amount numeric,
  balance_due numeric,
  overdue_amount numeric,
  invoice_count bigint,
  open_invoice_count bigint,
  payment_count bigint,
  payer_count bigint,
  last_payment_at timestamptz,
  payment_status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id,p.name,r.*
  FROM public.properties p
  JOIN LATERAL public.get_unit_payment_reconciliation(p.id,p_as_of) r ON true
  WHERE p.manager_id=auth.uid()
     OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=auth.uid())
  ORDER BY p.name,r.unit_number;
$$;
GRANT EXECUTE ON FUNCTION public.get_manager_unit_payment_reconciliation(date) TO authenticated;

-- Unit-level drill-down. Managers can see payer attribution; landlords receive the same
-- payment/unit truth but no tenant personal fields.
CREATE OR REPLACE FUNCTION public.get_unit_payment_activity(
  p_unit_id uuid,
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH scope AS (
    SELECT u.id,u.property_id,p.manager_id
    FROM public.units u JOIN public.properties p ON p.id=u.property_id
    WHERE u.id=p_unit_id
      AND (p.manager_id=auth.uid()
        OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=p.manager_id AND ms.submanager_user_id=auth.uid())
        OR EXISTS (SELECT 1 FROM public.property_landlords pl WHERE pl.property_id=p.id AND pl.landlord_user_id=auth.uid()))
  ),
  allocations AS (
    SELECT
      pa.id AS allocation_id,
      pa.transaction_id,
      pa.invoice_id,
      pa.allocated_amount,
      pt.amount AS transaction_amount,
      pt.payment_method,
      pt.payment_type,
      pt.status AS transaction_status,
      pt.bank_reference,
      pt.mpesa_receipt_number,
      pt.completed_at,
      pt.created_at,
      COALESCE(pp.display_name,'Unattributed payer') AS payer_name,
      pp.party_type AS payer_type,
      i.invoice_number,
      i.due_date,
      i.status AS invoice_status,
      public.resolve_tenant_auth_user(i.tenant_id) AS tenant_auth_user_id
    FROM public.payment_allocations pa
    JOIN public.payment_transactions pt ON pt.id=pa.transaction_id
    JOIN public.invoices i ON i.id=pa.invoice_id
    JOIN scope s ON s.id=COALESCE(pa.unit_id,i.unit_id)
    LEFT JOIN public.payment_parties pp ON pp.id=pa.payer_party_id
    WHERE COALESCE(pa.unit_id,i.unit_id)=p_unit_id
      AND COALESCE(pt.completed_at,pt.created_at)::date <= p_as_of
    ORDER BY COALESCE(pt.completed_at,pt.created_at) DESC,pa.created_at DESC
  ),
  authorized AS (SELECT EXISTS(SELECT 1 FROM scope) AS ok),
  can_see_tenant AS (
    SELECT EXISTS(
      SELECT 1 FROM scope s WHERE s.manager_id=auth.uid()
        OR EXISTS (SELECT 1 FROM public.manager_submanagers ms WHERE ms.manager_id=s.manager_id AND ms.submanager_user_id=auth.uid())
    ) AS allowed
  )
  SELECT jsonb_build_object(
    'unit', COALESCE((SELECT to_jsonb(u) FROM public.units u JOIN scope s ON s.id=u.id), '{}'::jsonb),
    'property', COALESCE((SELECT to_jsonb(p) FROM public.properties p JOIN scope s ON s.id=p.id), '{}'::jsonb),
    'allocations', COALESCE((SELECT jsonb_agg(
      CASE WHEN (SELECT allowed FROM can_see_tenant) THEN
        jsonb_build_object('allocation_id',a.allocation_id,'transaction_id',a.transaction_id,'invoice_id',a.invoice_id,'allocated_amount',a.allocated_amount,'transaction_amount',a.transaction_amount,'payment_method',a.payment_method,'payment_type',a.payment_type,'transaction_status',a.transaction_status,'bank_reference',a.bank_reference,'mpesa_receipt_number',a.mpesa_receipt_number,'completed_at',a.completed_at,'created_at',a.created_at,'payer_name',a.payer_name,'payer_type',a.payer_type,'invoice_number',a.invoice_number,'due_date',a.due_date,'invoice_status',a.invoice_status,'tenant_auth_user_id',a.tenant_auth_user_id)
      ELSE
        jsonb_build_object('allocation_id',a.allocation_id,'transaction_id',a.transaction_id,'invoice_id',a.invoice_id,'allocated_amount',a.allocated_amount,'transaction_amount',a.transaction_amount,'payment_method',a.payment_method,'payment_type',a.payment_type,'transaction_status',a.transaction_status,'bank_reference',a.bank_reference,'mpesa_receipt_number',a.mpesa_receipt_number,'completed_at',a.completed_at,'created_at',a.created_at,'payer_name',a.payer_name,'payer_type',a.payer_type,'invoice_number',a.invoice_number,'due_date',a.due_date,'invoice_status',a.invoice_status)
      END ORDER BY a.completed_at DESC NULLS LAST,a.created_at DESC
    ) FROM allocations a),'[]'::jsonb),
    'authorized',(SELECT ok FROM authorized)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_unit_payment_activity(uuid,date) TO authenticated;

COMMENT ON FUNCTION public.get_unit_payment_reconciliation(uuid,date) IS 'Unit-first reconciliation: billed, collected, balance, overdue, payer count and payment count, independent of whether collection was bulk or individual.';
COMMENT ON FUNCTION public.get_manager_unit_payment_reconciliation(date) IS 'Manager/agency unit-first receivables across the managed portfolio.';
COMMENT ON FUNCTION public.get_unit_payment_activity(uuid,date) IS 'Unit payment drill-down showing every allocation and payer attribution; tenant identity is suppressed for landlords.';
