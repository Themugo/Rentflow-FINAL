-- ============================================================
-- CALQULUS RMS: Operating models & landlord team (authority structure)
-- Supports five commercial arrangements per property_landlords row.
-- See docs/CALQULUS_AUTHORITY_STRUCTURE.md
-- ============================================================

-- ── 1. Operating model on property_landlords ─────────────────
ALTER TABLE public.property_landlords
  ADD COLUMN IF NOT EXISTS operating_model text NOT NULL DEFAULT 'agency_collects_full_management'
    CHECK (operating_model IN (
      'landlord_self_managed',
      'manager_operates_landlord_collects',
      'agency_collects_full_management',
      'agency_collects_pays_landlord',
      'agency_manages_fee_from_landlord'
    )),
  ADD COLUMN IF NOT EXISTS management_fee_pct numeric(5,2)
    CHECK (management_fee_pct IS NULL OR (management_fee_pct >= 0 AND management_fee_pct <= 100)),
  ADD COLUMN IF NOT EXISTS allows_delegated_manager boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delegated_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.property_landlords.operating_model IS
  'Commercial arrangement: who operates vs who collects rent';
COMMENT ON COLUMN public.property_landlords.management_fee_pct IS
  'When landlord collects (agency_manages_fee_from_landlord): % landlord pays manager for ops';
COMMENT ON COLUMN public.property_landlords.delegated_manager_id IS
  'Optional external manager/agency when landlord_self_managed or allows_delegated_manager';

CREATE INDEX IF NOT EXISTS property_landlords_operating_model_idx
  ON public.property_landlords (operating_model);

-- Sync payment_destination from model for existing rows (idempotent)
UPDATE public.property_landlords
SET payment_destination = CASE
  WHEN operating_model IN ('manager_operates_landlord_collects', 'agency_manages_fee_from_landlord')
    THEN 'landlord'
  ELSE 'manager'
END
WHERE payment_destination IS DISTINCT FROM CASE
  WHEN operating_model IN ('manager_operates_landlord_collects', 'agency_manages_fee_from_landlord')
    THEN 'landlord'
  ELSE 'manager'
END;

-- ── 2. Landlord team (RBAC under landlord boss) ───────────────
CREATE TABLE IF NOT EXISTS public.landlord_team_members (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_label                    text,
  can_view_properties             boolean NOT NULL DEFAULT true,
  can_view_tenants                boolean NOT NULL DEFAULT true,
  can_view_leases                 boolean NOT NULL DEFAULT true,
  can_view_invoices               boolean NOT NULL DEFAULT true,
  can_view_maintenance            boolean NOT NULL DEFAULT true,
  can_view_contracts              boolean NOT NULL DEFAULT true,
  can_view_activity_logs          boolean NOT NULL DEFAULT false,
  can_record_payments             boolean NOT NULL DEFAULT false,
  can_edit_tenants                boolean NOT NULL DEFAULT false,
  can_manage_maintenance          boolean NOT NULL DEFAULT false,
  can_create_invoices             boolean NOT NULL DEFAULT false,
  can_approve_moveouts            boolean NOT NULL DEFAULT false,
  can_send_notices                boolean NOT NULL DEFAULT false,
  can_upload_documents            boolean NOT NULL DEFAULT false,
  assigned_property_ids           uuid[] NOT NULL DEFAULT '{}',
  restrict_to_assigned_properties boolean NOT NULL DEFAULT true,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (landlord_user_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS landlord_team_landlord_idx
  ON public.landlord_team_members (landlord_user_id);
CREATE INDEX IF NOT EXISTS landlord_team_member_idx
  ON public.landlord_team_members (member_user_id);

ALTER TABLE public.landlord_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "landlord_manages_own_team"
  ON public.landlord_team_members FOR ALL
  USING (landlord_user_id = auth.uid())
  WITH CHECK (landlord_user_id = auth.uid());

CREATE POLICY "team_member_reads_own_row"
  ON public.landlord_team_members FOR SELECT
  USING (member_user_id = auth.uid());

-- ── 3. Helper: resolve payment destination from model ───────
CREATE OR REPLACE FUNCTION public.payment_destination_for_model(p_model text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_model IN ('manager_operates_landlord_collects', 'agency_manages_fee_from_landlord')
      THEN 'landlord'
    ELSE 'manager'
  END;
$$;

-- ── 4. Trigger: keep payment_destination aligned with operating_model
CREATE OR REPLACE FUNCTION public.sync_property_landlord_payment_destination()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.payment_destination := public.payment_destination_for_model(NEW.operating_model);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_landlords_sync_payment_destination ON public.property_landlords;
CREATE TRIGGER property_landlords_sync_payment_destination
  BEFORE INSERT OR UPDATE OF operating_model ON public.property_landlords
  FOR EACH ROW EXECUTE FUNCTION public.sync_property_landlord_payment_destination();

DROP TRIGGER IF EXISTS landlord_team_members_updated_at ON public.landlord_team_members;
CREATE TRIGGER landlord_team_members_updated_at
  BEFORE UPDATE ON public.landlord_team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
