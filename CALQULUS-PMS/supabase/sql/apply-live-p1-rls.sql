-- =============================================================================
-- PASTE THIS ENTIRE FILE into Supabase Dashboard → SQL Editor → Run.
-- Do NOT paste file paths, English sentences, or this GitHub URL as the query.
-- SQL Editor accepts SQL only. A line starting with "supabase/migrations/..."
-- is not SQL and produces: syntax error at or near "supabase".
--
-- This file is: user_roles recursion fix, then platform_admins recursion fix.
-- Next file (after Success): supabase/sql/apply-live-p1-rpcs.sql
-- Health-check is an Edge Function deploy, not SQL.
-- =============================================================================

-- ========== 20260812000002_fix_user_roles_rls_recursion.sql ==========
-- ──────────────────────────────────────────────────────────────
-- Fix: Admin -> Contracts "Failed to load contracts" caused by
--      infinite recursion in the user_roles RLS policy
-- ──────────────────────────────────────────────────────────────
-- Root cause
--   The `user_roles` SELECT policy `webhost_reads_all_roles` decides row
--   visibility by sub-querying `user_roles` itself:
--     USING (EXISTS (SELECT 1 FROM public.user_roles ur2
--                    WHERE ur2.user_id = auth.uid() AND ur2.role = 'webhost'))
--   To evaluate that sub-query Postgres must re-apply the very `user_roles`
--   RLS policies that triggered it -> infinite recursion. The Admin -> Contracts
--   page runs:
--     1) supabase.from('manager_contracts').select('*')   -- its
--        `webhost_manages_contracts` policy sub-queries user_roles, and
--     2) supabase.from('user_roles').select(...)            -- directly
--   Either path re-enters the recursive `webhost_reads_all_roles` policy,
--   so fetchData throws and the page shows "Failed to load contracts."
--   The same recursion also blocks every other webhost query that checks
--   user_roles for webhost status (manager_profiles, profiles, etc.).
--
-- Fix (smallest safe change; authorization model preserved)
--   Reuse the EXISTING STABLE SECURITY DEFINER helper `public.role_in(role)`
--   (created in 20230101000000_base_schema.sql, already used as precedent in
--   20260506000020_security_hardening.sql:238). It reads `user_roles` with the
--   function owner's privileges, so RLS is NOT re-applied to the internal
--   query — no recursion. Rewrite only the self-referential `user_roles`
--   policies to call `role_in(...)` instead of sub-querying user_roles.
--   Authorization is unchanged: a user with a `webhost` role row can still
--   read/update all user_roles rows; managers still read only their own
--   tenants/submanagers; users still read their own row.
--
-- Scope: ONLY user_roles policies. No schema change, no other tables, no
--   auth/authorization change, no RLS disabled, no USING(true), no public
--   access, no service-role keys. The Contracts page itself is unchanged.
-- ──────────────────────────────────────────────────────────────

-- Ensure authenticated can call the existing SECURITY DEFINER helper.
GRANT EXECUTE ON FUNCTION public.role_in(text) TO authenticated;

-- ── Replace self-referential user_roles SELECT policy ─────────
-- "user_reads_own_role" and "manager_reads_tenant_roles" do NOT self-reference
-- user_roles and are left untouched.

DROP POLICY IF EXISTS "webhost_reads_all_roles" ON public.user_roles;
CREATE POLICY "webhost_reads_all_roles"
  ON public.user_roles FOR SELECT
  USING (public.role_in('webhost'));

-- ── Replace self-referential user_roles UPDATE policy ─────────
-- Same root cause on the UPDATE path; route through role_in() too.
DROP POLICY IF EXISTS "webhost_manages_roles" ON public.user_roles;
CREATE POLICY "webhost_manages_roles"
  ON public.user_roles FOR UPDATE
  USING (public.role_in('webhost'));

-- ========== 20260812000001_fix_platform_admins_rls_recursion.sql ==========
-- ──────────────────────────────────────────────────────────────
-- Fix: infinite recursion detected in policy for relation 'platform_admins'
-- ──────────────────────────────────────────────────────────────
-- Root cause
--   The SELECT policies on `platform_admins` decide row visibility by
--   sub-querying `platform_admins` itself, e.g.
--     USING (EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
--                   AND admin_type = 'owner' AND NOT suspended))
--   To evaluate that sub-query Postgres must re-apply the very RLS policies
--   that triggered it -> infinite recursion. The `customer_billing_blocks`
--   policies then sub-query `platform_admins` too, re-triggering the same
--   recursion, which surfaces in the Custom Pricing page as:
--     "infinite recursion detected in policy for relation 'platform_admins'"
--
-- Fix (smallest safe change, authorization model preserved)
--   A `SECURITY DEFINER` helper reads `platform_admins` with the function
--   owner's privileges (RLS is not re-applied to the internal query), so
--   policies can ask "is the current user an active platform admin of a
--   given tier?" WITHOUT sub-querying the RLS-protected table from inside
--   its own policy. This breaks the recursion while keeping the EXACT
--   existing authorization logic (owner / business / admin, `NOT suspended`,
--   `admin_type` filters). No RLS is disabled, no `USING (true)`, no public
--   access, no exposing all admins.
--
-- Scope: ONLY platform_admins + customer_billing_blocks policies. No schema,
--   no other tables, no pricing logic changed.
-- ──────────────────────────────────────────────────────────────

-- ── 1. SECURITY DEFINER admin-status helper ───────────────────
-- Returns TRUE when the current authenticated user has a non-suspended
-- platform_admins row, optionally restricted to a specific admin_type.
-- Runs as the function owner so the internal SELECT bypasses the
-- platform_admins RLS policies (no recursion). auth.uid() is available
-- inside SECURITY DEFINER functions on Supabase.
CREATE OR REPLACE FUNCTION public.is_platform_admin_active(
  p_admin_type text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  PERFORM 1
  FROM public.platform_admins
  WHERE user_id = v_uid
    AND NOT suspended
    AND (p_admin_type IS NULL OR admin_type = p_admin_type);
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin_active(text) TO authenticated;

-- ── 2. Replace self-referential platform_admins SELECT policies ──
-- Drop the hierarchy policies that sub-query platform_admins.
DROP POLICY IF EXISTS "owner_select_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "business_select_admins" ON public.platform_admins;
DROP POLICY IF EXISTS "admin_select_self" ON public.platform_admins;

-- Drop the enforce_management_structure SELECT policy that also sub-queries
-- platform_admins.
DROP POLICY IF EXISTS "platform_admins_select" ON public.platform_admins;

-- Single consolidated SELECT policy — same authorization as before:
--   * service_role bypasses RLS anyway (kept for parity), OR
--   * an active owner sees every row, OR
--   * an active business sees every non-owner row, OR
--   * an admin sees only their own row.
-- No sub-query on platform_admins -> no recursion.
CREATE POLICY "platform_admins_select"
  ON public.platform_admins FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      auth.jwt() ->> 'role' = 'service_role'
      OR public.is_platform_admin_active('owner')
      OR (public.is_platform_admin_active('business') AND admin_type <> 'owner')
      OR user_id = auth.uid()
    )
  );

-- ── 3. Replace self-referential platform_admins manage policies ──
-- Owner can INSERT/UPDATE/DELETE any admin.
DROP POLICY IF EXISTS "owner_manage_admins" ON public.platform_admins;
CREATE POLICY "owner_manage_admins"
  ON public.platform_admins FOR ALL
  USING (public.is_platform_admin_active('owner'))
  WITH CHECK (public.is_platform_admin_active('owner'));

-- Business can INSERT admins of type admin/business.
DROP POLICY IF EXISTS "business_manage_admins" ON public.platform_admins;
CREATE POLICY "business_manage_admins"
  ON public.platform_admins FOR INSERT
  WITH CHECK (
    public.is_platform_admin_active('business')
    AND admin_type IN ('admin', 'business')
  );

-- Business can UPDATE non-owner admins.
DROP POLICY IF EXISTS "business_update_admins" ON public.platform_admins;
CREATE POLICY "business_update_admins"
  ON public.platform_admins FOR UPDATE
  USING (
    public.is_platform_admin_active('business')
    AND admin_type <> 'owner'
  )
  WITH CHECK (
    public.is_platform_admin_active('business')
    AND admin_type <> 'owner'
  );

-- ── 4. Replace customer_billing_blocks policies ─────────────
-- These sub-query platform_admins; route them through the helper so they no
-- longer re-trigger the platform_admins RLS recursion. Authorization is
-- unchanged: any active platform admin (owner/business/admin) can SELECT;
-- only owner/business can manage.
DROP POLICY IF EXISTS "webhost_select_billing_blocks" ON public.customer_billing_blocks;
CREATE POLICY "webhost_select_billing_blocks"
  ON public.customer_billing_blocks FOR SELECT
  USING (public.is_platform_admin_active());

DROP POLICY IF EXISTS "webhost_manage_billing_blocks" ON public.customer_billing_blocks;
CREATE POLICY "webhost_manage_billing_blocks"
  ON public.customer_billing_blocks FOR ALL
  USING (
    public.is_platform_admin_active('owner')
    OR public.is_platform_admin_active('business')
  )
  WITH CHECK (
    public.is_platform_admin_active('owner')
    OR public.is_platform_admin_active('business')
  );

-- Customers keep reading their own block (unchanged, no platform_admins ref).
DROP POLICY IF EXISTS "customer_select_own_block" ON public.customer_billing_blocks;
CREATE POLICY "customer_select_own_block"
  ON public.customer_billing_blocks FOR SELECT
  USING (customer_id = auth.uid());


-- Function exists check (SQL Editor runs as postgres; RLS is bypassed here).
SELECT 'role_in' AS fn, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'role_in'
UNION ALL
SELECT 'is_platform_admin_active', pg_get_function_identity_arguments(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_platform_admin_active';
