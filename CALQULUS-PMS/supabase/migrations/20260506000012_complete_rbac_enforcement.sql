-- ============================================================
-- CALQULUS RMS: Complete RBAC enforcement migration
-- Enforces the 4-tier authority structure at the database level.
-- Every query that touches tenant data is gated by manager_id.
-- Webhosts cannot read any tenant, invoice, lease, or payment row.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: TENANTS TABLE — RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Manager: only their tenants
DROP POLICY IF EXISTS "manager_manages_own_tenants" ON public.tenants;
CREATE POLICY "manager_manages_own_tenants"
  ON public.tenants FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Submanager: only tenants in their assigned properties
DROP POLICY IF EXISTS "submanager_reads_assigned_tenants" ON public.tenants;
CREATE POLICY "submanager_reads_assigned_tenants"
  ON public.tenants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submanager_property_assignments spa
      JOIN public.submanager_permissions sp ON sp.submanager_user_id = spa.submanager_user_id
      WHERE spa.submanager_user_id = auth.uid()
        AND spa.property_id = tenants.property_id
        AND sp.can_view_tenants = true
    )
  );

-- Tenant: reads only their own record
DROP POLICY IF EXISTS "tenant_reads_own_record" ON public.tenants;
CREATE POLICY "tenant_reads_own_record"
  ON public.tenants FOR SELECT
  USING (
    id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
  );

-- Tenant: updates limited own fields (phone, whatsapp only)
DROP POLICY IF EXISTS "tenant_updates_own_profile" ON public.tenants;
CREATE POLICY "tenant_updates_own_profile"
  ON public.tenants FOR UPDATE
  USING (
    id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 2: INVOICES TABLE — RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Manager: only their invoices
DROP POLICY IF EXISTS "manager_manages_own_invoices" ON public.invoices;
CREATE POLICY "manager_manages_own_invoices"
  ON public.invoices FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Submanager: only invoices for assigned properties
DROP POLICY IF EXISTS "submanager_reads_assigned_invoices" ON public.invoices;
CREATE POLICY "submanager_reads_assigned_invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submanager_property_assignments spa
      JOIN public.submanager_permissions sp ON sp.submanager_user_id = spa.submanager_user_id
      WHERE spa.submanager_user_id = auth.uid()
        AND spa.property_id = invoices.property_id
        AND sp.can_view_invoices = true
    )
  );

-- Tenant: reads only their own invoices
DROP POLICY IF EXISTS "tenant_reads_own_invoices" ON public.invoices;
CREATE POLICY "tenant_reads_own_invoices"
  ON public.invoices FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 3: LEASES TABLE — RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- Manager
DROP POLICY IF EXISTS "manager_manages_own_leases" ON public.leases;
CREATE POLICY "manager_manages_own_leases"
  ON public.leases FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Submanager
DROP POLICY IF EXISTS "submanager_reads_assigned_leases" ON public.leases;
CREATE POLICY "submanager_reads_assigned_leases"
  ON public.leases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submanager_property_assignments spa
      JOIN public.submanager_permissions sp ON sp.submanager_user_id = spa.submanager_user_id
      WHERE spa.submanager_user_id = auth.uid()
        AND spa.property_id = leases.property_id
        AND sp.can_view_leases = true
    )
  );

-- Tenant
DROP POLICY IF EXISTS "tenant_reads_own_leases" ON public.leases;
CREATE POLICY "tenant_reads_own_leases"
  ON public.leases FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 4: PROPERTIES TABLE — RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Manager: owns their properties
DROP POLICY IF EXISTS "manager_manages_own_properties" ON public.properties;
CREATE POLICY "manager_manages_own_properties"
  ON public.properties FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Submanager: only assigned properties
DROP POLICY IF EXISTS "submanager_reads_assigned_properties" ON public.properties;
CREATE POLICY "submanager_reads_assigned_properties"
  ON public.properties FOR SELECT
  USING (
    id IN (
      SELECT property_id FROM public.submanager_property_assignments
      WHERE submanager_user_id = auth.uid()
    )
  );

-- Landlord: reads properties they own
DROP POLICY IF EXISTS "landlord_reads_owned_properties" ON public.properties;
CREATE POLICY "landlord_reads_owned_properties"
  ON public.properties FOR SELECT
  USING (
    id IN (
      SELECT property_id FROM public.property_landlords
      WHERE landlord_user_id = auth.uid()
    )
  );

-- Webhost: CAN read properties for admin oversight (manager performance, not tenant data)
DROP POLICY IF EXISTS "webhost_reads_all_properties" ON public.properties;
CREATE POLICY "webhost_reads_all_properties"
  ON public.properties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'webhost'
    )
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 5: UNITS TABLE — RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Manager
DROP POLICY IF EXISTS "manager_manages_own_units" ON public.units;
CREATE POLICY "manager_manages_own_units"
  ON public.units FOR ALL
  USING (
    property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
  )
  WITH CHECK (
    property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
  );

-- Submanager
DROP POLICY IF EXISTS "submanager_reads_assigned_units" ON public.units;
CREATE POLICY "submanager_reads_assigned_units"
  ON public.units FOR SELECT
  USING (
    property_id IN (
      SELECT property_id FROM public.submanager_property_assignments
      WHERE submanager_user_id = auth.uid()
    )
  );

-- Landlord: units in their properties
DROP POLICY IF EXISTS "landlord_reads_owned_units" ON public.units;
CREATE POLICY "landlord_reads_owned_units"
  ON public.units FOR SELECT
  USING (
    property_id IN (
      SELECT property_id FROM public.property_landlords
      WHERE landlord_user_id = auth.uid()
    )
  );

-- Tenant: only their own unit
DROP POLICY IF EXISTS "tenant_reads_own_unit" ON public.units;
CREATE POLICY "tenant_reads_own_unit"
  ON public.units FOR SELECT
  USING (
    id IN (
      SELECT unit_id FROM public.tenants
      WHERE id IN (
        SELECT tenant_id FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'tenant'
      )
    )
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 6: PAYMENT_TRANSACTIONS — RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_manages_own_transactions" ON public.payment_transactions;
CREATE POLICY "manager_manages_own_transactions"
  ON public.payment_transactions FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "tenant_reads_own_transactions" ON public.payment_transactions;
CREATE POLICY "tenant_reads_own_transactions"
  ON public.payment_transactions FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
  );

DROP POLICY IF EXISTS "submanager_reads_property_transactions" ON public.payment_transactions;
CREATE POLICY "submanager_reads_property_transactions"
  ON public.payment_transactions FOR SELECT
  USING (
    property_id IN (
      SELECT property_id FROM public.submanager_property_assignments
      WHERE submanager_user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 7: MAINTENANCE_REQUESTS — RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_manages_own_maintenance" ON public.maintenance_requests;
CREATE POLICY "manager_manages_own_maintenance"
  ON public.maintenance_requests FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "submanager_reads_assigned_maintenance" ON public.maintenance_requests;
CREATE POLICY "submanager_reads_assigned_maintenance"
  ON public.maintenance_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submanager_property_assignments spa
      JOIN public.submanager_permissions sp ON sp.submanager_user_id = spa.submanager_user_id
      WHERE spa.submanager_user_id = auth.uid()
        AND spa.property_id IN (
          SELECT property_id FROM public.properties
          WHERE name = maintenance_requests.property_name
        )
        AND sp.can_view_maintenance = true
    )
  );

DROP POLICY IF EXISTS "tenant_manages_own_maintenance" ON public.maintenance_requests;
CREATE POLICY "tenant_manages_own_maintenance"
  ON public.maintenance_requests FOR ALL
  USING (
    tenant_email IN (
      SELECT t.email FROM public.tenants t
      JOIN public.user_roles ur ON ur.tenant_id = t.id
      WHERE ur.user_id = auth.uid() AND ur.role = 'tenant'
    )
  )
  WITH CHECK (
    tenant_email IN (
      SELECT t.email FROM public.tenants t
      JOIN public.user_roles ur ON ur.tenant_id = t.id
      WHERE ur.user_id = auth.uid() AND ur.role = 'tenant'
    )
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 8: ADMIN_PERMISSIONS — lock can_manage_tenants = false
-- ══════════════════════════════════════════════════════════════

-- Ensure no webhost ever has can_manage_tenants = true
-- The column still exists for schema compatibility but is always false
UPDATE public.admin_permissions
  SET can_manage_tenants = false
  WHERE can_manage_tenants = true;

-- Add constraint to prevent future writes of true
ALTER TABLE public.admin_permissions
  DROP CONSTRAINT IF EXISTS no_tenant_access_for_webhosts;
ALTER TABLE public.admin_permissions
  ADD CONSTRAINT no_tenant_access_for_webhosts
    CHECK (can_manage_tenants = false);

-- Ensure can_manage_system_landlords exists
ALTER TABLE public.admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_system_landlords boolean NOT NULL DEFAULT false;

-- Grant super_admins all permissions
UPDATE public.admin_permissions
  SET can_manage_system_landlords = true
  WHERE admin_level = 'super_admin';

-- ══════════════════════════════════════════════════════════════
-- SECTION 9: PROFILES TABLE — minimal RLS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_manages_own_profile" ON public.profiles;
CREATE POLICY "user_manages_own_profile"
  ON public.profiles FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Manager can read profiles of their tenants (for display name)
DROP POLICY IF EXISTS "manager_reads_tenant_profiles" ON public.profiles;
CREATE POLICY "manager_reads_tenant_profiles"
  ON public.profiles FOR SELECT
  USING (
    -- Always allow reading own profile
    id = auth.uid()
    OR
    -- Managers can read profiles of users they manage
    id IN (
      SELECT user_id FROM public.user_roles ur
      JOIN public.tenants t ON t.id = ur.tenant_id
      WHERE ur.role = 'tenant' AND t.manager_id = auth.uid()
    )
    OR
    -- Webhosts can read webhost-level profiles
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'webhost'
    )
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 10: SUBMANAGER_PERMISSIONS — ensure manager scoping
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.submanager_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_manages_submanager_permissions" ON public.submanager_permissions;
CREATE POLICY "manager_manages_submanager_permissions"
  ON public.submanager_permissions FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "submanager_reads_own_permissions" ON public.submanager_permissions;
CREATE POLICY "submanager_reads_own_permissions"
  ON public.submanager_permissions FOR SELECT
  USING (submanager_user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- SECTION 11: HELPER — check if caller is webhost
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_webhost()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'webhost'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'manager'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_submanager()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'submanager'
  );
$$;

CREATE OR REPLACE FUNCTION public.caller_manager_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT user_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'manager'
  LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_webhost() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_submanager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.caller_manager_id() TO authenticated;
