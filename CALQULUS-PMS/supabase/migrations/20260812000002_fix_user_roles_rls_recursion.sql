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
