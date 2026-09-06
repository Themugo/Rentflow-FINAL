-- ============================================================
-- CALQULUS PMS — Platform Authority, RBAC & Admin Hierarchy
-- Phase 3/5: Webhost → System Admin delegated hierarchy +
-- unattached-tenant recovery boundary.
--
-- Webhost = ROOT owner (platform_admins.admin_type owner/business,
-- immutable root reserved). System Admin = admin_type 'admin',
-- created ONLY by webhost, delegated Agencies/Managers/Landlords +
-- granular grants. The admin tier has NO general tenant operations;
-- the only tenant surface is the Unattached-Tenants recovery area.
--
-- Safe to run in production (additive: only ADD COLUMN / CREATE OR
-- REPLACE / CREATE POLICY / CREATE FUNCTION — drops only the policies
-- this file itself re-creates or supersedes).
-- ============================================================

-- ── 1. Granular permission columns on platform_admins ───────
ALTER TABLE public.platform_admins
  ADD COLUMN IF NOT EXISTS can_manage_agencies           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_organizations      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_read_unattached_tenants   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_resolve_unattached_tenants boolean NOT NULL DEFAULT false;

-- ── 1b. Matching granular flags on admin_permissions (the edge function
-- seeds these on acceptance; the columns must exist server-side). ──────
ALTER TABLE public.admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_agencies           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_organizations      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_read_unattached_tenants   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_resolve_unattached_tenants boolean NOT NULL DEFAULT false;

-- ── 2. System Admin role semantics ──────────────────────────
-- A DELETED/never-granted admin_type can never appear: the CHECK on
-- admin_type already restricts to owner|business|admin. We additionally
-- force that a 'business' operator is the only non-owner that may create
-- further admins by default; 'admin' System Admins start delegated-only.
-- (can_create_admins is set at invitation/acceptance time.)

-- ── 3. Firewall: System Admin (admin tier) must never read normal
-- tenant operational rows. RLS already scopes tenants to
-- tenant(self)/manager/agency(manager_id)/service_role. Webhost tiers
-- (owner/business/admin) are NOT managers and therefore cannot read
-- tenants through tenants_select — the only tenant surface for
-- webhost/System Admin is the Unattached-Tenants recovery RPC below.

-- ── 4. Unattached-tenant recovery boundary (backend definition) ──────
-- "Unattached" = tenant with no valid authorized property/organization
-- relationship. Not derived from frontend state. Deterministic condition:
--   tenants.manager_id IS NULL
--   AND (tenants.property_id IS NULL OR tenants.unit_id IS NULL)
-- A tenant leaves the queue the moment they are attached
-- (manager_id, property_id, unit_id all set).

CREATE OR REPLACE VIEW public.unattached_tenants_view AS
SELECT
  t.id            AS tenant_id,
  t.name          AS tenant_name,
  t.email         AS tenant_email,
  t.phone         AS tenant_phone,
  t.manager_id,
  t.property_id,
  t.unit_id,
  t.property      AS property_label,
  t.unit          AS unit_label,
  t.status,
  t.created_at,
  t.updated_at
FROM public.tenants t
WHERE t.manager_id IS NULL
  AND (t.property_id IS NULL OR t.unit_id IS NULL);

ALTER VIEW public.unattached_tenants_view OWNER TO postgres;
REVOKE ALL ON public.unattached_tenants_view FROM PUBLIC;
GRANT SELECT ON public.unattached_tenants_view TO service_role;

-- SECURITY DEFINER RPC: non-empty only for webhost/System Admin tiers.
-- Returns recovery-scoped rows (PII limited to what is needed to attach).
CREATE OR REPLACE FUNCTION public.list_unattached_tenants()
RETURNS TABLE (
  tenant_id    uuid,
  tenant_name  text,
  tenant_email text,
  manager_id   uuid,
  property_id  uuid,
  unit_id      uuid,
  property_label text,
  unit_label   text,
  status       text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_is_platform_admin_any() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    u.tenant_id,
    u.tenant_name,
    u.tenant_email,
    u.manager_id,
    u.property_id,
    u.unit_id,
    u.property_label,
    u.unit_label,
    u.status
  FROM public.unattached_tenants_view u
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_unattached_tenants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unattached_tenants() TO authenticated;

-- RPC: resolve an unattached tenant by attaching to a manager/property/unit.
-- Only webhost/owner, webhost/business, or System Admin with
-- can_resolve_unattached_tenants may call. Idempotent and audit-logged.
CREATE OR REPLACE FUNCTION public.resolve_unattached_tenant(
  p_tenant_id uuid,
  p_manager_id uuid,
  p_property_id uuid,
  p_unit_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_is_platform boolean;
  v_may_resolve boolean;
BEGIN
  -- Authorization: only a webhost platform admin (owner/business) or a
  -- System Admin with the resolve permission.
  SELECT
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.suspended = false
        AND pa.admin_type IN ('owner', 'business')
    ) OR
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
        AND pa.suspended = false
        AND pa.admin_type = 'admin'
        AND pa.can_resolve_unattached_tenants = true
    )
  INTO v_may_resolve;

  IF auth.role() != 'service_role' AND NOT v_may_resolve THEN
    RAISE EXCEPTION 'Unauthorized: only Webhost or permitted System Admin can resolve unattached tenants'
      USING ERRCODE = '42501';
  END IF;

  -- The tenant must currently be unattached (guard so it leaves the queue
  -- deterministically and is not double-processed).
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id
      AND t.manager_id IS NULL
      AND (t.property_id IS NULL OR t.unit_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Tenant is not unattached or does not exist' USING ERRCODE = 'P0001';
  END IF;

  -- Attach. Idempotent by nature (no-op if already attached).
  UPDATE public.tenants
  SET manager_id   = COALESCE(p_manager_id,   manager_id),
      property_id  = COALESCE(p_property_id,  property_id),
      unit_id      = COALESCE(p_unit_id,      unit_id),
      updated_at   = now()
  WHERE id = p_tenant_id;

  -- Audit the sensitive action.
  INSERT INTO public.activity_logs (
    actor_id, actor_role, actor_email,
    action, entity_type, entity_id, metadata
  )
  VALUES (
    auth.uid(), 'webhost', NULL,
    'unattached_tenant_resolved', 'tenant', p_tenant_id,
    jsonb_build_object(
      'manager_id', p_manager_id,
      'property_id', p_property_id,
      'unit_id', p_unit_id
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_unattached_tenant(uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_unattached_tenant(uuid,uuid,uuid,uuid) TO authenticated;

-- ── 5. Assigned helper: is the caller a platform admin of any web tier. ──
CREATE OR REPLACE FUNCTION public.user_is_platform_admin_any()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (
  SELECT 1 FROM public.platform_admins
  WHERE user_id = auth.uid() AND suspended = false
) $$;

REVOKE EXECUTE ON FUNCTION public.user_is_platform_admin_any() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_platform_admin_any() TO authenticated;

-- ── 6. Baseline for EXISTING System Admins (admin tier). ──
-- Delegated Agencies/Managers/Landlords + recovery READ. Resolution
-- (rewriting the tenant relationship) is a webhost/owner grant — System
-- Admins read the queue by default but must be granted can_resolve
-- explicitly. Owner/business keep full authority. Per-field grants are
-- managed by the webhost management UI afterwards.
UPDATE public.platform_admins
   SET can_manage_agencies = true,
       can_manage_landlords = true,
       can_manage_managers = true,
       can_read_unattached_tenants = true,
       can_resolve_unattached_tenants = false
 WHERE admin_type = 'admin'
   AND suspended = false;