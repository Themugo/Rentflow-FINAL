-- ============================================================
-- CALQULUS RMS Migration 024: Unit-Tenant-Landlord flow fixes
--
-- 1. Add payment detail columns to tenant_invitations
--    so rent/deposit amounts flow from invite → portal
-- 2. Add DB trigger to keep properties.occupied in sync
--    with actual units.status counts
-- 3. Add unit_tenant_history for audit trail
-- ============================================================

-- ── 1. tenant_invitations: add payment columns ───────────────
ALTER TABLE public.tenant_invitations
  ADD COLUMN IF NOT EXISTS monthly_rent  numeric(12,2),
  ADD COLUMN IF NOT EXISTS house_deposit numeric(12,2),
  ADD COLUMN IF NOT EXISTS water_deposit numeric(12,2),
  ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2)  -- combined deposit
    GENERATED ALWAYS AS (COALESCE(house_deposit,0) + COALESCE(water_deposit,0)) STORED;

-- ── 2. Auto-sync properties.occupied from units table ─────────
-- Fires whenever a unit's status changes to keep the
-- properties.occupied counter accurate without manual updates.
CREATE OR REPLACE FUNCTION public.sync_property_occupied_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Recalculate occupied count for the affected property
  UPDATE public.properties
  SET
    occupied = (
      SELECT COUNT(*) FROM public.units
      WHERE property_id = COALESCE(NEW.property_id, OLD.property_id)
        AND status = 'occupied'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.property_id, OLD.property_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_property_occupied ON public.units;
CREATE TRIGGER trg_sync_property_occupied
  AFTER INSERT OR UPDATE OF status OR DELETE
  ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.sync_property_occupied_count();

-- ── 3. Also sync when a tenant is created/moved ───────────────
-- When tenants table gets a new row, update the unit status
-- and recalculate property occupied count.
CREATE OR REPLACE FUNCTION public.sync_unit_on_tenant_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.unit_id IS NOT NULL THEN
    -- Mark unit as occupied
    UPDATE public.units SET status = 'occupied'
    WHERE id = NEW.unit_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.unit_id IS DISTINCT FROM NEW.unit_id THEN
    -- Vacate old unit
    IF OLD.unit_id IS NOT NULL THEN
      UPDATE public.units SET status = 'vacant'
      WHERE id = OLD.unit_id
        AND NOT EXISTS (
          SELECT 1 FROM public.tenants
          WHERE unit_id = OLD.unit_id AND id != OLD.id AND status = 'active'
        );
    END IF;
    -- Occupy new unit
    IF NEW.unit_id IS NOT NULL THEN
      UPDATE public.units SET status = 'occupied'
      WHERE id = NEW.unit_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'vacated' AND NEW.unit_id IS NOT NULL THEN
    -- Tenant moved out — free the unit if no other active tenant
    UPDATE public.units SET status = 'vacant'
    WHERE id = NEW.unit_id
      AND NOT EXISTS (
        SELECT 1 FROM public.tenants
        WHERE unit_id = NEW.unit_id AND id != NEW.id AND status = 'active'
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_unit_on_tenant ON public.tenants;
CREATE TRIGGER trg_sync_unit_on_tenant
  AFTER INSERT OR UPDATE OF unit_id, status
  ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.sync_unit_on_tenant_change();

-- ── 4. Backfill: fix current occupied counts ──────────────────
-- Recalculate properties.occupied based on actual units.status
UPDATE public.properties p
SET occupied = (
  SELECT COUNT(*) FROM public.units u
  WHERE u.property_id = p.id AND u.status = 'occupied'
);

-- ── 5. Unit audit trail ───────────────────────────────────────
-- Track who lived in which unit and when (for landlord reports)
CREATE TABLE IF NOT EXISTS public.unit_tenancy_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  tenant_name   text,
  move_in_date  date,
  move_out_date date,
  monthly_rent  numeric(12,2),
  reason        text,  -- 'lease_end' | 'early_termination' | 'eviction' | 'transfer'
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unit_tenancy_history ENABLE ROW LEVEL SECURITY;

-- Manager reads their own units' history
CREATE POLICY "manager_reads_unit_history"
  ON public.unit_tenancy_history FOR SELECT
  USING (
    unit_id IN (
      SELECT u.id FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      WHERE p.manager_id = auth.uid()
    )
  );

-- Landlord reads history of their linked properties
CREATE POLICY "landlord_reads_unit_history"
  ON public.unit_tenancy_history FOR SELECT
  USING (
    unit_id IN (
      SELECT u.id FROM public.units u
      JOIN public.property_landlords pl ON pl.property_id = u.property_id
      WHERE pl.landlord_user_id = auth.uid()
    )
  );

CREATE POLICY "service_writes_unit_history"
  ON public.unit_tenancy_history FOR INSERT
  WITH CHECK (true); -- written by edge functions with service role

-- ── 6. Landlord visibility: ensure landlord can read units ────
-- Landlord needs to see units of properties they own
DROP POLICY IF EXISTS "landlord_reads_property_units" ON public.units;
CREATE POLICY "landlord_reads_property_units"
  ON public.units FOR SELECT
  USING (
    property_id IN (
      SELECT property_id FROM public.property_landlords
      WHERE landlord_user_id = auth.uid()
    )
    OR property_id IN (
      SELECT id FROM public.properties WHERE manager_id = auth.uid()
    )
  );

-- ── 7. Update validate_invitation_token to return payment fields ──
-- Drop and recreate to include monthly_rent, house_deposit, water_deposit
DROP FUNCTION IF EXISTS public.validate_invitation_token(text);

CREATE OR REPLACE FUNCTION public.validate_invitation_token(token_value text)
RETURNS TABLE (
  id            uuid,
  email         text,
  tenant_name   text,
  property_id   uuid,
  property_name text,
  unit          text,
  invited_by    uuid,
  status        text,
  expires_at    timestamptz,
  monthly_rent  numeric,
  house_deposit numeric,
  water_deposit numeric
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ti.id,
    ti.email,
    ti.tenant_name,
    ti.property_id,
    ti.property_name,
    ti.unit,
    ti.invited_by,
    ti.status,
    ti.expires_at,
    ti.monthly_rent,
    ti.house_deposit,
    ti.water_deposit
  FROM public.tenant_invitations ti
  WHERE ti.token = token_value
    AND ti.status = 'pending'
    AND ti.expires_at > now();
END;
$$;
