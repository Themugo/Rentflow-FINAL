-- ============================================================
-- CALQULUS RMS: Compiled vs separate billing, unit management completion
-- ============================================================

-- ── 1. property_billing_config — property-level billing settings ─
-- Controls how charges are invoiced across all units in a property.
-- This is the master switch; per-unit overrides can differ.
CREATE TABLE IF NOT EXISTS public.property_billing_config (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid    NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  manager_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Invoice mode: how charges are bundled
  invoice_mode    text    NOT NULL DEFAULT 'compiled'
    CHECK (invoice_mode IN (
      'compiled',   -- single invoice per unit: rent + water + garbage + all charges combined
      'separate',   -- separate invoice per charge type (one for rent, one for water, one for garbage)
      'rent_only',  -- only rent invoice; other charges invoiced manually
      'grouped'     -- grouped by charge category: one for rent+service, one for utilities
    )),

  -- Due date config
  due_day_of_month  integer NOT NULL DEFAULT 1 CHECK (due_day_of_month BETWEEN 1 AND 28),
  grace_period_days integer NOT NULL DEFAULT 0,

  -- Penalty settings
  late_penalty_enabled boolean NOT NULL DEFAULT false,
  late_penalty_type    text DEFAULT 'fixed', -- 'fixed' | 'percentage'
  late_penalty_amount  numeric(10,2) DEFAULT 0,
  late_penalty_pct     numeric(5,2) DEFAULT 0,

  -- Auto-generation
  auto_generate_monthly boolean NOT NULL DEFAULT true,
  auto_generate_day     integer NOT NULL DEFAULT 25, -- day of month to auto-generate next month's
  notify_before_days    integer NOT NULL DEFAULT 3,  -- notify tenants N days before due

  -- Numbering
  invoice_prefix  text NOT NULL DEFAULT 'INV',
  receipt_prefix  text NOT NULL DEFAULT 'RCP',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_billing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_manages_billing_config"
  ON public.property_billing_config FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- ── 2. Add invoice_mode override to unit_charge_configs ──────
-- Allows per-charge override: "water is always separate even if property is compiled"
ALTER TABLE public.unit_charge_configs
  ADD COLUMN IF NOT EXISTS invoice_mode_override text
    CHECK (invoice_mode_override IS NULL OR invoice_mode_override IN ('compiled', 'separate', 'inherit')),
  -- NULL = inherit from property_billing_config
  ADD COLUMN IF NOT EXISTS charge_order integer DEFAULT 100,
  -- order of lines on invoice (rent=1, water=2, garbage=3, etc.)
  ADD COLUMN IF NOT EXISTS show_on_statement boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS tax_rate_pct numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_taxable boolean DEFAULT false;

-- ── 3. Unit amenities — what's included in the unit ──────────
CREATE TABLE IF NOT EXISTS public.unit_amenities (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid    NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  property_id     uuid    NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  manager_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amenity_type    text    NOT NULL,
  -- parking | wifi | water_included | electricity_included | security_guard
  -- garden | swimming_pool | gym | laundry | backup_generator | cctv
  -- balcony | furnished | semi_furnished | air_conditioning | elevator
  -- borehole | solar_water | gas_cooking | dsb_tv | custom
  amenity_label   text    NOT NULL,  -- display name
  is_included     boolean NOT NULL DEFAULT true,  -- included in rent vs extra charge
  extra_charge    numeric(12,2) DEFAULT 0,        -- if not included, monthly fee
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ua_unit_idx ON public.unit_amenities(unit_id);

ALTER TABLE public.unit_amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_manages_unit_amenities"
  ON public.unit_amenities FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());
CREATE POLICY "tenant_reads_unit_amenities"
  ON public.unit_amenities FOR SELECT
  USING (unit_id IN (
    SELECT unit_id FROM public.tenants
    WHERE id::text = auth.uid()::text AND status = 'active'
  ));

-- ── 4. Unit photos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unit_photos (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid    NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  property_id     uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  manager_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  photo_url       text    NOT NULL,
  caption         text,
  photo_type      text    DEFAULT 'general',
  -- general | exterior | interior | kitchen | bathroom | bedroom | common_area
  display_order   integer DEFAULT 0,
  is_cover        boolean DEFAULT false,  -- main/cover photo for unit
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS up_unit_idx ON public.unit_photos(unit_id);

ALTER TABLE public.unit_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_manages_unit_photos"
  ON public.unit_photos FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());
CREATE POLICY "public_reads_unit_photos"
  ON public.unit_photos FOR SELECT USING (true);

-- ── 5. Extend units with all missing management fields ────────
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS label           text,
  ADD COLUMN IF NOT EXISTS house_deposit   numeric(12,2),
  ADD COLUMN IF NOT EXISTS water_deposit   numeric(12,2),
  ADD COLUMN IF NOT EXISTS floor_number    integer,
  ADD COLUMN IF NOT EXISTS unit_type       text DEFAULT 'standard',
  -- bedsitter | one_bedroom | two_bedroom | three_bedroom | studio | shop | office | penthouse | custom
  ADD COLUMN IF NOT EXISTS facing          text,
  -- north | south | east | west | street | garden | pool | custom
  ADD COLUMN IF NOT EXISTS furnished       text DEFAULT 'unfurnished',
  -- furnished | semi_furnished | unfurnished
  ADD COLUMN IF NOT EXISTS parking_included boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parking_bays    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS available_from  date,  -- when vacant unit becomes available
  ADD COLUMN IF NOT EXISTS market_rent     numeric(12,2);  -- asking/advertised rent (vs actual contracted)

-- ── 6. Bulk unit creation helper ─────────────────────────────
-- Creates N units with sequential labels and a common base config
CREATE OR REPLACE FUNCTION public.bulk_create_units(
  p_property_id   uuid,
  p_manager_id    uuid,
  p_prefix        text,         -- e.g. 'R', 'A', 'B'
  p_start_number  integer,      -- e.g. 1
  p_count         integer,      -- how many to create
  p_monthly_rent  numeric,
  p_unit_type     text DEFAULT 'standard',
  p_bedrooms      integer DEFAULT 1,
  p_floor_number  integer DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  i integer;
  v_unit_number text;
  v_label text;
  v_created integer := 0;
BEGIN
  FOR i IN p_start_number..(p_start_number + p_count - 1)
  LOOP
    v_unit_number := p_prefix || i::text;
    v_label := p_prefix || i::text;

    INSERT INTO public.units (
      property_id, unit_number, label, unit_type,
      monthly_rent, bedrooms, floor_number, status
    ) VALUES (
      p_property_id, v_unit_number, v_label, p_unit_type,
      p_monthly_rent, p_bedrooms, p_floor_number, 'vacant'
    ) ON CONFLICT DO NOTHING;

    -- Auto-create rent charge config
    INSERT INTO public.unit_charge_configs (
      unit_id, property_id, manager_id,
      charge_type, charge_label, amount, auto_generate, charge_order
    )
    SELECT id, p_property_id, p_manager_id, 'rent', 'Monthly Rent', p_monthly_rent, true, 1
    FROM public.units
    WHERE unit_number = v_unit_number AND property_id = p_property_id
    ON CONFLICT DO NOTHING;

    v_created := v_created + 1;
  END LOOP;
  RETURN v_created;
END;
$$;

-- ── 7. Helper: get effective invoice_mode for a unit ─────────
CREATE OR REPLACE FUNCTION public.get_unit_invoice_mode(p_unit_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    -- Property-level config
    (SELECT invoice_mode FROM public.property_billing_config pbc
     JOIN public.units u ON u.property_id = pbc.property_id
     WHERE u.id = p_unit_id),
    'compiled'  -- default
  );
$$;

-- ── 8. Updated_at triggers ────────────────────────────────────
CREATE TRIGGER property_billing_config_upd
  BEFORE UPDATE ON public.property_billing_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 9. Seed default billing config for existing properties ────
INSERT INTO public.property_billing_config (property_id, manager_id, invoice_mode)
SELECT p.id, p.manager_id, 'compiled'
FROM public.properties p
WHERE p.manager_id IS NOT NULL
ON CONFLICT (property_id) DO NOTHING;
