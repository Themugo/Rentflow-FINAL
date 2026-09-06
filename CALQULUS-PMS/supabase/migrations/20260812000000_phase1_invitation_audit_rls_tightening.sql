-- ============================================================
-- CALQULUS RMS: Phase 1 Security Inventory - RLS tightening
-- Migration: 20260812000000_phase1_invitation_audit_rls_tightening.sql
--
-- Fixes confirmed by the Phase 1 security architecture audit:
--
-- 1. CRITICAL: public.tenant_invitations was readable/writable by
--    ANY user (and pending rows by unauthenticated anon clients):
--    - "authenticated_select_invitations"  (20260530000002)
--    - "authenticated_create_invitations"  (20260530000002)
--    - "Tenant invitations view policy"     (20260811000000) SELECT ... OR status='pending'
--    - "Managers manage tenant invitations" (20260811000000) FOR ALL ... OR auth.role()='authenticated'
--    Impact: any anonymous client holding the public anon key could
--    enumerate every pending invitation (emails, tenant names, unit,
--    property) INCLUDING the secret token + invite_code, enabling
--    invitation hijacking and mass PII exposure. Any authenticated
--    user could also INSERT/UPDATE/DELETE any invitation.
--
--    Fix: restrict to the inviting manager / property co-managers
--    (plus submanagers assigned to the property, mirroring the
--    properties RLS policy), and allow only the invitee to mark
--    their OWN pending invitation used after signup (email must
--    match their JWT). Edge functions (send-tenant-invitation,
--    create-tenant-account) run with the service role and are
--    unaffected by these policies.
--
-- 2. MEDIUM: public.audit_logs INSERT policy allowed any
--    authenticated user to insert audit rows attributed to ANY
--    user_id (audit-trail forgery). The app writes audit logs via
--    the SECURITY DEFINER RPC log_activity(), so tightening to
--    user_id = auth.uid() breaks nothing.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- 1. tenant_invitations
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "authenticated_select_invitations"   ON public.tenant_invitations;
DROP POLICY IF EXISTS "authenticated_create_invitations"   ON public.tenant_invitations;
DROP POLICY IF EXISTS "Tenant invitations view policy"     ON public.tenant_invitations;
DROP POLICY IF EXISTS "Managers manage tenant invitations" ON public.tenant_invitations;

-- Managers (the inviter, co-managers of the same property, or
-- submanagers assigned to the property) can read invitations.
CREATE POLICY "tenant_invitations_manager_select"
  ON public.tenant_invitations FOR SELECT
  USING (
    invited_by = auth.uid()::text
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
    OR property_id IN (
      SELECT unnest(assigned_property_ids)
      FROM public.submanager_permissions
      WHERE submanager_user_id = auth.uid()
    )
  );

-- Managers can create / update / delete invitations they own.
CREATE POLICY "tenant_invitations_manager_all"
  ON public.tenant_invitations FOR ALL
  USING (
    invited_by = auth.uid()::text
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
  )
  WITH CHECK (
    invited_by = auth.uid()::text
    OR property_id IN (SELECT id FROM public.properties WHERE manager_id = auth.uid())
  );

-- The invitee (now authenticated after signup) may mark their own
-- pending invitation as used/accepted. The email must match their
-- JWT so one user can never claim another invitation.
CREATE POLICY "tenant_invitations_invitee_claim"
  ON public.tenant_invitations FOR UPDATE
  USING (
    status = 'pending'
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ══════════════════════════════════════════════════════════════
-- 2. audit_logs
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());
