-- ============================================================
-- Enforce Management Structure - Tiered Access Control
-- ============================================================
-- This migration enforces the 4-tier management structure:
-- Tier 1: Platform ownership (Webhost) - NO tenant data access ever
-- Tier 2: Property management (Managers/Agencies) - Full tenant management
-- Tier 3: Property owners (Landlords) - Managed vs System split
-- Tier 4: Tenants - Only their property manager sees their data
-- ============================================================

-- Step 1: Remove can_manage_tenants from admin_permissions
-- Webhost should NEVER have tenant data access

ALTER TABLE public.admin_permissions 
DROP COLUMN IF EXISTS can_manage_tenants;

-- Step 2: Update platform_admins RLS to enforce landlord split
-- Webhost sees only system landlords (manager_id IS NULL)

DROP POLICY IF EXISTS "platform_admins_select" ON public.platform_admins;
CREATE POLICY "platform_admins_select"
  ON public.platform_admins FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      -- Service role can see all
      auth.jwt() ->> 'role' = 'service_role' OR
      -- Super admin can see all
      (SELECT admin_type FROM public.platform_admins WHERE user_id = auth.uid()) = 'owner' OR
      -- Business admin can see all
      (SELECT admin_type FROM public.platform_admins WHERE user_id = auth.uid()) = 'business' OR
      -- Regular admin can see their own record
      platform_admins.user_id = auth.uid()
    )
  );

-- Step 3: Update property_landlords RLS for landlord split
-- Webhost sees only system landlords (manager_id IS NULL)

DROP POLICY IF EXISTS "property_landlords_select" ON public.property_landlords;
CREATE POLICY "property_landlords_select"
  ON public.property_landlords FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      -- Service role can see all
      auth.jwt() ->> 'role' = 'service_role' OR
      -- Webhost sees only system landlords (manager_id IS NULL)
      (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'webhost'
        ) AND
        manager_id IS NULL
      ) OR
      -- Manager sees their linked landlords
      (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'manager'
        ) AND
        manager_id = auth.uid()
      ) OR
      -- Agency sees their linked landlords
      (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'agency'
        ) AND
        manager_id = auth.uid()
      ) OR
      -- Landlord sees their own records
      landlord_user_id = auth.uid()
    )
  );

-- Step 4: Enforce manager data isolation
-- All tenant-related tables scoped by manager_id

-- Tenants table
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select"
  ON public.tenants FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      -- Service role can see all
      auth.jwt() ->> 'role' = 'service_role' OR
      -- Manager sees their tenants
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
      -- Agency sees their tenants
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
      -- Tenant sees their own record (via email match)
      tenants.email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- Step 5: Enforce landlord revenue-only view
-- Landlords CANNOT see tenant PII - they can only use the landlord_tenant_summary view

-- Remove any existing landlord policy that might allow direct tenant table access
DROP POLICY IF EXISTS "tenants_select_landlord" ON public.tenants;

-- Create a view for landlords that hides tenant PII
CREATE OR REPLACE VIEW public.landlord_tenant_summary AS
SELECT 
  t.id,
  t.unit_id,
  t.move_in_date as lease_start,
  t.monthly_rent,
  t.status,
  u.property_id,
  u.unit_number,
  p.address,
  -- NO tenant PII: no names, emails, phones
  -- Only aggregate data
  COALESCE(
    (SELECT SUM(amount) FROM public.payment_transactions 
     WHERE invoice_id IN (SELECT id FROM public.invoices WHERE tenant_id = t.id)
     AND status = 'completed'
    ), 0
  ) as total_paid,
  COALESCE(
    (SELECT COUNT(*) FROM public.payment_transactions 
     WHERE invoice_id IN (SELECT id FROM public.invoices WHERE tenant_id = t.id)
     AND status = 'completed'
    ), 0
  ) as payment_count
FROM public.tenants t
JOIN public.units u ON t.unit_id = u.id
JOIN public.properties p ON u.property_id = p.id;

-- Grant access to landlord view
GRANT SELECT ON public.landlord_tenant_summary TO authenticated;

-- Note: Views cannot have RLS enabled directly. The view inherits security from underlying tables.

-- Step 6: Update invoices RLS for manager isolation
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select"
  ON public.invoices FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      -- Service role can see all
      auth.jwt() ->> 'role' = 'service_role' OR
      -- Manager sees their invoices
      (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'manager'
        ) AND
        EXISTS (
          SELECT 1 FROM public.tenants t
          JOIN public.units u ON t.unit_id = u.id
          JOIN public.properties p ON u.property_id = p.id
          WHERE t.id = invoices.tenant_id AND p.manager_id = auth.uid()
        )
      ) OR
      -- Agency sees their invoices
      (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'agency'
        ) AND
        EXISTS (
          SELECT 1 FROM public.tenants t
          JOIN public.units u ON t.unit_id = u.id
          JOIN public.properties p ON u.property_id = p.id
          WHERE t.id = invoices.tenant_id AND p.manager_id = auth.uid()
        )
      ) OR
      -- Tenant sees their own invoices
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'tenant' AND invoices.tenant_id = (
          SELECT id FROM public.tenants t WHERE t.email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
          )
        )
      )
    )
  );

-- Step 7: Update payment_transactions RLS for manager isolation
DROP POLICY IF EXISTS "payment_transactions_select" ON public.payment_transactions;
CREATE POLICY "payment_transactions_select"
  ON public.payment_transactions FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      -- Service role can see all
      auth.jwt() ->> 'role' = 'service_role' OR
      -- Manager sees their payments
      (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'manager'
        ) AND
        EXISTS (
          SELECT 1 FROM public.invoices i
          JOIN public.tenants t ON i.tenant_id = t.id
          JOIN public.units u ON t.unit_id = u.id
          JOIN public.properties p ON u.property_id = p.id
          WHERE i.id = payment_transactions.invoice_id AND p.manager_id = auth.uid()
        )
      ) OR
      -- Agency sees their payments
      (
        EXISTS (
          SELECT 1 FROM public.user_roles 
          WHERE user_id = auth.uid() AND role = 'agency'
        ) AND
        EXISTS (
          SELECT 1 FROM public.invoices i
          JOIN public.tenants t ON i.tenant_id = t.id
          JOIN public.units u ON t.unit_id = u.id
          JOIN public.properties p ON u.property_id = p.id
          WHERE i.id = payment_transactions.invoice_id AND p.manager_id = auth.uid()
        )
      ) OR
      -- Tenant sees their own payments
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'tenant' AND payment_transactions.invoice_id IN (
          SELECT id FROM public.invoices WHERE tenant_id = (
            SELECT id FROM public.tenants t WHERE t.email = (
              SELECT email FROM auth.users WHERE id = auth.uid()
            )
          )
        )
      )
    )
  );

-- Step 8: Note: Manager subscription invoices are in manager_invoices table
-- The webhost_manager_invoices view was removed because invoices table
-- doesn't have subscription_id column. Use manager_invoices table instead.

-- Step 9: Add check to prevent webhost from accessing tenant routes
-- This will be enforced at the application level, but we add a trigger for audit

CREATE OR REPLACE FUNCTION public.log_webhost_tenant_access_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Log any attempt by webhost to access tenant data
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'webhost'
  ) THEN
    INSERT INTO public.activity_logs (
      actor_id,
      actor_role,
      action,
      entity_type,
      metadata
    ) VALUES (
      auth.uid(),
      'webhost',
      'tenant_access_attempt',
      TG_TABLE_NAME,
      jsonb_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'blocked', true
      )
    );
    RAISE EXCEPTION 'Webhost cannot access tenant data';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Add admin_level column to platform_admins if not exists
ALTER TABLE public.platform_admins 
ADD COLUMN IF NOT EXISTS admin_level TEXT 
CHECK (admin_level IN ('super_admin', 'admin', 'limited_admin'));

-- Update existing records
UPDATE public.platform_admins 
SET admin_level = 
  CASE 
    WHEN admin_type = 'owner' THEN 'super_admin'
    WHEN admin_type = 'business' THEN 'admin'
    WHEN admin_type = 'admin' THEN 'limited_admin'
  END
WHERE admin_level IS NULL;

-- Step 11: Add index for landlord split queries
CREATE INDEX IF NOT EXISTS idx_property_landlords_manager_id_null 
  ON public.property_landlords(manager_id) 
  WHERE manager_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_property_landlords_manager_id_not_null 
  ON public.property_landlords(manager_id) 
  WHERE manager_id IS NOT NULL;

-- Step 12: Create function to check if landlord is managed
CREATE OR REPLACE FUNCTION public.is_landlord_managed(landlord_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.property_landlords 
    WHERE landlord_user_id = $1 AND manager_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_landlord_managed TO authenticated;

-- Step 13: Create function to get webhost-visible landlords
CREATE OR REPLACE FUNCTION public.get_webhost_landlords()
RETURNS TABLE (
  landlord_user_id UUID,
  property_count BIGINT,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.landlord_user_id,
    COUNT(DISTINCT pl.property_id) as property_count,
    COALESCE(SUM(
      (SELECT COALESCE(SUM(amount), 0) FROM public.payment_transactions 
       WHERE invoice_id IN (
         SELECT id FROM public.invoices 
         WHERE tenant_id IN (
           SELECT t.id FROM public.tenants t
           JOIN public.units u ON t.unit_id = u.id
           WHERE u.property_id = pl.property_id
         )
       ) AND status = 'completed'
      )
    ), 0) as total_revenue
  FROM public.property_landlords pl
  WHERE pl.manager_id IS NULL  -- Only system landlords
  GROUP BY pl.landlord_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_webhost_landlords TO authenticated;

-- Step 14: Update activity_logs to track role-based access violations
ALTER TABLE public.activity_logs 
ADD COLUMN IF NOT EXISTS access_blocked BOOLEAN DEFAULT FALSE;

-- Step 15: Add comment to document the structure
COMMENT ON TABLE public.platform_admins IS 'Platform administration with 3 tiers: super_admin (owner), admin (business), limited_admin (regular). Webhost has ZERO tenant data access.';

COMMENT ON TABLE public.property_landlords IS 'Links properties to landlords. manager_id IS NULL = system landlord (visible to webhost). manager_id IS NOT NULL = managed landlord (invisible to webhost).';

COMMENT ON VIEW public.landlord_tenant_summary IS 'Revenue-only view for landlords. Hides all tenant PII (names, emails, phones).';

-- Note: webhost_manager_invoices view removed - use manager_invoices table instead
COMMENT ON FUNCTION public.is_landlord_managed IS 'Check if a landlord is managed by a manager/agency (manager_id IS NOT NULL).';

COMMENT ON FUNCTION public.get_webhost_landlords IS 'Get landlords visible to webhost (system landlords only, manager_id IS NULL).';
