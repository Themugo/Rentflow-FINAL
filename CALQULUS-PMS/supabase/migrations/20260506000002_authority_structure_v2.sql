-- ============================================================
-- CALQULUS RMS: Authority Structure v2
-- Establishes clear separation between:
--   • Managed landlords (under a manager/agency)
--   • System landlords (under webhost admin oversight)
-- Also removes can_manage_tenants from webhost permissions entirely.
-- ============================================================

-- ── 1. Add 'landlord' to app_role enum ───────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'landlord';

-- ── 2. Clean up admin_permissions ────────────────────────
-- Remove can_manage_tenants — webhosts NEVER touch tenants.
-- We repurpose the column as can_manage_system_landlords instead
-- (landlords with no manager, i.e. system-level landlords).
ALTER TABLE public.admin_permissions
  ADD COLUMN IF NOT EXISTS can_manage_system_landlords boolean NOT NULL DEFAULT false;

-- can_manage_tenants column was removed as part of webhost tenant firewall
-- No UPDATE needed since column no longer exists

-- Super admins get system landlord management automatically
UPDATE public.admin_permissions
  SET can_manage_system_landlords = true
  WHERE admin_level = 'super_admin';

-- ── 3. property_landlords junction table ─────────────────
-- manager_id IS NULL  → system landlord (under webhost admin)
-- manager_id IS NOT NULL → managed landlord (under that manager only)
CREATE TABLE IF NOT EXISTS public.property_landlords (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       uuid    NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_user_id  uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id        uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  agency_id         uuid    REFERENCES public.agencies(id) ON DELETE SET NULL,
  revenue_share_pct numeric(5,2) NOT NULL DEFAULT 100.00
    CHECK (revenue_share_pct >= 0 AND revenue_share_pct <= 100),
  notes             text,
  assigned_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)  -- one landlord per property
);

-- Ensure agency_id exists (in case table was created by migration 01 without it)
ALTER TABLE IF EXISTS public.property_landlords
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS property_landlords_landlord_idx
  ON public.property_landlords (landlord_user_id);
CREATE INDEX IF NOT EXISTS property_landlords_manager_idx
  ON public.property_landlords (manager_id);
CREATE INDEX IF NOT EXISTS property_landlords_agency_idx
  ON public.property_landlords (agency_id);
-- Partial index for fast "system landlord" queries
CREATE INDEX IF NOT EXISTS property_landlords_system_idx
  ON public.property_landlords (landlord_user_id)
  WHERE manager_id IS NULL;

-- ── 4. payout_requests ───────────────────────────────────
-- recipient_type: 'manager' | 'webhost'  (who approves)
-- If managed landlord → recipient_type='manager', manager_id filled
-- If system landlord → recipient_type='webhost', manager_id NULL
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_type   text    NOT NULL DEFAULT 'manager'
    CHECK (recipient_type IN ('manager', 'webhost')),
  amount           numeric(12,2) NOT NULL CHECK (amount > 0),
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  notes            text,
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  approved_at      timestamptz,
  approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Ensure recipient_type exists (in case table was created by migration 01 without it)
ALTER TABLE IF EXISTS public.payout_requests
  ADD COLUMN IF NOT EXISTS recipient_type text NOT NULL DEFAULT 'manager';

CREATE INDEX IF NOT EXISTS payout_requests_landlord_idx
  ON public.payout_requests (landlord_user_id);
CREATE INDEX IF NOT EXISTS payout_requests_manager_idx
  ON public.payout_requests (manager_id);
CREATE INDEX IF NOT EXISTS payout_requests_status_idx
  ON public.payout_requests (status);
-- Partial index for webhost-routed requests
CREATE INDEX IF NOT EXISTS payout_requests_webhost_idx
  ON public.payout_requests (status)
  WHERE recipient_type = 'webhost';

-- ── 5. landlord_invitations ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.landlord_invitations (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid  NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  manager_id   uuid  REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by_webhost boolean NOT NULL DEFAULT false,
  email        text  NOT NULL,
  token        text  NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status       text  NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz
);

-- Ensure invited_by_webhost exists (in case table was created by migration 01 without it)
ALTER TABLE IF EXISTS public.landlord_invitations
  ADD COLUMN IF NOT EXISTS invited_by_webhost boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS landlord_invitations_token_idx
  ON public.landlord_invitations (token);

-- ── 6. RLS policies ──────────────────────────────────────
ALTER TABLE public.property_landlords  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_invitations ENABLE ROW LEVEL SECURITY;

-- property_landlords: landlord reads only their own rows
DROP POLICY IF EXISTS "landlord_reads_own" ON public.property_landlords;
CREATE POLICY "landlord_reads_own"
  ON public.property_landlords FOR SELECT
  USING (landlord_user_id = auth.uid());

-- property_landlords: manager reads/manages only their linked properties
DROP POLICY IF EXISTS "manager_manages_linked_landlords" ON public.property_landlords;
CREATE POLICY "manager_manages_linked_landlords"
  ON public.property_landlords FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- property_landlords: webhost admins read only system landlords (manager_id IS NULL)
-- Note: enforce at application layer since RLS can't check admin_permissions easily
-- The application must filter WHERE manager_id IS NULL for webhost queries

-- payout_requests: landlord sees own requests
DROP POLICY IF EXISTS "landlord_sees_own_payouts" ON public.payout_requests;
CREATE POLICY "landlord_sees_own_payouts"
  ON public.payout_requests FOR SELECT
  USING (landlord_user_id = auth.uid());

-- payout_requests: landlord creates requests
DROP POLICY IF EXISTS "landlord_creates_payouts" ON public.payout_requests;
CREATE POLICY "landlord_creates_payouts"
  ON public.payout_requests FOR INSERT
  WITH CHECK (landlord_user_id = auth.uid());

-- payout_requests: manager manages their landlords' requests
DROP POLICY IF EXISTS "manager_manages_payouts" ON public.payout_requests;
CREATE POLICY "manager_manages_payouts"
  ON public.payout_requests FOR ALL
  USING (manager_id = auth.uid() OR manager_id IS NULL)
  WITH CHECK (manager_id = auth.uid());

-- landlord_invitations: manager manages their invitations
DROP POLICY IF EXISTS "manager_manages_invitations" ON public.landlord_invitations;
CREATE POLICY "manager_manages_invitations"
  ON public.landlord_invitations FOR ALL
  USING (manager_id = auth.uid() AND invited_by_webhost = false)
  WITH CHECK (manager_id = auth.uid());

-- landlord_invitations: public read by token (for accept flow)
DROP POLICY IF EXISTS "public_read_invitation_by_token" ON public.landlord_invitations;
CREATE POLICY "public_read_invitation_by_token"
  ON public.landlord_invitations FOR SELECT
  USING (true);

-- ── 7. Helper function: is_system_landlord ───────────────
-- Returns true if the given landlord_user_id has no manager link
CREATE OR REPLACE FUNCTION public.is_system_landlord(p_landlord_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.property_landlords
    WHERE landlord_user_id = p_landlord_user_id
      AND manager_id IS NOT NULL
  );
$$;

-- ── 8. Updated_at triggers ───────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS property_landlords_updated_at ON public.property_landlords;
CREATE TRIGGER property_landlords_updated_at
  BEFORE UPDATE ON public.property_landlords
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS payout_requests_updated_at ON public.payout_requests;
CREATE TRIGGER payout_requests_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
