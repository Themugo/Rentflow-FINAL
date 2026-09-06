-- ──────────────────────────────────────────────────────────────
-- Phase 1: System Owner / Admin Hierarchy
-- ──────────────────────────────────────────────────────────────
-- Creates platform_admins table with 3 tiers:
--   owner    — mugo.james27 (immutable, cannot be suspended)
--   business — themugo@calqulusrms.com (can be suspended by OWNER only)
--   admin    — admin@calqulusrms.com (can be suspended by OWNER or BUSINESS)
--
-- Suspension rules enforced at application layer + DB triggers.
-- ──────────────────────────────────────────────────────────────

-- ── 1. platform_admins table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_type      text NOT NULL CHECK (admin_type IN ('owner', 'business', 'admin')),
  display_name    text NOT NULL,
  email           text NOT NULL,
  can_create_admins        boolean NOT NULL DEFAULT false,
  can_manage_managers      boolean NOT NULL DEFAULT false,
  can_manage_billing       boolean NOT NULL DEFAULT false,
  can_manage_properties    boolean NOT NULL DEFAULT false,
  can_manage_landlords     boolean NOT NULL DEFAULT false,
  can_view_activity_logs   boolean NOT NULL DEFAULT true,
  can_manage_platform_settings boolean NOT NULL DEFAULT false,
  is_immutable    boolean NOT NULL DEFAULT false,
  suspended       boolean NOT NULL DEFAULT false,
  suspended_at    timestamptz,
  suspended_by    uuid REFERENCES auth.users(id),
  suspension_reason text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES auth.users(id)
);

-- ── 2. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON public.platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_admin_type ON public.platform_admins(admin_type);

-- ── 3. RLS ────────────────────────────────────────────────────
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Owners can see everything
DROP POLICY IF EXISTS "owner_select_admins" ON public.platform_admins;
CREATE POLICY "owner_select_admins"
  ON public.platform_admins FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND admin_type = 'owner' AND NOT suspended)
  );

-- Business can see all non-owner admins
DROP POLICY IF EXISTS "business_select_admins" ON public.platform_admins;
CREATE POLICY "business_select_admins"
  ON public.platform_admins FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND admin_type = 'business' AND NOT suspended)
    AND admin_type != 'owner'
  );

-- Admins can see only their own record
DROP POLICY IF EXISTS "admin_select_self" ON public.platform_admins;
CREATE POLICY "admin_select_self"
  ON public.platform_admins FOR SELECT
  USING (user_id = auth.uid());

-- Owner can INSERT/UPDATE/DELETE any admin
DROP POLICY IF EXISTS "owner_manage_admins" ON public.platform_admins;
CREATE POLICY "owner_manage_admins"
  ON public.platform_admins FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND admin_type = 'owner' AND NOT suspended)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND admin_type = 'owner' AND NOT suspended)
  );

-- Business can INSERT/UPDATE admins (but not delete owners)
DROP POLICY IF EXISTS "business_manage_admins" ON public.platform_admins;
CREATE POLICY "business_manage_admins"
  ON public.platform_admins FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND admin_type = 'business' AND NOT suspended)
    AND admin_type IN ('admin', 'business')
  );

DROP POLICY IF EXISTS "business_update_admins" ON public.platform_admins;
CREATE POLICY "business_update_admins"
  ON public.platform_admins FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND admin_type = 'business' AND NOT suspended)
    AND admin_type != 'owner'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND admin_type = 'business' AND NOT suspended)
    AND admin_type != 'owner'
  );

-- ── 4. Auto-update updated_at trigger ───────────────────────
CREATE OR REPLACE FUNCTION public.trigger_set_platform_admin_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_admins_updated_at ON public.platform_admins;
CREATE TRIGGER trg_platform_admins_updated_at
  BEFORE UPDATE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_platform_admin_timestamp();

-- ── 5. Suspension protection trigger (immutable owners) ──
CREATE OR REPLACE FUNCTION public.protect_immutable_admins()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_immutable THEN
    IF NEW.suspended IS DISTINCT FROM OLD.suspended THEN
      RAISE EXCEPTION 'Cannot suspend an immutable admin (owner)';
    END IF;
    IF NEW.admin_type IS DISTINCT FROM OLD.admin_type THEN
      RAISE EXCEPTION 'Cannot change admin_type of an immutable admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_admins_protect_immutable ON public.platform_admins;
CREATE TRIGGER trg_platform_admins_protect_immutable
  BEFORE UPDATE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_admins();

-- ── 6. Grant permissions ────────────────────────────────────
GRANT ALL ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
