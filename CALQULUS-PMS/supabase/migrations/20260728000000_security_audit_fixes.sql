-- ============================================================
-- CALQULUS RMS: Security Audit Fixes
-- Migration: 20260728000000_security_audit_fixes.sql
-- 
-- This migration addresses findings from the 2026-07-28 database
-- security audit. It fixes critical and high-severity issues
-- identified in the audit report.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: Financial Amount Constraints (CRITICAL)
-- ══════════════════════════════════════════════════════════════

-- Add CHECK constraint for payment_transactions.amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_amount_positive'
  ) THEN
    ALTER TABLE public.payment_transactions
      ADD CONSTRAINT payment_transactions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
END $$;

-- Add unique constraint on invoices.invoice_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_invoice_number_unique'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);
  END IF;
END $$;

-- Add unique constraint on tenant_invitations.token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenant_invitations_token_unique'
  ) THEN
    ALTER TABLE public.tenant_invitations
      ADD CONSTRAINT tenant_invitations_token_unique UNIQUE (token);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- SECTION 2: Index Optimizations (HIGH)
-- ══════════════════════════════════════════════════════════════

-- Composite index for invoice reconciliation queries
CREATE INDEX IF NOT EXISTS idx_invoices_manager_status 
  ON public.invoices (manager_id, status) 
  WHERE status IN ('pending', 'overdue');

-- Composite index for tenant balance queries
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status 
  ON public.invoices (tenant_id, status);

-- Index for property manager lookups in leases
CREATE INDEX IF NOT EXISTS idx_leases_manager_property 
  ON public.leases (manager_id, property_id) 
  WHERE status = 'active';

-- Index for submanager permission lookups
CREATE INDEX IF NOT EXISTS idx_submanager_perms_manager 
  ON public.submanager_permissions (manager_id, submanager_user_id);

-- Index for property landlord lookups
CREATE INDEX IF NOT EXISTS idx_property_landlords_manager 
  ON public.property_landlords (manager_id) 
  WHERE manager_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- SECTION 3: RLS Policy Hardening (HIGH)
-- ══════════════════════════════════════════════════════════════

-- Fix: Restrict commission_configs to webhost-only
DROP POLICY IF EXISTS "Authenticated can read commission_configs" 
  ON public.commission_configs;
CREATE POLICY "Webhost_only_commission_configs"
  ON public.commission_configs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'webhost'
  ));

-- Fix: Restrict invoice_line_items to proper scoping
DROP POLICY IF EXISTS "Authenticated can read invoice_line_items" 
  ON public.invoice_line_items;
CREATE POLICY "Scoped_invoice_line_items"
  ON public.invoice_line_items FOR SELECT
  USING (
    -- Tenant sees own line items
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.user_roles ur ON ur.tenant_id = i.tenant_id
      WHERE i.id = invoice_line_items.invoice_id
        AND ur.user_id = auth.uid()
        AND ur.role = 'tenant'
    )
    OR
    -- Manager sees their line items
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.properties p ON i.property_id = p.id
      WHERE i.id = invoice_line_items.invoice_id
        AND p.manager_id = auth.uid()
    )
    OR
    -- Webhost sees all
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'webhost'
    )
  );

-- Fix: Restrict physical_invoices SELECT
DROP POLICY IF EXISTS "Authenticated can read physical_invoices" 
  ON public.physical_invoices;
CREATE POLICY "Scoped_physical_invoices"
  ON public.physical_invoices FOR SELECT
  USING (
    -- Tenant sees own (physical_invoices.tenant_id links directly to user_roles.tenant_id)
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = physical_invoices.tenant_id
        AND ur.user_id = auth.uid()
        AND ur.role = 'tenant'
    )
    OR
    -- Manager sees theirs (physical_invoices.manager_id is a direct column)
    manager_id = auth.uid()
  );

-- Fix: Restrict physical_receipts to managers
DROP POLICY IF EXISTS "Managers can manage physical_receipts" 
  ON public.physical_receipts;
CREATE POLICY "Manager_only_physical_receipts"
  ON public.physical_receipts FOR ALL
  USING (
    -- physical_receipts.manager_id is a direct column (no invoice_id exists)
    manager_id = auth.uid()
  );

-- Fix: Restrict unit_tenancy_history
DROP POLICY IF EXISTS "Authenticated can read unit_tenancy_history" 
  ON public.unit_tenancy_history;
CREATE POLICY "Scoped_unit_tenancy_history"
  ON public.unit_tenancy_history FOR SELECT
  USING (
    -- Tenant sees own history
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
    OR
    -- Manager sees their units
    EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.properties p ON u.property_id = p.id
      WHERE u.id = unit_tenancy_history.unit_id
        AND p.manager_id = auth.uid()
    )
  );

-- Fix: Restrict payment_payers
DROP POLICY IF EXISTS "Authenticated can read payment_payers" 
  ON public.payment_payers;
CREATE POLICY "Scoped_payment_payers"
  ON public.payment_payers FOR SELECT
  USING (
    -- Tenant sees own
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'tenant'
    )
    OR
    -- Manager sees theirs (payment_payers.manager_id is a direct column)
    manager_id = auth.uid()
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 4: Fix Over-Permissive Policies (MEDIUM)
-- ══════════════════════════════════════════════════════════════

-- Fix account_activations: service-only access
DROP POLICY IF EXISTS "Managers can manage account_activations" 
  ON public.account_activations;
CREATE POLICY "Service_only_account_activations"
  ON public.account_activations FOR ALL
  USING (false)
  WITH CHECK (false);

-- Add service function for account activation
CREATE OR REPLACE FUNCTION public.create_account_activation(
  p_user_id uuid,
  p_token text,
  p_expires_at timestamptz DEFAULT now() + interval '24 hours'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_activation_id uuid;
BEGIN
  INSERT INTO public.account_activations (user_id, token, expires_at)
  VALUES (p_user_id, p_token, p_expires_at)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_activation_id;
  
  RETURN v_activation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_account_activation(uuid, text, timestamptz) 
  TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════
-- SECTION 5: Storage Bucket RLS Completion (MEDIUM)
-- ══════════════════════════════════════════════════════════════

-- Complete storage policies with proper INSERT policy
DROP POLICY IF EXISTS "Users can insert own objects" 
  ON storage.objects;
DROP POLICY IF EXISTS "Users_can_insert_own_objects"
  ON storage.objects;
CREATE POLICY "Users_can_insert_own_objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    auth.uid() = owner 
    OR 
    (owner IS NULL AND auth.uid() IS NOT NULL)
  );

-- Ensure bucket-specific policies exist for maintenance-photos bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-photos', 
  'maintenance-photos', 
  false, 
  false, 
  5242880, 
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket policy: only owner or assigned manager can upload
DROP POLICY IF EXISTS "Manager_upload_maintenance_photos" ON storage.objects;
CREATE POLICY "Manager_upload_maintenance_photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'maintenance-photos' AND (
      auth.uid() = owner
      OR
      -- Manager can upload for their properties
      EXISTS (
        SELECT 1 FROM public.maintenance_requests mr
        WHERE mr.property_name IS NOT NULL
          AND mr.manager_id = auth.uid()
      )
    )
  );

-- ══════════════════════════════════════════════════════════════
-- SECTION 6: Audit Logging Function (HIGH)
-- ══════════════════════════════════════════════════════════════

-- Create RPC function for activity logging (bypasses RLS for audit)
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action text,
  p_resource_type text,
  p_resource_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '')::inet,
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, jsonb) 
  TO authenticated, service_role;

COMMENT ON FUNCTION public.log_activity(text, text, uuid, jsonb) IS
  'Bypasses RLS to log activity for audit trail. Use for all significant user actions.';

-- ══════════════════════════════════════════════════════════════
-- SECTION 7: Helper Functions for Security Checks (MEDIUM)
-- ══════════════════════════════════════════════════════════════

-- Improved role checker that handles agency relationship
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost') 
      THEN 'webhost'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'agency') 
      THEN 'agency'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager') 
      THEN 'manager'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'submanager') 
      THEN 'submanager'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'landlord') 
      THEN 'landlord'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'tenant') 
      THEN 'tenant'
    ELSE 'unknown'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- Function to get manager_id considering submanager relationship
CREATE OR REPLACE FUNCTION public.get_effective_manager_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    -- If user is a manager, return their ID
    (SELECT user_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager' LIMIT 1),
    -- If user is a submanager, return the manager who created them
    (SELECT manager_id FROM public.submanager_permissions WHERE submanager_user_id = auth.uid() LIMIT 1),
    -- If user is an agency, return their agency_id
    (SELECT agency_id FROM public.manager_profiles WHERE manager_user_id = auth.uid() LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_manager_id() TO authenticated;

COMMENT ON FUNCTION public.get_effective_manager_id IS
  'Returns the effective manager_id for the current user, considering submanager and agency relationships.';

-- ══════════════════════════════════════════════════════════════
-- SECTION 8: Validation Instructions (DOCUMENTATION)
-- ══════════════════════════════════════════════════════════════

-- After running this migration, validate the NOT VALID constraints:

-- 1. Audit existing data for violations
-- SELECT COUNT(*) FROM public.invoices WHERE amount <= 0;  -- Should return 0
-- SELECT COUNT(*) FROM public.payment_transactions WHERE amount <= 0;  -- Should return 0

-- 2. If no violations, validate constraints
-- ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_amount_positive;
-- ALTER TABLE public.payment_transactions VALIDATE CONSTRAINT payment_transactions_amount_positive;

-- 3. Verify all constraints are valid
-- SELECT conname, convalidated FROM pg_constraint 
-- WHERE conname LIKE '%_positive%' OR conname LIKE '%_nonneg%';
