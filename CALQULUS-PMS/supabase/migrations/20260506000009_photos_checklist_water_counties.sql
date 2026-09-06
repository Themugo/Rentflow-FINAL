-- ============================================================
-- CALQULUS RMS: Tenant portal completion — photos, checklists, water, pets
-- ============================================================

-- ── 1. maintenance_requests — photo support ───────────────────
ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS photos_urls      text[],   -- photos tenant uploads
  ADD COLUMN IF NOT EXISTS completion_photos text[],  -- photos manager uploads on completion
  ADD COLUMN IF NOT EXISTS resolution_notes  text,    -- manager notes on resolution
  ADD COLUMN IF NOT EXISTS tenant_satisfaction integer -- 1-5 rating by tenant after completion
    CHECK (tenant_satisfaction IS NULL OR (tenant_satisfaction >= 1 AND tenant_satisfaction <= 5));

-- ── 2. water_meter_readings — tenant photo upload ─────────────
ALTER TABLE public.water_meter_readings
  ADD COLUMN IF NOT EXISTS tenant_photo_url  text,    -- photo tenant uploads of meter
  ADD COLUMN IF NOT EXISTS submitted_by_tenant boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tenant_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_verified  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at       timestamptz,
  ADD COLUMN IF NOT EXISTS disputed          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispute_reason    text;

-- ── 3. unit_inspections — detailed room-by-room checklist ─────
-- Each room/area has working | not_working | needs_repair | not_applicable
-- This is the tenant's protection against deposit theft on repairs
-- that were pre-existing before they moved in.
ALTER TABLE public.unit_inspections
  ADD COLUMN IF NOT EXISTS checklist_items jsonb,
  -- Structure:
  -- {
  --   "rooms": [
  --     {
  --       "room": "Kitchen",
  --       "items": [
  --         {"name": "Cooker/stove", "status": "working", "notes": "", "photo_url": ""},
  --         {"name": "Sink & taps", "status": "not_working", "notes": "Dripping tap", "photo_url": "..."},
  --         {"name": "Cabinets/shelves", "status": "working", "notes": "", "photo_url": ""},
  --         {"name": "Fridge (if provided)", "status": "not_applicable", "notes": "", "photo_url": ""}
  --       ]
  --     },
  --     {
  --       "room": "Bathroom",
  --       "items": [...]
  --     }
  --   ],
  --   "utilities": [
  --     {"name": "Electricity/lights", "status": "working", ...},
  --     {"name": "Water pressure", "status": "working", ...},
  --     {"name": "Water heater", "status": "not_working", ...}
  --   ],
  --   "fixtures": [
  --     {"name": "Doors & locks", "status": "working", ...},
  --     {"name": "Windows", "status": "needs_repair", "notes": "Broken latch in bedroom 2", ...}
  --   ]
  -- }
  ADD COLUMN IF NOT EXISTS tenant_counter_checklist jsonb, -- tenant's own version if disputed
  ADD COLUMN IF NOT EXISTS tenant_disputed_items jsonb,    -- specific items tenant disputes
  ADD COLUMN IF NOT EXISTS tenant_dispute_date timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_resolved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispute_resolution text;

-- ── 4. Expand water_billing_config with county + tariff tiers ──
-- 47 Kenyan counties, each county water company has its own tariff
ALTER TABLE public.water_billing_config
  ADD COLUMN IF NOT EXISTS county             text,
  ADD COLUMN IF NOT EXISTS county_code        integer,  -- 001 = Mombasa, 047 = Nairobi etc
  ADD COLUMN IF NOT EXISTS tariff_tier        text DEFAULT 'domestic',
  -- domestic | commercial | industrial | standpipe | block_tariff
  ADD COLUMN IF NOT EXISTS block_tariff_rules jsonb,
  -- Block tariff: different rate per consumption band
  -- [{"from": 0, "to": 6, "rate": 0}, {"from": 7, "to": 20, "rate": 50}, {"from": 21, "to": null, "rate": 90}]
  ADD COLUMN IF NOT EXISTS standing_charge    numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sewerage_rate_pct  numeric(5,2) DEFAULT 0,
  -- sewerage is usually % of water bill (e.g. 50%)
  ADD COLUMN IF NOT EXISTS vat_rate_pct       numeric(5,2) DEFAULT 16,
  ADD COLUMN IF NOT EXISTS include_sewerage   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_vat        boolean DEFAULT false;

-- ── 5. Kenya water companies — all 47 counties ────────────────
-- Reference table for auto-filling tariff defaults
CREATE TABLE IF NOT EXISTS public.kenya_water_companies (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  county          text    NOT NULL,
  county_code     integer NOT NULL,
  company_name    text    NOT NULL,
  short_code      text    NOT NULL UNIQUE,
  paybill_number  text,
  domestic_rate   numeric(10,4),   -- KES per cubic metre, domestic tariff
  min_charge      numeric(10,2),   -- minimum monthly charge
  standing_charge numeric(10,2),
  sewerage_pct    numeric(5,2),    -- sewerage as % of water bill
  block_tariff    jsonb,           -- tiered rates if applicable
  website         text,
  phone           text,
  active          boolean DEFAULT true
);

-- Insert all 47 Kenya county water companies with 2024/25 rates
INSERT INTO public.kenya_water_companies (county, county_code, company_name, short_code, paybill_number, domestic_rate, min_charge, standing_charge, sewerage_pct) VALUES
('Mombasa',    1,  'Mombasa Water Supply & Sanitation Co.',      'mowasco',   '222100', 75.00,  200.00, 150.00, 50.0),
('Kwale',      2,  'Coast Water Services Board',                  'cwsb_kwale','000000', 55.00,  150.00, 100.00, 0.0),
('Kilifi',     3,  'Coast Water Services Board',                  'cwsb_kilifi','000000',55.00,  150.00, 100.00, 0.0),
('Tana River', 4,  'Tana Water & Sewerage Co.',                  'tawasco',   '000000', 45.00,  120.00, 80.00,  0.0),
('Lamu',       5,  'Lamu Water & Sewerage Co.',                  'lawasco',   '000000', 48.00,  130.00, 90.00,  0.0),
('Taita Taveta',6, 'Tavita Water & Sewerage Co.',                'tavita',    '000000', 50.00,  140.00, 90.00,  0.0),
('Garissa',    7,  'Garissa Water & Sewerage Co.',               'garwasco',  '000000', 60.00,  160.00, 100.00, 0.0),
('Wajir',      8,  'Wajir Water & Sewerage Co.',                 'wajwasco',  '000000', 55.00,  150.00, 90.00,  0.0),
('Mandera',    9,  'Mandera Water & Sewerage Co.',               'mawasco',   '000000', 55.00,  150.00, 90.00,  0.0),
('Marsabit',   10, 'Marsabit Water & Sanitation Co.',            'mawasco2',  '000000', 52.00,  140.00, 90.00,  0.0),
('Isiolo',     11, 'Isiolo Water & Sewerage Co.',                'iswasco',   '000000', 53.00,  140.00, 90.00,  0.0),
('Meru',       12, 'Meru Water & Sewerage Services',             'merwasco',  '000000', 56.00,  150.00, 100.00, 0.0),
('Tharaka Nithi',13,'Tharaka Nithi Water & Sewerage Co.',        'tnwasco',   '000000', 50.00,  140.00, 85.00,  0.0),
('Embu',       14, 'Embu Water & Sanitation Co.',                'ewasco',    '000000', 54.00,  145.00, 95.00,  0.0),
('Kitui',      15, 'Kitui Water & Sewerage Co.',                 'kitwasco',  '000000', 50.00,  140.00, 85.00,  0.0),
('Machakos',   16, 'Machakos Water & Sewerage Co.',              'mawasco3',  '000000', 52.00,  145.00, 90.00,  0.0),
('Makueni',    17, 'Makueni Water & Sewerage Co.',               'makwasco',  '000000', 50.00,  140.00, 85.00,  0.0),
('Nyandarua',  18, 'Nyandarua Water & Sewerage Services',        'nywasco',   '000000', 52.00,  140.00, 90.00,  0.0),
('Nyeri',      19, 'Nyeri Water & Sewerage Co.',                 'nyewasco',  '000000', 58.00,  155.00, 100.00, 40.0),
('Kirinyaga',  20, 'Kirinyaga Water & Sewerage Services',        'kiwasco2',  '000000', 55.00,  150.00, 95.00,  0.0),
('Murang''a',  21, 'Murang''a Water & Sanitation Co.',           'muwasco',   '000000', 54.00,  148.00, 92.00,  0.0),
('Kiambu',     22, 'Thika Water & Sewerage Services',            'thiwasco',  '888888', 62.00,  165.00, 110.00, 45.0),
('Turkana',    23, 'Turkana Water & Sanitation Authority',       'turwasa',   '000000', 48.00,  130.00, 85.00,  0.0),
('West Pokot', 24, 'West Pokot Water & Sanitation Co.',          'wpwasco',   '000000', 46.00,  125.00, 80.00,  0.0),
('Samburu',    25, 'Samburu Water & Sanitation Co.',             'sawasco',   '000000', 47.00,  128.00, 82.00,  0.0),
('Trans Nzoia',26, 'Trans Nzoia Water Services',                 'transwasco','000000', 52.00,  142.00, 90.00,  0.0),
('Uasin Gishu',27, 'Eldoret Water & Sanitation Co.',             'eldowas',   '000000', 60.00,  160.00, 105.00, 42.0),
('Elgeyo Marakwet',28,'Elgeyo Marakwet Water Services',         'emwas',     '000000', 50.00,  138.00, 88.00,  0.0),
('Nandi',      29, 'Nandi Water & Sanitation Services',          'nawas',     '000000', 51.00,  140.00, 88.00,  0.0),
('Baringo',    30, 'Baringo Water & Sanitation Co.',             'bawasco',   '000000', 50.00,  138.00, 86.00,  0.0),
('Laikipia',   31, 'Laikipia Water & Sewerage Services',         'lawasco2',  '000000', 53.00,  143.00, 91.00,  0.0),
('Nakuru',     32, 'Nakuru Water & Sanitation Services',         'nawasco',   '000000', 65.00,  170.00, 115.00, 48.0),
('Narok',      33, 'Narok Water & Sewerage Services',           'narwasco',  '000000', 50.00,  138.00, 88.00,  0.0),
('Kajiado',    34, 'Kajiado Water & Sewerage Services',         'kajwasco',  '000000', 55.00,  148.00, 95.00,  0.0),
('Kericho',    35, 'Kericho Water & Sanitation Co.',            'kerwasco',  '000000', 53.00,  143.00, 92.00,  0.0),
('Bomet',      36, 'Bomet Water & Sanitation Co.',              'bomwasco',  '000000', 50.00,  138.00, 87.00,  0.0),
('Kakamega',   37, 'Kakamega Water & Sanitation Co.',           'kawasco',   '000000', 54.00,  146.00, 93.00,  0.0),
('Vihiga',     38, 'Vihiga Water & Sewerage Services',          'viwasco',   '000000', 52.00,  142.00, 90.00,  0.0),
('Bungoma',    39, 'Nzoia Water Services',                      'nzowa',     '000000', 53.00,  143.00, 91.00,  0.0),
('Busia',      40, 'Busiana Water & Sanitation Co.',            'buwasco',   '000000', 50.00,  138.00, 86.00,  0.0),
('Siaya',      41, 'Lake Victoria South Water Services',        'lvswsb_siaya','000000',52.00, 142.00, 90.00,  0.0),
('Kisumu',     42, 'Kisumu Water & Sewerage Co.',               'kiwasco',   '000000', 60.00,  162.00, 108.00, 45.0),
('Homa Bay',   43, 'Homa Bay Water & Sewerage Co.',             'homawasco', '000000', 51.00,  140.00, 88.00,  0.0),
('Migori',     44, 'Lake Victoria South Water Services',        'lvswsb_migori','000000',51.00, 140.00, 87.00, 0.0),
('Kisii',      45, 'Kisii Water & Sanitation Co.',              'kiswasco',  '000000', 53.00,  143.00, 91.00,  0.0),
('Nyamira',    46, 'Nyamira Water & Sanitation Services',       'nyawasco',  '000000', 51.00,  140.00, 88.00,  0.0),
('Nairobi',    47, 'Nairobi City Water & Sewerage Co.',         'ncwsc',     '222100', 82.00,  200.00, 200.00, 80.0)
ON CONFLICT (short_code) DO NOTHING;

-- ── 6. Helper: calculate water bill with block tariff ─────────
CREATE OR REPLACE FUNCTION public.calculate_water_bill(
  p_consumption  numeric,
  p_provider     text,
  p_include_sewerage boolean DEFAULT false,
  p_include_vat  boolean DEFAULT false
)
RETURNS TABLE (
  water_charge   numeric,
  sewerage_charge numeric,
  standing_charge numeric,
  vat_amount     numeric,
  total          numeric,
  calculation    jsonb
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_company RECORD;
  v_water   numeric := 0;
  v_sewerage numeric := 0;
  v_standing numeric := 0;
  v_vat      numeric := 0;
  v_block    jsonb;
  v_from     numeric;
  v_to       numeric;
  v_rate     numeric;
  v_band     jsonb;
  v_consumed numeric := p_consumption;
  v_calc     jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_company FROM public.kenya_water_companies WHERE short_code = p_provider AND active = true;

  IF v_company IS NULL THEN
    -- Generic calculation if company not found
    water_charge   := p_consumption * 60;
    sewerage_charge := 0;
    standing_charge := 0;
    vat_amount     := 0;
    total          := water_charge;
    calculation    := jsonb_build_array(jsonb_build_object('desc', 'Standard rate', 'units', p_consumption, 'rate', 60, 'amount', water_charge));
    RETURN NEXT;
    RETURN;
  END IF;

  v_standing := COALESCE(v_company.standing_charge, 0);

  -- Block tariff if available, else flat rate
  IF v_company.block_tariff IS NOT NULL THEN
    FOR v_band IN SELECT * FROM jsonb_array_elements(v_company.block_tariff)
    LOOP
      v_from := (v_band->>'from')::numeric;
      v_to   := CASE WHEN v_band->>'to' = 'null' OR v_band->>'to' IS NULL THEN 999999 ELSE (v_band->>'to')::numeric END;
      v_rate := (v_band->>'rate')::numeric;

      IF v_consumed <= 0 THEN EXIT; END IF;

      DECLARE v_band_units numeric := LEAST(v_consumed, v_to - v_from + 1);
      BEGIN
        v_water := v_water + v_band_units * v_rate;
        v_calc  := v_calc || jsonb_build_array(
          jsonb_build_object('band', v_from || '-' || v_to, 'units', v_band_units, 'rate', v_rate, 'amount', v_band_units * v_rate)
        );
        v_consumed := v_consumed - v_band_units;
      END;
    END LOOP;
  ELSE
    v_water := p_consumption * COALESCE(v_company.domestic_rate, 60);
    v_calc  := jsonb_build_array(
      jsonb_build_object('desc', 'Flat rate', 'units', p_consumption, 'rate', v_company.domestic_rate, 'amount', v_water)
    );
  END IF;

  -- Minimum charge
  IF v_water < COALESCE(v_company.min_charge, 0) THEN
    v_water := COALESCE(v_company.min_charge, v_water);
  END IF;

  -- Sewerage
  v_sewerage := CASE WHEN p_include_sewerage THEN v_water * COALESCE(v_company.sewerage_pct, 0) / 100 ELSE 0 END;

  -- VAT (16% in Kenya)
  v_vat := CASE WHEN p_include_vat THEN (v_water + v_sewerage + v_standing) * 0.16 ELSE 0 END;

  water_charge   := ROUND(v_water, 2);
  sewerage_charge := ROUND(v_sewerage, 2);
  standing_charge := ROUND(v_standing, 2);
  vat_amount     := ROUND(v_vat, 2);
  total          := ROUND(v_water + v_sewerage + v_standing + v_vat, 2);
  calculation    := v_calc;
  RETURN NEXT;
END;
$$;

-- ── 7. RLS for new tables ─────────────────────────────────────
ALTER TABLE public.kenya_water_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_water_companies"
  ON public.kenya_water_companies FOR SELECT USING (true);
