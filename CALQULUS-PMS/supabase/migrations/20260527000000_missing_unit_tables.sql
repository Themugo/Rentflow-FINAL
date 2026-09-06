-- ============================================================
-- CALQULUS RMS: Missing unit sub-tables referenced by frontend code
--
-- The following tables were referenced by the React components
-- but never created in any migration. They support:
--   1. unit_key_records   ← UnitKeyTracker.tsx
--   2. unit_inspections   ← UnitInspectionChecklist.tsx
--   3. unit_activity_log  ← UnitHistoryPanel.tsx (activity tab)
-- ============================================================

-- ── 1. unit_key_records ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unit_key_records (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id             uuid    NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  property_id         uuid    NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  manager_id          uuid    NOT NULL,
  tenant_id           uuid    REFERENCES public.tenants(id) ON DELETE SET NULL,
  key_type            text    NOT NULL,
  key_label           text,
  serial_number       text,
  issued_date         date    NOT NULL,
  issued_by           uuid    NOT NULL,
  issued_to_name      text,
  notes               text,
  status              text    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'returned', 'lost', 'replaced')),
  returned_date       date,
  returned_to         uuid,
  return_condition    text,
  replacement_cost    numeric(12,2),
  deducted_from_deposit boolean DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 2. unit_inspections ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unit_inspections (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id             uuid    NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_id           uuid    REFERENCES public.tenants(id) ON DELETE SET NULL,
  tenancy_id          uuid    REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,
  inspection_type     text    NOT NULL
    CHECK (inspection_type IN ('move_in', 'move_out', 'periodic')),
  inspection_date     date    NOT NULL,
  conducted_by        uuid    NOT NULL,
  checklist_items     jsonb   DEFAULT '[]'::jsonb,
  damage_found        boolean DEFAULT false,
  damage_description  text,
  notes               text,
  status              text    NOT NULL DEFAULT 'completed'
    CHECK (status IN ('draft', 'completed', 'cancelled')),
  tenant_present      boolean DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 3. unit_activity_log ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unit_activity_log (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id             uuid    NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  event_type          text    NOT NULL,
  description         text,
  performed_by        uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata            jsonb   DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_unit_key_records_unit    ON public.unit_key_records(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_key_records_status  ON public.unit_key_records(status);
CREATE INDEX IF NOT EXISTS idx_unit_inspections_unit     ON public.unit_inspections(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_activity_log_unit    ON public.unit_activity_log(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_activity_log_type    ON public.unit_activity_log(event_type);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.unit_key_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_inspections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_activity_log ENABLE ROW LEVEL SECURITY;

-- Managers can manage their own records via property ownership
CREATE POLICY "Managers manage unit_key_records"
  ON public.unit_key_records
  USING (
    unit_id IN (SELECT id FROM public.units WHERE property_id IN (
      SELECT id FROM public.properties WHERE manager_id = auth.uid()
    ))
  );

CREATE POLICY "Managers manage unit_inspections"
  ON public.unit_inspections
  USING (
    unit_id IN (SELECT id FROM public.units WHERE property_id IN (
      SELECT id FROM public.properties WHERE manager_id = auth.uid()
    ))
  );

CREATE POLICY "Managers manage unit_activity_log"
  ON public.unit_activity_log
  USING (
    unit_id IN (SELECT id FROM public.units WHERE property_id IN (
      SELECT id FROM public.properties WHERE manager_id = auth.uid()
    ))
  );
