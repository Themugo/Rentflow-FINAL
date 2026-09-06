-- ============================================================
-- Role firewall hardening
-- ============================================================
-- Fixes remaining drift after the role realignment:
--   - Agency users can be created by auth bootstrap.
--   - Webhost platform stats expose unit/property aggregates only, never tenant counts.
--   - Landlord revenue summaries are exposed through a checked function instead of
--     a broadly granted view over tenant/payment tables.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'manager');
  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email
  );

  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    v_full_name,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'phone', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  IF v_role IN ('manager', 'tenant', 'webhost', 'submanager', 'landlord', 'agency') THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id, approval_status)
    VALUES (
      NEW.id,
      v_role::public.app_role,
      NULL,
      CASE WHEN v_role IN ('manager', 'agency') THEN 'pending' ELSE 'approved' END
    )
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace the old helper view that included linked/orphan tenant counts.
DROP VIEW IF EXISTS public.webhost_platform_stats;
CREATE VIEW public.webhost_platform_stats AS
WITH authorized AS (
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'webhost'
  ) AS ok
)
SELECT
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'manager') AS total_managers,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'agency') AS total_agencies,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'manager' AND approval_status = 'pending') AS pending_managers,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'agency' AND approval_status = 'pending') AS pending_agencies,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'manager' AND approval_status = 'approved') AS approved_managers,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'agency' AND approval_status = 'approved') AS approved_agencies,
  (SELECT COUNT(*) FROM public.properties WHERE COALESCE(status, 'active') != 'inactive') AS total_properties,
  (SELECT COUNT(*) FROM public.units WHERE COALESCE(status, 'active') != 'inactive') AS total_units,
  (SELECT COUNT(*) FROM public.units WHERE status = 'occupied') AS occupied_units,
  (SELECT COUNT(*) FROM public.property_landlords WHERE manager_id IS NULL) AS unlinked_landlords,
  (SELECT COUNT(*) FROM public.manager_invoices WHERE status = 'pending') AS pending_invoices,
  (SELECT COUNT(*) FROM public.manager_invoices WHERE status = 'overdue') AS overdue_invoices,
  (SELECT COALESCE(SUM(amount), 0) FROM public.manager_invoices WHERE status = 'paid'
   AND paid_date >= date_trunc('month', now())) AS revenue_this_month
FROM authorized
WHERE ok;

GRANT SELECT ON public.webhost_platform_stats TO authenticated;
COMMENT ON VIEW public.webhost_platform_stats IS
  'Webhost-safe platform aggregates. Excludes tenant counts and tenant personal data.';

-- The previous landlord_tenant_summary view was non-PII, but it was still a
-- broadly granted view over tenant/payment tables. Replace it with a checked
-- function that only returns rows for properties linked to the current landlord.
DROP VIEW IF EXISTS public.landlord_tenant_summary;

CREATE OR REPLACE FUNCTION public.get_landlord_property_revenue_summary(p_property_id uuid DEFAULT NULL)
RETURNS TABLE (
  unit_id uuid,
  lease_start date,
  monthly_rent numeric,
  status text,
  property_id uuid,
  unit_number text,
  address text,
  total_paid numeric,
  payment_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.unit_id,
    t.move_in_date AS lease_start,
    t.monthly_rent,
    t.status,
    u.property_id,
    u.unit_number,
    p.address,
    COALESCE((
      SELECT SUM(pt.amount)
      FROM public.payment_transactions pt
      WHERE pt.invoice_id IN (
        SELECT i.id FROM public.invoices i WHERE i.tenant_id = t.id
      )
      AND pt.status = 'completed'
    ), 0) AS total_paid,
    COALESCE((
      SELECT COUNT(*)
      FROM public.payment_transactions pt
      WHERE pt.invoice_id IN (
        SELECT i.id FROM public.invoices i WHERE i.tenant_id = t.id
      )
      AND pt.status = 'completed'
    ), 0) AS payment_count
  FROM public.tenants t
  JOIN public.units u ON u.id = t.unit_id
  JOIN public.properties p ON p.id = u.property_id
  JOIN public.property_landlords pl ON pl.property_id = p.id
  WHERE pl.landlord_user_id = auth.uid()
    AND (p_property_id IS NULL OR p.id = p_property_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_landlord_property_revenue_summary(uuid) TO authenticated;
COMMENT ON FUNCTION public.get_landlord_property_revenue_summary(uuid) IS
  'Landlord-only revenue summary. Returns unit/payment aggregates for linked properties without tenant PII.';

-- Keep the existing function name/signature, but prevent it from deriving
-- webhost-visible landlord revenue from tenant/payment tables.
CREATE OR REPLACE FUNCTION public.get_webhost_landlords()
RETURNS TABLE (
  landlord_user_id uuid,
  property_count bigint,
  total_revenue numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pl.landlord_user_id,
    COUNT(DISTINCT pl.property_id) AS property_count,
    0::numeric AS total_revenue
  FROM public.property_landlords pl
  WHERE pl.manager_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'webhost'
    )
  GROUP BY pl.landlord_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_webhost_landlords() TO authenticated;
COMMENT ON FUNCTION public.get_webhost_landlords() IS
  'Webhost-visible landlords only: manager_id IS NULL. Does not query tenant/payment tables.';
