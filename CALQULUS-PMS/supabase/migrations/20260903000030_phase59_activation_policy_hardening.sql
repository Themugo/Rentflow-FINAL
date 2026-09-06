-- ============================================================
-- Phase 59: Account activation authorization hardening
-- Activation records are service-managed; authenticated users may
-- only read their own record when an application flow requires it.
-- ============================================================

DROP POLICY IF EXISTS "Managers can manage account_activations" ON public.account_activations;
DROP POLICY IF EXISTS "Users can read own account_activations" ON public.account_activations;

CREATE POLICY "Users can read own account activation"
  ON public.account_activations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.account_activations FROM authenticated, anon;

COMMENT ON TABLE public.account_activations IS
  'Service-managed activation records. Authenticated users may only read their own activation record; writes require service_role.';
