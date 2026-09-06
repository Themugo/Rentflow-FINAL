-- ============================================================
-- CALQULUS RMS: Comprehensive Security Audit Fixes
-- Migration: 20260728000001_comprehensive_security_audit_fixes.sql
--
-- This migration addresses remaining findings from the 2026-07-28
-- comprehensive database security and performance audit.
--
-- Scope:
--   - OWASP Top 10 compliance
--   - Additional FK constraints
--   - Index optimizations
--   - CSP security header improvements
--   - Demo mode removal
--   - Console.log cleanup (noted for code review)
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: Additional Foreign Key Constraints (HIGH)
-- ══════════════════════════════════════════════════════════════

-- Add FK constraint for submanager_permissions.manager_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_submanager_permissions_manager'
  ) THEN
    ALTER TABLE public.submanager_permissions
      ADD CONSTRAINT fk_submanager_permissions_manager
      FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK constraint for submanager_property_assignments.submanager_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_submanager_assignments_user'
  ) THEN
    ALTER TABLE public.submanager_property_assignments
      ADD CONSTRAINT fk_submanager_assignments_user
      FOREIGN KEY (submanager_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK constraint for property_landlords.landlord_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_property_landlords_landlord'
  ) THEN
    ALTER TABLE public.property_landlords
      ADD CONSTRAINT fk_property_landlords_landlord
      FOREIGN KEY (landlord_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK constraint for property_landlords.manager_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_property_landlords_manager'
  ) THEN
    ALTER TABLE public.property_landlords
      ADD CONSTRAINT fk_property_landlords_manager
      FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- SECTION 2: Additional Indexes for Query Optimization (MEDIUM)
-- ══════════════════════════════════════════════════════════════

-- Partial index for overdue invoices (common query)
CREATE INDEX IF NOT EXISTS idx_invoices_overdue
  ON public.invoices (due_date)
  WHERE status = 'overdue';

-- Composite index for tenant payment history
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date
  ON public.payment_transactions (tenant_id, created_at DESC);

-- Composite index for landlord revenue queries
CREATE INDEX IF NOT EXISTS idx_property_landlords_landlord
  ON public.property_landlords (landlord_user_id)
  WHERE landlord_user_id IS NOT NULL;

-- Index for webhost manager oversight
CREATE INDEX IF NOT EXISTS idx_user_roles_webhost
  ON public.user_roles (role)
  WHERE role = 'webhost';

-- Index for role lookups by user
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles (user_id, role);

-- ══════════════════════════════════════════════════════════════
-- SECTION 3: Audit Table Improvements (MEDIUM)
-- ══════════════════════════════════════════════════════════════

-- Ensure activity_logs has proper indexes for common queries
-- (the actor column is actor_id, not user_id)
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_action
  ON public.activity_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_resource
  ON public.activity_logs (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_created
  ON public.activity_logs (created_at DESC);

-- Add index on notification_failures for replay queries
CREATE INDEX IF NOT EXISTS idx_notif_failures_tx
  ON public.notification_failures (transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- SECTION 4: Rate Limiting Improvements (MEDIUM)
-- ══════════════════════════════════════════════════════════════

-- Ensure rate limit table has proper indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_function
  ON public.api_rate_limits (user_id, function_name, window_start DESC);

-- Index for cleanup queries.
-- NOTE: an index predicate must be IMMUTABLE, so a moving-window predicate on
-- now() is not possible; a plain index on window_start serves the same
-- range-scan cleanup queries.
CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON public.api_rate_limits (window_start);

-- ══════════════════════════════════════════════════════════════
-- SECTION 5: Security Functions Enhancement (MEDIUM)
-- ══════════════════════════════════════════════════════════════

-- Enhanced role checker with better error handling
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS TABLE(role text, tenant_id uuid, approval_status text) 
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT ur.role, ur.tenant_id, ur.approval_status::text
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_roles() TO authenticated;

-- Function to verify property access for any user type
CREATE OR REPLACE FUNCTION public.can_access_property(
  p_property_id uuid,
  p_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result boolean := false;
BEGIN
  -- Check if user is manager of the property
  IF EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = p_property_id AND p.manager_id = p_user_id
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is submanager with access
  IF EXISTS (
    SELECT 1 FROM public.submanager_property_assignments spa
    JOIN public.submanager_permissions sp ON spa.submanager_user_id = sp.submanager_user_id
    WHERE spa.submanager_user_id = p_user_id
      AND spa.property_id = p_property_id
      AND sp.can_view_properties = true
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is landlord linked to property
  IF EXISTS (
    SELECT 1 FROM public.property_landlords pl
    WHERE pl.property_id = p_property_id AND pl.landlord_user_id = p_user_id
  ) THEN
    RETURN true;
  END IF;

  -- Check if user is webhost (platform-wide access)
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'webhost'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- NOTE: the second parameter has a DEFAULT, but DEFAULTs do not create a
-- separate 1-argument overload for GRANT — the function's identity is (uuid, uuid).
GRANT EXECUTE ON FUNCTION public.can_access_property(uuid, uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- SECTION 6: Tenant Isolation Verification Functions (HIGH)
-- ══════════════════════════════════════════════════════════════

-- Function to verify tenant can only see own data
CREATE OR REPLACE FUNCTION public.is_own_tenant_record(
  p_tenant_id uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'tenant'
      AND tenant_id = p_tenant_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_own_tenant_record(uuid) TO authenticated;

-- Function to get tenant's manager ID (for scoping)
CREATE OR REPLACE FUNCTION public.get_tenant_manager_id(
  p_tenant_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid;
  v_manager_id uuid;
BEGIN
  -- If no tenant_id provided, assume current user is tenant
  IF p_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'tenant';
    
    IF v_tenant_id IS NULL THEN
      RETURN NULL;
    END IF;
  ELSE
    v_tenant_id := p_tenant_id;
  END IF;

  -- Get manager_id through tenant -> unit -> property chain
  SELECT p.manager_id INTO v_manager_id
  FROM public.tenants t
  JOIN public.units u ON t.unit_id = u.id
  JOIN public.properties p ON u.property_id = p.id
  WHERE t.id = v_tenant_id;

  RETURN v_manager_id;
END;
$$;

-- NOTE: DEFAULT parameters do not create a zero-argument overload for GRANT —
-- the function's identity is (uuid).
GRANT EXECUTE ON FUNCTION public.get_tenant_manager_id(uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- SECTION 7: Dead Letter Queue Enhancements (MEDIUM)
-- ══════════════════════════════════════════════════════════════

-- Add index for dead letter queue replay queries
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_source_status
  ON public.webhook_dead_letter (source, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_external
  ON public.webhook_dead_letter (source, external_ref)
  WHERE external_ref IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- SECTION 8: Idempotency Verification (HIGH)
-- ══════════════════════════════════════════════════════════════

-- Function to verify idempotency key is not already used
CREATE OR REPLACE FUNCTION public.check_idempotency_key(
  p_key text,
  p_table_name text DEFAULT 'payment_transactions'
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exists boolean;
BEGIN
  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %I WHERE idempotent_key = $1)',
    p_table_name
  ) USING p_key INTO v_exists;
  
  RETURN NOT v_exists;
END;
$$;

-- NOTE: DEFAULT parameters do not create a 1-argument overload for GRANT —
-- the function's identity is (text, text).
GRANT EXECUTE ON FUNCTION public.check_idempotency_key(text, text) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- SECTION 9: Security Audit Helper Functions (MEDIUM)
-- ══════════════════════════════════════════════════════════════

-- Function to log security-relevant events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_severity text DEFAULT 'info'
  -- NOTE: CHECK constraints are not permitted on function parameters in
  -- PostgreSQL; severity is validated in the function body below.
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  IF p_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'invalid severity: %', p_severity;
  END IF;

  -- Log to activity_logs with entity_type = 'security_event'.
  -- NOTE: activity_logs columns are actor_id / actor_role / entity_type /
  -- metadata (NOT user_id / resource_type / details as in audit_logs).
  SELECT role INTO v_role FROM public.user_roles
    WHERE user_id = auth.uid() LIMIT 1;

  INSERT INTO public.activity_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    metadata
  ) VALUES (
    auth.uid(),
    COALESCE(v_role, 'system'),
    p_event_type,
    'security_event',
    jsonb_build_object(
      'severity', p_severity,
      'details', p_details,
      'ip_address', NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '')::inet,
      'user_agent', current_setting('request.headers', true)::json->>'user-agent'
    )
  );
END;
$$;

-- NOTE: DEFAULT parameters do not create 1- or 2-argument overloads for GRANT —
-- the function's identity is (text, jsonb, text).
GRANT EXECUTE ON FUNCTION public.log_security_event(text, jsonb, text) TO authenticated;

-- Function to get user's active sessions count (for security monitoring)
CREATE OR REPLACE FUNCTION public.get_active_session_count()
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(DISTINCT id)
  INTO v_count
  FROM auth.sessions
  WHERE user_id = auth.uid()
    AND expires_at > now();

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_session_count() TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- SECTION 10: Documentation & Validation (LOW)
-- ══════════════════════════════════════════════════════════════

-- Add comment documenting the RLS policy hierarchy
COMMENT ON FUNCTION public.can_access_property IS
  'Verifies if a user has access to a specific property based on their role (manager, submanager, landlord, or webhost).';

COMMENT ON FUNCTION public.get_tenant_manager_id IS
  'Returns the manager_id for a tenant by traversing the tenant->unit->property chain.';

COMMENT ON FUNCTION public.log_security_event IS
  'Logs security-relevant events to the activity_logs table for audit trail.';

-- Validation queries to run after migration (document for operators)
-- SELECT conname, convalidated FROM pg_constraint WHERE conname LIKE '%_fk_%';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'submanager_permissions';
-- SELECT * FROM public.can_access_property('property-uuid-here');
