-- ============================================================
-- CALQULUS RMS: Security hardening — RLS gaps, rate limiting,
-- webhook secrets, session audit
-- ============================================================

-- ── 1. user_roles — ENABLE RLS (was missing entirely) ────────
-- Without this, any authenticated user can read all roles,
-- enumerate all manager/tenant user IDs, and see approval statuses.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Each user reads only their own role(s)
DROP POLICY IF EXISTS "user_reads_own_role" ON public.user_roles;
CREATE POLICY "user_reads_own_role"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Webhost admins read all roles (they manage the platform)
DROP POLICY IF EXISTS "webhost_reads_all_roles" ON public.user_roles;
CREATE POLICY "webhost_reads_all_roles"
  ON public.user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = auth.uid() AND ur2.role = 'webhost'
    )
  );

-- Managers read roles of their own tenants and submanagers
DROP POLICY IF EXISTS "manager_reads_tenant_roles" ON public.user_roles;
CREATE POLICY "manager_reads_tenant_roles"
  ON public.user_roles FOR SELECT
  USING (
    -- Tenant roles linked to tenants this manager manages
    (role = 'tenant' AND tenant_id IN (
      SELECT id FROM public.tenants WHERE manager_id = auth.uid()
    ))
    OR
    -- Submanager roles where the submanager_permissions.manager_id = auth.uid()
    (role = 'submanager' AND user_id IN (
      SELECT sp.submanager_user_id FROM public.submanager_permissions sp
      WHERE sp.manager_id = auth.uid()
    ))
  );

-- Users update own role for non-sensitive fields (not role, not approval_status)
-- Only webhost can update role and approval_status
DROP POLICY IF EXISTS "webhost_manages_roles" ON public.user_roles;
CREATE POLICY "webhost_manages_roles"
  ON public.user_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = auth.uid() AND ur2.role = 'webhost'
    )
  );

-- Service functions (SECURITY DEFINER) can insert new roles
-- The insert policy is very permissive because signups happen
-- before the user has a role — but writes are validated by the app
DROP POLICY IF EXISTS "authenticated_inserts_own_role" ON public.user_roles;
CREATE POLICY "authenticated_inserts_own_role"
  ON public.user_roles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ── 2. profiles table — ensure it has RLS ────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_reads_own_profile" ON public.profiles;
CREATE POLICY "user_reads_own_profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Managers read profiles of their tenants (for name/contact display)
DROP POLICY IF EXISTS "manager_reads_tenant_profiles" ON public.profiles;
CREATE POLICY "manager_reads_tenant_profiles"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT ur.user_id FROM public.user_roles ur
      JOIN public.tenants t ON t.id = ur.tenant_id
      WHERE t.manager_id = auth.uid()
        AND ur.role = 'tenant'
    )
    OR id IN (
      SELECT sp.submanager_user_id FROM public.submanager_permissions sp
      WHERE sp.manager_id = auth.uid()
    )
  );

-- Webhost reads all profiles
DROP POLICY IF EXISTS "webhost_reads_all_profiles" ON public.profiles;
CREATE POLICY "webhost_reads_all_profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'webhost'
    )
  );

DROP POLICY IF EXISTS "user_updates_own_profile" ON public.profiles;
CREATE POLICY "user_updates_own_profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "authenticated_inserts_own_profile" ON public.profiles;
CREATE POLICY "authenticated_inserts_own_profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ── 3. api_rate_limits table — track function call rates ──────
-- Used to enforce per-user rate limits on sensitive edge functions
-- (STK push, payment recording, credit application)
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name text  NOT NULL,
  window_start timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  call_count  integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, function_name, window_start)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_manages_rate_limits"
  ON public.api_rate_limits FOR ALL
  USING (false)  -- No direct user access — only SECURITY DEFINER functions
  WITH CHECK (false);

-- Function to check + increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id     uuid,
  p_function    text,
  p_max_per_hour integer DEFAULT 20
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
  v_window timestamptz := date_trunc('hour', now());
BEGIN
  INSERT INTO public.api_rate_limits (user_id, function_name, window_start, call_count)
  VALUES (p_user_id, p_function, v_window, 1)
  ON CONFLICT (user_id, function_name, window_start)
  DO UPDATE SET call_count = api_rate_limits.call_count + 1
  RETURNING call_count INTO v_count;

  RETURN v_count <= p_max_per_hour;
END;
$$;

-- ── 4. webhook_secrets — store secrets for external webhooks ──
CREATE TABLE IF NOT EXISTS public.webhook_secrets (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  uuid    REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_type text   NOT NULL,  -- 'mpesa_callback' | 'bank_equity' | etc.
  secret_hash text   NOT NULL,  -- bcrypt hash of the actual secret
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  rotated_at  timestamptz,
  UNIQUE (manager_id, webhook_type)
);

ALTER TABLE public.webhook_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_manages_own_secrets"
  ON public.webhook_secrets FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- ── 5. security_audit_log — immutable record of sensitive actions
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type    text    NOT NULL,
  -- login_success | login_fail | password_change | role_escalation |
  -- payment_processed | stk_push_initiated | suspension | reinstatement
  ip_address    inet,
  user_agent    text,
  resource_type text,
  resource_id   uuid,
  details       jsonb,
  severity      text    NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- IMMUTABLE: no updates or deletes allowed
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhost_reads_security_log"
  ON public.security_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'webhost'
    )
  );
CREATE POLICY "service_inserts_security_log"
  ON public.security_audit_log FOR INSERT
  WITH CHECK (true);
-- No UPDATE or DELETE policies — log is append-only

-- ── 6. Revoke service_provider insert to anon ─────────────────
-- Only authenticated users can register as providers
DROP POLICY IF EXISTS "manager_adds_providers" ON public.service_providers;
CREATE POLICY "authenticated_user_inserts_provider"
  ON public.service_providers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Managers can also add providers without a system account (user_id NULL)
CREATE POLICY "manager_adds_unregistered_provider"
  ON public.service_providers FOR INSERT
  WITH CHECK (
    user_id IS NULL AND
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('manager', 'webhost')
        AND ur.approval_status = 'approved'
    )
  );

-- ── 7. Restrict maintenance_requests write to manager scope ───
-- Submanagers cannot write to maintenance requests outside their assigned properties
DROP POLICY IF EXISTS "manager_creates_maintenance" ON public.maintenance_requests;
CREATE POLICY "manager_creates_maintenance"
  ON public.maintenance_requests FOR INSERT
  WITH CHECK (
    manager_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.submanager_permissions sp
      WHERE sp.submanager_user_id = auth.uid()
        AND sp.can_manage_maintenance = true
        AND (NOT sp.restrict_to_assigned_properties OR
             unit_id IN (
               SELECT u.id FROM public.units u
               JOIN public.properties p ON p.id = u.property_id
               WHERE p.id = ANY(sp.assigned_property_ids::uuid[])
             ))
    )
    OR role_in('tenant')  -- tenants submit own requests
  );

-- ── 8. Orphan tenant data isolation ───────────────────────────
-- Managers should NEVER see orphan_payment_entries or move_condition_photos
-- of tenants not in their system
DROP POLICY IF EXISTS "manager_reads_tenant_condition_photos" ON public.move_condition_photos;
CREATE POLICY "manager_reads_tenant_condition_photos"
  ON public.move_condition_photos FOR SELECT
  USING (
    user_id = auth.uid()  -- own photos
    OR (
      tenant_id IS NOT NULL AND
      tenant_id IN (
        SELECT t.id FROM public.tenants t WHERE t.manager_id = auth.uid()
      )
    )
  );
-- Note: orphan photos (tenant_id IS NULL) are NEVER visible to managers
