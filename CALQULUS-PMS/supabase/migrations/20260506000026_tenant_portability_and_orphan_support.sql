-- Tenant Portability & Orphan Support
-- ====================================
-- 1. Drops invoices_lease_id_required constraint so orphans can have invoices
-- 2. Adds tenant_transfer_log for audit trail when tenants move managers
-- 3. Adds source column to tenants to track origin
-- 4. Adds RLS INSERT policy for tenant self-registration
-- 5. Adds RLS UPDATE policy for manager claiming orphan tenants

-- 1. Drop the overly strict constraint — edge functions validate lease_id
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_lease_id_required;

-- 2. Tenant transfer audit log
CREATE TABLE IF NOT EXISTS public.tenant_transfer_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_manager_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transfer_type   text NOT NULL DEFAULT 'manager_to_manager'
    CHECK (transfer_type IN ('self_register', 'manager_claim', 'manager_to_manager', 'orphan_to_manager')),
  transferred_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_transfer_log ENABLE ROW LEVEL SECURITY;

-- Tenant sees their own transfer log
DROP POLICY IF EXISTS "tenant_reads_own_transfers" ON public.tenant_transfer_log;
CREATE POLICY "tenant_reads_own_transfers"
  ON public.tenant_transfer_log FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'tenant'
  ));

-- Manager sees transfers involving them
DROP POLICY IF EXISTS "manager_reads_involved_transfers" ON public.tenant_transfer_log;
CREATE POLICY "manager_reads_involved_transfers"
  ON public.tenant_transfer_log FOR SELECT
  USING (from_manager_id = auth.uid() OR to_manager_id = auth.uid());

-- Service role inserts via edge functions
DROP POLICY IF EXISTS "service_manages_transfer_log" ON public.tenant_transfer_log;
CREATE POLICY "service_manages_transfer_log"
  ON public.tenant_transfer_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Source column on tenants — tracks how the tenant was created
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manager_created'
    CHECK (source IN ('manager_created', 'self_registered', 'imported'));

-- 4. RLS: allow tenant self-registration (manager_id = NULL, source = 'self_registered')
--    Edge function creates user_roles record AFTER the tenant record.
DROP POLICY IF EXISTS "tenant_self_registers" ON public.tenants;
CREATE POLICY "tenant_self_registers"
  ON public.tenants FOR INSERT
  WITH CHECK (
    manager_id IS NULL
    AND source = 'self_registered'
  );

-- 5. RLS: allow manager to claim an orphan tenant (set manager_id from NULL)
DROP POLICY IF EXISTS "manager_claims_orphan_tenant" ON public.tenants;
CREATE POLICY "manager_claims_orphan_tenant"
  ON public.tenants FOR UPDATE
  USING (
    manager_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = tenants.id AND ur.role = 'tenant'
    )
  )
  WITH CHECK (
    manager_id = auth.uid()
  );

-- 6. RLS: allow orphan tenant to update their own profile fields
DROP POLICY IF EXISTS "orphan_updates_own_profile" ON public.tenants;
CREATE POLICY "orphan_updates_own_profile"
  ON public.tenants FOR UPDATE
  USING (
    manager_id IS NULL
    AND id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
  )
  WITH CHECK (
    manager_id IS NULL
    AND id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
  );
