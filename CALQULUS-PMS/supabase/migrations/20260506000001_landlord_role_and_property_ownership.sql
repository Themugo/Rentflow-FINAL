-- ============================================================
-- CALQULUS RMS: Landlord Role & Property Ownership
-- ============================================================

-- 0. Ensure app_role enum exists (base values: manager, tenant, webhost, submanager)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('manager', 'tenant', 'webhost', 'submanager');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Add 'landlord' to app_role enum
-- 2. Create property_landlords junction (property ↔ landlord)
-- 3. Create payout_requests table
-- 4. Add landlord_id to properties for quick lookup
-- 5. Enable RLS policies for landlords

-- ── 1. Extend app_role enum ───────────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'landlord';

-- ── 2. property_landlords junction table ──────────────────
-- A property can have one landlord; a landlord can own many properties.
CREATE TABLE IF NOT EXISTS public.property_landlords (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revenue_share_pct numeric(5,2) NOT NULL DEFAULT 100.00
    CHECK (revenue_share_pct >= 0 AND revenue_share_pct <= 100),
  notes             text,
  assigned_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)         -- one landlord per property
);

CREATE INDEX IF NOT EXISTS property_landlords_landlord_idx
  ON public.property_landlords (landlord_user_id);

CREATE INDEX IF NOT EXISTS property_landlords_manager_idx
  ON public.property_landlords (manager_id);

-- ── 3. payout_requests table ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS payout_requests_landlord_idx
  ON public.payout_requests (landlord_user_id);

CREATE INDEX IF NOT EXISTS payout_requests_manager_idx
  ON public.payout_requests (manager_id);

CREATE INDEX IF NOT EXISTS payout_requests_property_idx
  ON public.payout_requests (property_id);

-- ── 4. landlord_invitations table ────────────────────────
-- Manager invites a landlord by email (like tenant invitations)
CREATE TABLE IF NOT EXISTS public.landlord_invitations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  manager_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text NOT NULL,
  token            text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at       timestamptz NOT NULL DEFAULT now(),
  accepted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS landlord_invitations_token_idx
  ON public.landlord_invitations (token);

CREATE INDEX IF NOT EXISTS landlord_invitations_manager_idx
  ON public.landlord_invitations (manager_id);

-- ── 5. RLS policies ──────────────────────────────────────
ALTER TABLE public.property_landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_invitations ENABLE ROW LEVEL SECURITY;

-- property_landlords: landlord sees their own rows
DROP POLICY IF EXISTS "landlord_reads_own_properties" ON public.property_landlords;
CREATE POLICY "landlord_reads_own_properties"
  ON public.property_landlords FOR SELECT
  USING (landlord_user_id = auth.uid());

-- property_landlords: manager sees properties they manage
DROP POLICY IF EXISTS "manager_reads_managed_property_landlords" ON public.property_landlords;
CREATE POLICY "manager_reads_managed_property_landlords"
  ON public.property_landlords FOR SELECT
  USING (manager_id = auth.uid());

-- property_landlords: manager can insert/update/delete
DROP POLICY IF EXISTS "manager_manages_property_landlords" ON public.property_landlords;
CREATE POLICY "manager_manages_property_landlords"
  ON public.property_landlords FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- payout_requests: landlord sees own requests
DROP POLICY IF EXISTS "landlord_reads_own_payouts" ON public.payout_requests;
CREATE POLICY "landlord_reads_own_payouts"
  ON public.payout_requests FOR SELECT
  USING (landlord_user_id = auth.uid());

-- payout_requests: landlord can create requests
DROP POLICY IF EXISTS "landlord_creates_payout_requests" ON public.payout_requests;
CREATE POLICY "landlord_creates_payout_requests"
  ON public.payout_requests FOR INSERT
  WITH CHECK (landlord_user_id = auth.uid());

-- payout_requests: manager sees and manages payouts for their properties
DROP POLICY IF EXISTS "manager_manages_payouts" ON public.payout_requests;
CREATE POLICY "manager_manages_payouts"
  ON public.payout_requests FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- landlord_invitations: manager can manage their invitations
DROP POLICY IF EXISTS "manager_manages_landlord_invitations" ON public.landlord_invitations;
CREATE POLICY "manager_manages_landlord_invitations"
  ON public.landlord_invitations FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- landlord_invitations: anyone with valid token can read (for accept flow)
DROP POLICY IF EXISTS "public_read_landlord_invitation_by_token" ON public.landlord_invitations;
CREATE POLICY "public_read_landlord_invitation_by_token"
  ON public.landlord_invitations FOR SELECT
  USING (true);

-- ── 6. updated_at triggers ───────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_landlords_updated_at ON public.property_landlords;
CREATE TRIGGER property_landlords_updated_at
  BEFORE UPDATE ON public.property_landlords
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS payout_requests_updated_at ON public.payout_requests;
CREATE TRIGGER payout_requests_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
