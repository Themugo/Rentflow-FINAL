-- Phase 3: RLS permissive-policy lockdown
-- Removes TO-public policies with qual/with_check = true that leaked data to
-- anon and authenticated users. See docs/audits/PHASE-3-RLS.md.

-- ── 1. landlord_invitations ─────────────────────────────────────────
-- The two "by_token" policies were USING (true) TO public: anyone (including
-- unauthenticated) could dump every landlord invitation (emails + tokens).
-- Replaced by a SECURITY DEFINER RPC that only returns one invitation when
-- the caller presents its token (same pattern as validate_invitation_token).
DROP POLICY IF EXISTS "public_read_invitation_by_token"
  ON public.landlord_invitations;
DROP POLICY IF EXISTS "public_read_landlord_invitation_by_token"
  ON public.landlord_invitations;

-- Duplicate manager policies consolidated (keep the snake_case one).
DROP POLICY IF EXISTS "manager_manages_landlord_invitations"
  ON public.landlord_invitations;

CREATE OR REPLACE FUNCTION public.get_landlord_invitation_by_token(p_token text)
RETURNS TABLE(
  id uuid,
  property_id uuid,
  manager_id uuid,
  email text,
  status text,
  expires_at timestamptz,
  property_name text,
  property_address text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    li.id,
    li.property_id,
    li.manager_id,
    li.email,
    li.status,
    li.expires_at,
    p.name    AS property_name,
    p.address AS property_address
  FROM public.landlord_invitations li
  LEFT JOIN public.properties p ON p.id = li.property_id
  WHERE li.token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_landlord_invitation_by_token(text)
  TO anon, authenticated;

-- Atomic accept: the previous client flow (upsert property_landlords,
-- upsert user_roles, update invitation) had no valid UPDATE path for a
-- brand-new landlord under manager-scoped policies, and cannot be opened
-- to the public. A SECURITY DEFINER RPC performs it atomically, enforcing
-- token validity + email match (mirrors tenant_invitations_invitee_claim).
CREATE OR REPLACE FUNCTION public.accept_landlord_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv   public.landlord_invitations%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be signed in to accept an invitation';
  END IF;

  SELECT * INTO v_inv
  FROM public.landlord_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;
  IF v_inv.status = 'accepted' THEN
    -- Idempotent re-accept only for the user who already holds the link;
    -- anyone else replaying a spent token gets a clear rejection.
    IF EXISTS (
      SELECT 1 FROM public.property_landlords
      WHERE property_id = v_inv.property_id AND landlord_user_id = auth.uid()
    ) THEN
      RETURN v_inv.id;
    END IF;
    RAISE EXCEPTION 'invitation has already been accepted';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation is not pending (status: %)', v_inv.status;
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'invitation has expired';
  END IF;

  v_email := auth.jwt() ->> 'email';
  IF v_email IS NOT NULL AND lower(v_email) <> lower(v_inv.email) THEN
    RAISE EXCEPTION 'invitation email does not match your account email';
  END IF;

  INSERT INTO public.property_landlords (
    property_id, landlord_user_id, manager_id, revenue_share_pct
  ) VALUES (
    v_inv.property_id, auth.uid(), v_inv.manager_id, 100
  )
  ON CONFLICT (property_id) DO UPDATE
    SET landlord_user_id = EXCLUDED.landlord_user_id,
        manager_id       = EXCLUDED.manager_id;

  -- user_roles unique key is (user_id, role); do not clobber other roles.
  INSERT INTO public.user_roles (user_id, role, approval_status)
  VALUES (auth.uid(), 'landlord', 'approved')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.landlord_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN v_inv.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_landlord_invitation(text)
  TO authenticated;

-- ── 2. landlord_invoices ────────────────────────────────────────────
-- "Service can insert landlord_invoices" was TO public WITH CHECK (true):
-- anyone could insert forged invoices. The webhost UI is already covered by
-- webhost_manages_landlord_invoices (ALL, user_roles role='webhost').
DROP POLICY IF EXISTS "Service can insert landlord_invoices"
  ON public.landlord_invoices;
-- Duplicate landlord SELECT policies consolidated (keep the snake_case one).
DROP POLICY IF EXISTS "Landlords can read own invoices"
  ON public.landlord_invoices;

-- ── 3. unit_photos ──────────────────────────────────────────────────
-- Public read leaked every unit photo URL/metadata to anon. The only app
-- consumer is the manager gallery (manager_manages_unit_photos remains).
DROP POLICY IF EXISTS "public_reads_unit_photos" ON public.unit_photos;

-- ── 4. service-only tables ──────────────────────────────────────────
-- "Service can ..." policies were granted TO public, so any user (or anon)
-- could insert forged payment logs, wallet transactions, audit entries and
-- transfer logs. service_role bypasses RLS entirely, so no replacement
-- policy is required — dropping restores deny-by-default for everyone else.
DROP POLICY IF EXISTS "Service can insert into dead_letter_queue"
  ON public.dead_letter_queue;
DROP POLICY IF EXISTS "Service can insert payment_logs"
  ON public.payment_logs;
DROP POLICY IF EXISTS "Service can manage wallet transactions"
  ON public.wallet_transactions;
DROP POLICY IF EXISTS "service_inserts_security_log"
  ON public.security_audit_log;
DROP POLICY IF EXISTS "service_manages_transfer_log"
  ON public.tenant_transfer_log;
DROP POLICY IF EXISTS "service_writes_unit_history"
  ON public.unit_tenancy_history;

-- Intentionally retained public reads (reference/marketplace data):
--   kenya_water_companies, property_tier_limits, provider_reviews

-- ── 5. Break infinite recursion: user_roles ↔ tenants ───────────────
-- user_roles.manager_reads_tenant_roles subqueries tenants, and tenants
-- policies (tenant_reads_own_record etc.) subquery user_roles. Evaluating
-- ANY user_roles policy as an authenticated user therefore loops:
--   user_roles → tenants → user_roles → … (ERROR: infinite recursion).
-- SECURITY DEFINER helpers read the inner tables as the owner and bypass
-- RLS, breaking the cycle while preserving the exact policy semantics.
CREATE OR REPLACE FUNCTION public.my_manager_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT id FROM public.tenants WHERE manager_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.my_manager_submanager_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT submanager_user_id FROM public.submanager_permissions WHERE manager_id = auth.uid() $$;

REVOKE ALL ON FUNCTION public.my_manager_tenant_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_manager_submanager_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_manager_tenant_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_manager_submanager_ids() TO authenticated;

DROP POLICY IF EXISTS manager_reads_tenant_roles ON public.user_roles;
CREATE POLICY manager_reads_tenant_roles ON public.user_roles FOR SELECT USING (
  (role = 'tenant' AND tenant_id IN (SELECT public.my_manager_tenant_ids()))
  OR
  (role = 'submanager' AND user_id IN (SELECT public.my_manager_submanager_ids()))
);

-- ── 6. Break infinite recursion: tenants ↔ units ────────────────────
-- tenants.tenants_select EXISTS-subqueries units, while two units tenant
-- policies subquery tenants back (tenants → units → tenants). Same fix:
-- SECURITY DEFINER helper returning the caller's unit ids.
CREATE OR REPLACE FUNCTION public.my_tenant_unit_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT unit_id FROM public.tenants
   WHERE id IN (SELECT public.caller_tenant_ids()) AND unit_id IS NOT NULL $$;

REVOKE ALL ON FUNCTION public.my_tenant_unit_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_tenant_unit_ids() TO authenticated;

DROP POLICY IF EXISTS "Tenants can view their own unit" ON public.units;
CREATE POLICY "Tenants can view their own unit" ON public.units FOR SELECT
  USING (id IN (SELECT public.my_tenant_unit_ids()));

DROP POLICY IF EXISTS tenant_reads_own_unit ON public.units;
CREATE POLICY tenant_reads_own_unit ON public.units FOR SELECT
  USING (id IN (SELECT public.my_tenant_unit_ids()));

-- ── 7. invoices_select: remove auth.users subquery (permission denied) ─
-- The tenant branch of 20260601000000's invoices_select reads auth.users
-- to match tenants by email. authenticated has no privilege on auth.users,
-- so EVERY tenant invoice read errors out. caller_tenant_ids() is SECURITY
-- DEFINER and expresses the same "my own invoices" check via the tenant
-- role link (which tenant_reads_own_invoices already uses).
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      auth.jwt() ->> 'role' = 'service_role' OR
      -- Manager / agency see invoices for tenants in their properties
      (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('manager', 'agency')
        ) AND
        EXISTS (
          SELECT 1 FROM public.tenants t
          JOIN public.units u ON t.unit_id = u.id
          JOIN public.properties p ON u.property_id = p.id
          WHERE t.id = invoices.tenant_id AND p.manager_id = auth.uid()
        )
      ) OR
      -- Tenant sees their own invoices
      invoices.tenant_id IN (SELECT public.caller_tenant_ids())
    )
  );
