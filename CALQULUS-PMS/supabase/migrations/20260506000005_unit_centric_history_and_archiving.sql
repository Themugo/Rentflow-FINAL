-- ============================================================
-- CALQULUS RMS: Unit-centric history, tenancy lifecycle, archiving
--
-- PRINCIPLES:
-- • The unit is permanent. Tenants are temporary occupants.
-- • Every record stays. Move-out = archive, never delete.
-- • Tenants keep their own portable history after leaving.
-- • Managers/landlords keep the full unit history.
-- ============================================================

-- ── 1. unit_tenancy_history ───────────────────────────────────
-- The definitive record of who lived in a unit and when.
-- Created on move-in, closed on move-out. Survives permanently.
CREATE TABLE IF NOT EXISTS public.unit_tenancy_history (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id             uuid    NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  property_id         uuid    NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  manager_id          uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id           uuid    NOT NULL,              -- auth.users.id — kept even after tenant leaves
  tenant_name         text    NOT NULL,
  tenant_email        text    NOT NULL,
  tenant_phone        text,

  -- Tenancy period
  move_in_date        date    NOT NULL,
  move_out_date       date,                          -- NULL = still active
  booking_date        date,                          -- date deposit/booking was received

  -- Financial snapshot at point of tenancy
  monthly_rent        numeric(12,2),
  deposit_paid        numeric(12,2)   DEFAULT 0,
  water_deposit_paid  numeric(12,2)   DEFAULT 0,
  total_paid          numeric(12,2)   DEFAULT 0,     -- cumulative rent paid during tenancy
  arrears_at_moveout  numeric(12,2)   DEFAULT 0,     -- unpaid balance at move-out

  -- Status
  status              text    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'transferred')),
  move_out_reason     text,                          -- reason given in vacation notice
  move_out_notes      text,                          -- manager notes at move-out
  notice_id           uuid,                          -- links to vacation_notices.id

  -- Archiving
  archived_at         timestamptz,
  archived_by         uuid    REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uth_unit_idx    ON public.unit_tenancy_history(unit_id);
CREATE INDEX IF NOT EXISTS uth_tenant_idx  ON public.unit_tenancy_history(tenant_id);
CREATE INDEX IF NOT EXISTS uth_property_idx ON public.unit_tenancy_history(property_id);
CREATE INDEX IF NOT EXISTS uth_active_idx  ON public.unit_tenancy_history(unit_id, status)
  WHERE status = 'active';

-- ── 2. unit_activity_log ─────────────────────────────────────
-- Every significant event on a unit — maintenance, notices,
-- tenancy changes, billing changes, lease events.
-- This is the unit's permanent audit trail.
CREATE TABLE IF NOT EXISTS public.unit_activity_log (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid    NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  property_id     uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  tenancy_id      uuid    REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,
  tenant_id       uuid,                              -- who triggered (may be NULL for manager actions)
  triggered_by    uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_by_role text,                            -- 'manager' | 'tenant' | 'submanager' | 'system'

  -- Event
  event_type      text    NOT NULL,
  -- Values: tenant_moved_in | tenant_moved_out | tenant_transferred
  --         maintenance_raised | maintenance_resolved | maintenance_cancelled
  --         notice_submitted | notice_acknowledged | notice_approved | notice_completed
  --         lease_created | lease_signed | lease_expired | lease_terminated
  --         contract_created | contract_signed | contract_archived
  --         charge_added | charge_changed | invoice_generated | payment_recorded
  --         deposit_received | deposit_deduction | deposit_refunded
  --         unit_label_changed | unit_status_changed

  title           text    NOT NULL,                  -- human-readable summary
  description     text,
  reference_id    uuid,                              -- related record ID
  reference_type  text,                              -- 'maintenance_request' | 'contract' | 'lease' | etc.
  metadata        jsonb,                             -- any extra data as JSON

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ual_unit_idx   ON public.unit_activity_log(unit_id);
CREATE INDEX IF NOT EXISTS ual_tenant_idx ON public.unit_activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS ual_event_idx  ON public.unit_activity_log(event_type);
CREATE INDEX IF NOT EXISTS ual_date_idx   ON public.unit_activity_log(created_at DESC);

-- ── 3. Extend vacation_notices with proper unit_id FK ────────
-- vacation_notices.unit_number was a text field with no FK.
-- Add a proper FK so notices are tied to the unit record.
ALTER TABLE public.vacation_notices
  ADD COLUMN IF NOT EXISTS unit_id    uuid REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenancy_id uuid REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vn_unit_idx ON public.vacation_notices(unit_id);

-- ── 4. Extend maintenance_requests with tenancy link ─────────
ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS tenancy_id uuid REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_actual  numeric(12,2),
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 5. Extend contracts with tenancy link and archive ────────
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tenancy_id    uuid REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at   timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- ── 6. Extend leases with archive columns ────────────────────
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS archived_at   timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moved_out_at  timestamptz,
  ADD COLUMN IF NOT EXISTS end_reason    text;
  -- end_reason: 'notice_given' | 'expired' | 'terminated' | 'transferred' | 'mutual_agreement'

-- ── 7. Extend tenants with portable history flags ─────────────
-- Tenants keep access to their portal history after moving out
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS move_out_date    date,
  ADD COLUMN IF NOT EXISTS move_out_reason  text,
  ADD COLUMN IF NOT EXISTS portal_access_until timestamptz;
  -- portal_access_until: manager can grant continued read-only portal access

-- ── 8. Helper: complete_move_out function ────────────────────
-- Called after manager completes the move-out flow.
-- Archives everything, closes the tenancy, frees the unit.
CREATE OR REPLACE FUNCTION public.complete_unit_moveout(
  p_unit_id           uuid,
  p_tenant_id         uuid,
  p_manager_id        uuid,
  p_move_out_date     date,
  p_reason            text    DEFAULT NULL,
  p_notes             text    DEFAULT NULL,
  p_notice_id         uuid    DEFAULT NULL,
  p_grant_portal_days integer DEFAULT 90    -- how long tenant keeps portal access
)
RETURNS uuid   -- returns the tenancy_history id
LANGUAGE plpgsql AS $$
DECLARE
  v_tenancy_id  uuid;
  v_tenant      RECORD;
  v_total_paid  numeric;
  v_arrears     numeric;
BEGIN
  -- Get tenant info
  SELECT name, email, phone, monthly_rent, deposit_balance, property_id, move_in_date
  INTO v_tenant
  FROM public.tenants
  WHERE id = p_tenant_id;

  -- Compute total rent paid and arrears
  SELECT
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN
      COALESCE(balance_due, amount) ELSE 0 END), 0)
  INTO v_total_paid, v_arrears
  FROM public.invoices
  WHERE tenant_id = p_tenant_id;

  -- Close any existing active tenancy record for this unit
  UPDATE public.unit_tenancy_history
  SET status          = 'archived',
      move_out_date   = p_move_out_date,
      move_out_reason = p_reason,
      move_out_notes  = p_notes,
      notice_id       = p_notice_id,
      total_paid      = v_total_paid,
      arrears_at_moveout = v_arrears,
      archived_at     = now(),
      archived_by     = p_manager_id,
      updated_at      = now()
  WHERE unit_id = p_unit_id
    AND tenant_id = p_tenant_id
    AND status = 'active'
  RETURNING id INTO v_tenancy_id;

  -- If no active tenancy record existed, create one now (retroactive)
  IF v_tenancy_id IS NULL THEN
    INSERT INTO public.unit_tenancy_history (
      unit_id, property_id, manager_id, tenant_id,
      tenant_name, tenant_email, tenant_phone,
      move_in_date, move_out_date, monthly_rent,
      deposit_paid, total_paid, arrears_at_moveout,
      status, move_out_reason, move_out_notes, notice_id,
      archived_at, archived_by
    ) VALUES (
      p_unit_id, v_tenant.property_id, p_manager_id, p_tenant_id,
      v_tenant.name, v_tenant.email, v_tenant.phone,
      COALESCE(v_tenant.move_in_date, p_move_out_date - 365),
      p_move_out_date, v_tenant.monthly_rent,
      0, v_total_paid, v_arrears,
      'archived', p_reason, p_notes, p_notice_id,
      now(), p_manager_id
    ) RETURNING id INTO v_tenancy_id;
  END IF;

  -- Archive active lease for this tenant/unit
  UPDATE public.leases
  SET status      = 'terminated',
      moved_out_at = now(),
      archived_at  = now(),
      archived_by  = p_manager_id,
      end_reason   = COALESCE(p_reason, 'notice_given'),
      updated_at   = now()
  WHERE unit_id = p_unit_id
    AND tenant_id = p_tenant_id
    AND status IN ('active', 'expiring');

  -- Archive active contracts for this tenant/unit
  UPDATE public.contracts
  SET status        = 'archived',
      archived_at   = now(),
      archived_by   = p_manager_id,
      archive_reason = 'tenant_moved_out'
  WHERE unit_id = p_unit_id
    AND tenant_id = p_tenant_id
    AND status IN ('active', 'pending_signature', 'draft');

  -- Update tenant: mark inactive, set move_out_date, grant portal access
  UPDATE public.tenants
  SET status              = 'inactive',
      move_out_date       = p_move_out_date,
      move_out_reason     = p_reason,
      portal_access_until = now() + (p_grant_portal_days || ' days')::interval
  WHERE id = p_tenant_id;

  -- Free the unit: set status to vacant
  UPDATE public.units
  SET status     = 'vacant',
      updated_at = now()
  WHERE id = p_unit_id;

  -- Log the event on the unit
  INSERT INTO public.unit_activity_log (
    unit_id, property_id, tenancy_id, tenant_id,
    triggered_by, triggered_by_role,
    event_type, title, description, reference_id, reference_type
  ) VALUES (
    p_unit_id, v_tenant.property_id, v_tenancy_id, p_tenant_id,
    p_manager_id, 'manager',
    'tenant_moved_out',
    v_tenant.name || ' moved out',
    'Move-out completed. Unit status set to vacant. History archived.',
    v_tenancy_id, 'unit_tenancy_history'
  );

  RETURN v_tenancy_id;
END;
$$;

-- ── 9. Helper: open_unit_tenancy (move-in) ───────────────────
CREATE OR REPLACE FUNCTION public.open_unit_tenancy(
  p_unit_id       uuid,
  p_property_id   uuid,
  p_manager_id    uuid,
  p_tenant_id     uuid,
  p_tenant_name   text,
  p_tenant_email  text,
  p_tenant_phone  text,
  p_move_in_date  date,
  p_monthly_rent  numeric,
  p_deposit_paid  numeric  DEFAULT 0,
  p_booking_date  date     DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_tenancy_id uuid;
BEGIN
  -- Close any orphaned active tenancy on this unit (safety check)
  UPDATE public.unit_tenancy_history
  SET status = 'archived', archived_at = now(), archived_by = p_manager_id, updated_at = now()
  WHERE unit_id = p_unit_id AND status = 'active';

  -- Create new tenancy record
  INSERT INTO public.unit_tenancy_history (
    unit_id, property_id, manager_id, tenant_id,
    tenant_name, tenant_email, tenant_phone,
    move_in_date, booking_date, monthly_rent, deposit_paid, status
  ) VALUES (
    p_unit_id, p_property_id, p_manager_id, p_tenant_id,
    p_tenant_name, p_tenant_email, p_tenant_phone,
    p_move_in_date, p_booking_date, p_monthly_rent, p_deposit_paid, 'active'
  ) RETURNING id INTO v_tenancy_id;

  -- Mark unit as occupied
  UPDATE public.units SET status = 'occupied', updated_at = now() WHERE id = p_unit_id;

  -- Log move-in
  INSERT INTO public.unit_activity_log (
    unit_id, property_id, tenancy_id, tenant_id,
    triggered_by, triggered_by_role, event_type, title
  ) VALUES (
    p_unit_id, p_property_id, v_tenancy_id, p_tenant_id,
    p_manager_id, 'manager', 'tenant_moved_in',
    p_tenant_name || ' moved in'
  );

  RETURN v_tenancy_id;
END;
$$;

-- ── 10. RLS policies ─────────────────────────────────────────
ALTER TABLE public.unit_tenancy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_activity_log    ENABLE ROW LEVEL SECURITY;

-- Tenancy history: manager reads all for their properties
DROP POLICY IF EXISTS "manager_reads_unit_tenancy" ON public.unit_tenancy_history;
CREATE POLICY "manager_reads_unit_tenancy"
  ON public.unit_tenancy_history FOR SELECT
  USING (manager_id = auth.uid());

-- Tenancy history: manager manages
DROP POLICY IF EXISTS "manager_manages_unit_tenancy" ON public.unit_tenancy_history;
CREATE POLICY "manager_manages_unit_tenancy"
  ON public.unit_tenancy_history FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Tenancy history: tenant reads their OWN records (portable history)
DROP POLICY IF EXISTS "tenant_reads_own_tenancy_history" ON public.unit_tenancy_history;
CREATE POLICY "tenant_reads_own_tenancy_history"
  ON public.unit_tenancy_history FOR SELECT
  USING (tenant_id = auth.uid());

-- Activity log: manager reads all for their units
DROP POLICY IF EXISTS "manager_reads_unit_activity" ON public.unit_activity_log;
CREATE POLICY "manager_reads_unit_activity"
  ON public.unit_activity_log FOR ALL
  USING (
    unit_id IN (
      SELECT u.id FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      WHERE p.manager_id = auth.uid()
    )
  );

-- Activity log: tenant reads their own events
DROP POLICY IF EXISTS "tenant_reads_own_activity" ON public.unit_activity_log;
CREATE POLICY "tenant_reads_own_activity"
  ON public.unit_activity_log FOR SELECT
  USING (tenant_id = auth.uid());

-- Updated_at triggers
DROP TRIGGER IF EXISTS unit_tenancy_history_updated_at ON public.unit_tenancy_history;
CREATE TRIGGER unit_tenancy_history_updated_at
  BEFORE UPDATE ON public.unit_tenancy_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
