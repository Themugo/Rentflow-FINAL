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
