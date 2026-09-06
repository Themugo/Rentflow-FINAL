-- ============================================================
-- CALQULUS RMS: Manager / Agency relationship layer
-- ============================================================

-- ── 1. Extend agencies — make it a proper agency profile ────
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS registration_number  text,
  ADD COLUMN IF NOT EXISTS kra_pin              text,
  ADD COLUMN IF NOT EXISTS county               text,
  ADD COLUMN IF NOT EXISTS description          text,
  ADD COLUMN IF NOT EXISTS website              text,
  ADD COLUMN IF NOT EXISTS whatsapp             text,
  ADD COLUMN IF NOT EXISTS verified             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at          timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status               text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending_verification'));

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manager_manages_own_agency" ON public.agencies;
CREATE POLICY "manager_manages_own_agency"
  ON public.agencies FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "webhost_reads_all_agencies" ON public.agencies;
CREATE POLICY "webhost_reads_all_agencies"
  ON public.agencies FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));

-- ── 2. agency_members — sub-managers belonging to an agency ─
-- When a manager creates a submanager, they can optionally link them
-- to the agency. Enables agency-level reporting.
CREATE TABLE IF NOT EXISTS public.agency_members (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid    NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  manager_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- manager_id = the agency owner (head manager)
  member_user_id  uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- member_user_id = the sub-manager or additional manager in the agency
  role_in_agency  text    NOT NULL DEFAULT 'submanager',
  -- submanager | associate_manager | branch_manager
  joined_at       timestamptz NOT NULL DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (agency_id, member_user_id)
);

ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency_head_manages_members"
  ON public.agency_members FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());
CREATE POLICY "member_reads_own_membership"
  ON public.agency_members FOR SELECT
  USING (member_user_id = auth.uid());

-- ── 3. manager_profile — rich manager record for webhost view ─
-- Extends user_roles with manager-specific metadata that the
-- webhost needs for oversight: property count, subscription tier,
-- suspension reason, approval notes.
CREATE TABLE IF NOT EXISTS public.manager_profiles (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id     uuid    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id           uuid    REFERENCES public.agencies(id) ON DELETE SET NULL,

  -- Status management
  status              text    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'suspended_nonpayment')),
  approval_notes      text,     -- webhost's internal note on approval/rejection
  rejection_reason    text,     -- shown to manager
  suspension_reason   text,
  suspended_at        timestamptz,
  suspended_by        uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at         timestamptz,
  approved_by         uuid    REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Subscription
  subscription_tier   text    NOT NULL DEFAULT 'starter'
    CHECK (subscription_tier IN ('starter', 'growth', 'professional', 'enterprise')),
  max_properties      integer NOT NULL DEFAULT 5,
  max_units           integer NOT NULL DEFAULT 50,
  billing_day         integer NOT NULL DEFAULT 1,  -- day of month platform invoice due

  -- Platform billing
  platform_rate       numeric(10,2) NOT NULL DEFAULT 500,
  -- KES per property per month (overrideable per manager)
  billing_method      text NOT NULL DEFAULT 'mpesa',
  -- mpesa | bank_transfer | invoice_only

  -- Stats cache (updated by triggers/functions)
  property_count      integer NOT NULL DEFAULT 0,
  unit_count          integer NOT NULL DEFAULT 0,
  tenant_count        integer NOT NULL DEFAULT 0,
  last_active_at      timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_reads_own_profile"
  ON public.manager_profiles FOR SELECT
  USING (manager_user_id = auth.uid());
CREATE POLICY "manager_updates_own_profile"
  ON public.manager_profiles FOR UPDATE
  USING (manager_user_id = auth.uid())
  WITH CHECK (manager_user_id = auth.uid());
CREATE POLICY "webhost_manages_manager_profiles"
  ON public.manager_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));

-- ── 4. Subscription tier definitions ─────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key        text    NOT NULL UNIQUE,  -- starter | growth | professional | enterprise
  name            text    NOT NULL,
  description     text,
  max_properties  integer NOT NULL,
  max_units       integer NOT NULL,
  price_per_property numeric(10,2) NOT NULL DEFAULT 500,
  -- KES per property per month
  price_flat      numeric(10,2),
  -- Optional flat rate instead of per-property
  features        jsonb,
  -- ["Water billing", "Bulk SMS", "API access", "White label"]
  is_active       boolean NOT NULL DEFAULT true,
  display_order   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.subscription_tiers
  (tier_key, name, description, max_properties, max_units, price_per_property, features, display_order)
VALUES
  ('starter',      'Starter',      'For individual property managers with up to 5 properties',         5,   50,  500,  '["M-Pesa payments","Tenant portal","Basic invoicing","Email support"]',                              1),
  ('growth',       'Growth',       'Growing agencies managing up to 20 properties',                   20,  200, 450,  '["All Starter features","Water billing","Bulk SMS","WhatsApp notifications","Priority support"]',     2),
  ('professional', 'Professional', 'Professional agencies managing up to 50 properties',              50,  500, 400,  '["All Growth features","Bank reconciliation","API access","Custom reports","Submanager accounts"]',   3),
  ('enterprise',   'Enterprise',   'Large agencies with unlimited properties — custom pricing',       999, 9999, 350, '["All Professional features","White label","Dedicated account manager","Custom integrations","SLA"]',  4)
ON CONFLICT (tier_key) DO NOTHING;

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_tiers"
  ON public.subscription_tiers FOR SELECT USING (is_active = true);

-- ── 5. Manager suspension log ─────────────────────────────────
-- Full audit of every status change on a manager account
CREATE TABLE IF NOT EXISTS public.manager_status_log (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role text,
  old_status      text,
  new_status      text    NOT NULL,
  reason          text,
  internal_note   text,
  notify_manager  boolean DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhost_manages_status_log"
  ON public.manager_status_log FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));
CREATE POLICY "manager_reads_own_status_log"
  ON public.manager_status_log FOR SELECT
  USING (manager_user_id = auth.uid());

-- ── 6. Auto-create manager_profile on manager signup ─────────
CREATE OR REPLACE FUNCTION public.on_manager_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.role = 'manager' AND NEW.approval_status = 'approved' THEN
    INSERT INTO public.manager_profiles (manager_user_id, status)
    VALUES (NEW.user_id, 'approved')
    ON CONFLICT (manager_user_id) DO UPDATE SET status = 'approved', approved_at = now();
  ELSIF NEW.role = 'manager' AND NEW.approval_status = 'pending' THEN
    INSERT INTO public.manager_profiles (manager_user_id, status)
    VALUES (NEW.user_id, 'pending')
    ON CONFLICT (manager_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS manager_approved_trigger ON public.user_roles;
CREATE TRIGGER manager_approved_trigger
  AFTER INSERT OR UPDATE OF approval_status ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'manager')
  EXECUTE FUNCTION public.on_manager_approved();

-- ── 7. Refresh manager_profile stats ─────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_manager_stats(p_manager_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.manager_profiles
  SET
    property_count = (SELECT COUNT(*) FROM public.properties WHERE manager_id = p_manager_id),
    unit_count     = (SELECT COUNT(*) FROM public.units u JOIN public.properties p ON p.id = u.property_id WHERE p.manager_id = p_manager_id),
    tenant_count   = (SELECT COUNT(*) FROM public.tenants WHERE manager_id = p_manager_id AND status = 'active'),
    last_active_at = now(),
    updated_at     = now()
  WHERE manager_user_id = p_manager_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_manager_stats TO authenticated;

-- ── 8. Updated_at trigger ─────────────────────────────────────
CREATE TRIGGER manager_profiles_upd
  BEFORE UPDATE ON public.manager_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed manager_profiles for all existing managers
INSERT INTO public.manager_profiles (manager_user_id, status)
SELECT user_id, CASE approval_status WHEN 'approved' THEN 'approved' ELSE 'pending' END
FROM public.user_roles
WHERE role = 'manager'
ON CONFLICT (manager_user_id) DO NOTHING;
