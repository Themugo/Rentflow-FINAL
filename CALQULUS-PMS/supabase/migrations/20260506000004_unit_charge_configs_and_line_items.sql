-- ============================================================
-- CALQULUS RMS: Unit-level charge configuration + invoice line items
-- Each unit gets configurable charges: rent, water, garbage,
-- security, service charge, and any custom charges.
-- Invoices become itemized — one line per charge type.
-- ============================================================

-- ── 1. Extend units table ────────────────────────────────────
-- Add label override and house deposit tracking
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS label           text,          -- custom label e.g. "R1", "A1", "Shop 3"
  ADD COLUMN IF NOT EXISTS house_deposit   numeric(12,2), -- security/house deposit amount
  ADD COLUMN IF NOT EXISTS water_deposit   numeric(12,2), -- water deposit
  ADD COLUMN IF NOT EXISTS floor_number    integer,
  ADD COLUMN IF NOT EXISTS unit_type       text           -- 'bedsitter' | 'one_bedroom' | 'two_bedroom' | 'shop' | 'office' | 'custom'
  ;

-- ── 2. unit_charge_configs ───────────────────────────────────
-- Defines ALL recurring charges for a unit.
-- This is the master config — invoice generation reads from here.
--
-- charge_type values:
--   rent           → monthly rent (base)
--   water          → water bill (metered or flat rate)
--   garbage        → garbage/refuse collection
--   security       → security levy
--   service_charge → service charge / maintenance levy
--   caretaker      → caretaker fee
--   wifi           → internet/wifi fee
--   parking        → parking fee
--   custom         → any other charge (use charge_label)
CREATE TABLE IF NOT EXISTS public.unit_charge_configs (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid    NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  property_id     uuid    NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  manager_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charge_type     text    NOT NULL,
  charge_label    text    NOT NULL,          -- display name on invoice e.g. "Garbage Collection"
  amount          numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  is_active       boolean NOT NULL DEFAULT true,
  is_metered      boolean NOT NULL DEFAULT false,  -- true = amount computed from meter (water)
  billing_cycle   text    NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual', 'once_off', 'on_demand')),
  auto_generate   boolean NOT NULL DEFAULT true,   -- include in auto invoice generation
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ucc_unit_idx     ON public.unit_charge_configs(unit_id);
CREATE INDEX IF NOT EXISTS ucc_property_idx ON public.unit_charge_configs(property_id);
CREATE INDEX IF NOT EXISTS ucc_manager_idx  ON public.unit_charge_configs(manager_id);
CREATE INDEX IF NOT EXISTS ucc_active_idx   ON public.unit_charge_configs(unit_id, is_active)
  WHERE is_active = true;

-- ── 3. invoice_line_items ────────────────────────────────────
-- Breaks each invoice into individual charge lines.
-- A monthly rent invoice now has lines: rent + water + garbage etc.
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid    NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  unit_charge_id  uuid    REFERENCES public.unit_charge_configs(id) ON DELETE SET NULL,
  charge_type     text    NOT NULL,
  charge_label    text    NOT NULL,
  quantity        numeric(10,3) NOT NULL DEFAULT 1,  -- units consumed (for metered)
  unit_price      numeric(12,2) NOT NULL,            -- rate per unit / flat amount
  amount          numeric(12,2) NOT NULL,            -- quantity × unit_price
  is_manual       boolean NOT NULL DEFAULT false,    -- manager manually added this line
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ili_invoice_idx ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS ili_type_idx    ON public.invoice_line_items(charge_type);

-- ── 4. unit_deposit_ledger ───────────────────────────────────
-- Tracks house and water deposits per unit — paid in, deductions, refunds
CREATE TABLE IF NOT EXISTS public.unit_deposit_ledger (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid    NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_id       uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  deposit_type    text    NOT NULL CHECK (deposit_type IN ('house', 'water', 'other')),
  entry_type      text    NOT NULL CHECK (entry_type IN ('received', 'deduction', 'refund')),
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  balance_after   numeric(12,2) NOT NULL,
  description     text,
  reference       text,
  transaction_date date   NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS udl_unit_idx   ON public.unit_deposit_ledger(unit_id);
CREATE INDEX IF NOT EXISTS udl_tenant_idx ON public.unit_deposit_ledger(tenant_id);

-- ── 5. Helper: get current deposit balance per unit ─────────
CREATE OR REPLACE FUNCTION public.get_unit_deposit_balance(
  p_unit_id   uuid,
  p_deposit_type text DEFAULT 'house'
)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    SUM(CASE
      WHEN entry_type = 'received' THEN amount
      WHEN entry_type IN ('deduction', 'refund') THEN -amount
    END), 0
  )
  FROM public.unit_deposit_ledger
  WHERE unit_id = p_unit_id AND deposit_type = p_deposit_type;
$$;

-- ── 6. Helper: get unit display label ───────────────────────
-- Returns label if set, otherwise unit_number
CREATE OR REPLACE FUNCTION public.get_unit_label(p_unit_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(label, unit_number)
  FROM public.units WHERE id = p_unit_id;
$$;

-- ── 7. RLS policies ─────────────────────────────────────────
ALTER TABLE public.unit_charge_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_deposit_ledger  ENABLE ROW LEVEL SECURITY;

-- unit_charge_configs: manager manages their own
DROP POLICY IF EXISTS "manager_manages_unit_charges" ON public.unit_charge_configs;
CREATE POLICY "manager_manages_unit_charges"
  ON public.unit_charge_configs FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- invoice_line_items: tenant reads own invoices' lines
DROP POLICY IF EXISTS "tenant_reads_own_line_items" ON public.invoice_line_items;
CREATE POLICY "tenant_reads_own_line_items"
  ON public.invoice_line_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE tenant_id = auth.uid()
    )
  );

-- invoice_line_items: manager manages their invoices' lines
DROP POLICY IF EXISTS "manager_manages_line_items" ON public.invoice_line_items;
CREATE POLICY "manager_manages_line_items"
  ON public.invoice_line_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE manager_id = auth.uid()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE manager_id = auth.uid()
    )
  );

-- deposit_ledger: manager manages; tenant reads own
DROP POLICY IF EXISTS "manager_manages_deposits" ON public.unit_deposit_ledger;
CREATE POLICY "manager_manages_deposits"
  ON public.unit_deposit_ledger FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "tenant_reads_own_deposits" ON public.unit_deposit_ledger;
CREATE POLICY "tenant_reads_own_deposits"
  ON public.unit_deposit_ledger FOR SELECT
  USING (tenant_id = auth.uid());

-- ── 8. Updated_at triggers ───────────────────────────────────
DROP TRIGGER IF EXISTS unit_charge_configs_updated_at ON public.unit_charge_configs;
CREATE TRIGGER unit_charge_configs_updated_at
  BEFORE UPDATE ON public.unit_charge_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 9. Seed default charge configs for existing units ────────
-- Insert rent charge for every unit that has monthly_rent set
-- (managers can run this manually or it runs on migration)
INSERT INTO public.unit_charge_configs (unit_id, property_id, manager_id, charge_type, charge_label, amount, auto_generate)
SELECT
  u.id,
  u.property_id,
  p.manager_id,
  'rent',
  'Monthly Rent',
  COALESCE(u.monthly_rent, p.rent_per_house, 0),
  true
FROM public.units u
JOIN public.properties p ON p.id = u.property_id
JOIN auth.users ON auth.users.id = p.manager_id
WHERE p.manager_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.unit_charge_configs
    WHERE unit_id = u.id AND charge_type = 'rent'
  );
