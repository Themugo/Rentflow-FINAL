-- ============================================================
-- CALQULUS RMS: Property type taxonomy + category-based billing
-- ============================================================

-- ── 1. property_categories — the top-level grouping ───────────
-- Each property belongs to one category. Category determines:
-- (a) what unit types are available
-- (b) the billing rate multiplier applied to the tier price
CREATE TABLE IF NOT EXISTS public.property_categories (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text    NOT NULL UNIQUE,
  name            text    NOT NULL,
  description     text,
  icon            text,                      -- lucide icon name
  color           text,                      -- tailwind color key
  billing_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  -- e.g. 1.0 = base rate, 1.5 = 50% premium, 2.0 = double
  requires_tier   text    DEFAULT 'lite',
  -- 'lite' | 'pro' | 'enterprise' — which tier unlocks this category
  is_active       boolean NOT NULL DEFAULT true,
  display_order   integer NOT NULL DEFAULT 0
);

INSERT INTO public.property_categories
  (key, name, description, icon, color, billing_multiplier, requires_tier, display_order)
VALUES
  -- ── Residential ────────────────────────────────────────────
  ('residential_flat',      'Flat / Apartment Block',   'Multi-unit residential building with self-contained flats',          'Building2',   'blue',   1.0,  'lite',       1),
  ('residential_bedsitter', 'Bedsitter Block',          'Building with bedsitter / single-room units',                        'Home',        'sky',    0.9,  'lite',       2),
  ('residential_studio',    'Studio Apartments',        'Purpose-built studio units',                                         'Square',      'cyan',   1.0,  'lite',       3),
  ('residential_bungalow',  'Bungalow / Maisonette',   'Standalone bungalows or maisonettes on one compound',                'House',       'green',  1.1,  'lite',       4),
  ('residential_townhouse', 'Townhouse / Row House',    'Terraced or semi-detached townhouses',                               'LayoutGrid',  'teal',   1.1,  'lite',       5),
  ('residential_villa',     'Villa',                    'High-end detached residential property',                             'Star',        'violet', 1.3,  'pro',        6),
  ('residential_estate',    'Gated Estate',             'Managed residential estate with shared amenities, security, CCTV',   'Shield',      'purple', 1.4,  'pro',        7),
  ('residential_servant',   'Servant Quarters / SQ',   'Attached servant quarters or caretaker units',                       'Users',       'slate',  0.7,  'lite',       8),

  -- ── Commercial ─────────────────────────────────────────────
  ('commercial_office',     'Office Block',             'Multi-floor commercial office building',                             'Briefcase',   'amber',  2.0,  'pro',        10),
  ('commercial_retail',     'Retail / Shop Space',      'Ground-floor retail shops or shopping complex',                      'ShoppingBag', 'orange', 1.8,  'pro',        11),
  ('commercial_warehouse',  'Warehouse / Godown',       'Industrial storage or godown / warehouse',                           'Package',     'stone',  1.6,  'pro',        12),
  ('commercial_market',     'Market Stalls',            'Open-air or covered market with multiple stalls',                    'Store',       'yellow', 1.5,  'pro',        13),
  ('commercial_showroom',   'Showroom / Dealership',    'Car showroom, equipment dealership or display space',                'Layers',      'red',    1.8,  'pro',        14),
  ('commercial_hotel',      'Hotel / Serviced Apt',     'Hotel, guesthouse or fully serviced apartments',                     'Building',    'rose',   2.5,  'enterprise', 15),
  ('commercial_hospital',   'Hospital / Medical',       'Medical facility, clinic or hospital',                               'Heart',       'pink',   2.2,  'enterprise', 16),
  ('commercial_school',     'School / Education',       'School, college, training centre or educational facility',           'BookOpen',    'indigo', 1.9,  'pro',        17),
  ('commercial_filling',    'Petrol Station / Filling', 'Fuel station or service station',                                    'Zap',         'lime',   2.0,  'pro',        18),
  ('commercial_restaurant', 'Restaurant / Food Court',  'Restaurant, food court or hospitality venue',                        'Utensils',    'amber',  1.7,  'pro',        19),

  -- ── Mixed Use ──────────────────────────────────────────────
  ('mixed_residential_commercial', 'Mixed Use (Res + Comm)',  'Ground floor commercial, upper floors residential',            'Layers',      'violet', 1.5,  'pro',        20),
  ('mixed_office_retail',          'Mixed Office + Retail',   'Commercial building with retail and office floors',            'LayoutDashboard','blue',1.6, 'pro',        21),

  -- ── Industrial ─────────────────────────────────────────────
  ('industrial_factory',    'Factory / Manufacturing',  'Manufacturing plant or industrial production facility',              'Cog',         'zinc',   1.8,  'enterprise', 25),
  ('industrial_logistics',  'Logistics / Depot',        'Transport depot, logistics hub or distribution centre',             'Truck',       'gray',   1.7,  'enterprise', 26),
  ('industrial_cold_store', 'Cold Storage',             'Refrigerated cold storage facility',                                'Snowflake',   'blue',   2.0,  'enterprise', 27),

  -- ── Land / Plots ───────────────────────────────────────────
  ('land_plot',             'Plot / Land',              'Undeveloped land or building plot',                                  'Map',         'green',  0.8,  'lite',       30),
  ('land_farm',             'Farm / Agricultural',      'Farm, agricultural land or greenhouse',                             'Leaf',        'emerald',0.8,  'lite',       31),
  ('land_parking',          'Parking / Car Park',       'Dedicated parking facility or car park',                             'Car',         'slate',  1.0,  'lite',       32)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.property_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_categories"
  ON public.property_categories FOR SELECT USING (is_active = true);
CREATE POLICY "webhost_manages_categories"
  ON public.property_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));

-- ── 2. Extend properties table ────────────────────────────────
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS category_key     text REFERENCES public.property_categories(key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sub_type         text,  -- free text sub-classification
  ADD COLUMN IF NOT EXISTS year_built       integer,
  ADD COLUMN IF NOT EXISTS total_area_sqm   numeric(10,2),
  ADD COLUMN IF NOT EXISTS county           text,
  ADD COLUMN IF NOT EXISTS location_lat     numeric(10,6),
  ADD COLUMN IF NOT EXISTS location_lng     numeric(10,6),
  ADD COLUMN IF NOT EXISTS amenities        jsonb,  -- ["parking", "gym", "pool", "generator", "borehole", "cctv"]
  ADD COLUMN IF NOT EXISTS is_gated         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_lift         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_backup_power boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_borehole     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_furnished_units boolean DEFAULT false;

-- Migrate existing property_type → category_key where possible
UPDATE public.properties SET category_key = CASE property_type
  WHEN 'flat'       THEN 'residential_flat'
  WHEN 'apartment'  THEN 'residential_flat'
  WHEN 'bungalow'   THEN 'residential_bungalow'
  WHEN 'villa'      THEN 'residential_villa'
  WHEN 'townhouse'  THEN 'residential_townhouse'
  WHEN 'commercial' THEN 'commercial_office'
  WHEN 'mixed_use'  THEN 'mixed_residential_commercial'
  ELSE 'residential_flat'
END
WHERE category_key IS NULL;

-- ── 3. property_tier_limits — per-tier limits by category ─────
-- Replaces the flat max_properties on subscription_tiers with
-- per-category limits. A Lite manager can have 5 residential
-- properties but 0 commercial. A Pro manager can have 20 of any type.
CREATE TABLE IF NOT EXISTS public.property_tier_limits (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key        text    NOT NULL,
  category_group  text    NOT NULL,  -- 'residential' | 'commercial' | 'industrial' | 'mixed' | 'land' | 'any'
  max_properties  integer NOT NULL DEFAULT 0,
  -- 0 = not allowed on this tier
  -- 999 = unlimited
  price_multiplier numeric(4,2) NOT NULL DEFAULT 1.0,
  -- base tier price × multiplier = actual price for this category group
  UNIQUE (tier_key, category_group)
);

INSERT INTO public.property_tier_limits (tier_key, category_group, max_properties, price_multiplier) VALUES
  -- LITE — residential only, 10 properties max
  ('lite',         'residential',  10,   1.0),
  ('lite',         'commercial',    0,   0.0),   -- not allowed
  ('lite',         'industrial',    0,   0.0),   -- not allowed
  ('lite',         'mixed',         0,   0.0),   -- not allowed
  ('lite',         'land',          5,   0.8),
  ('lite',         'any',          10,   1.0),

  -- PRO — all types, 50 properties, commercial premium
  ('pro',          'residential',  50,   1.0),
  ('pro',          'commercial',   20,   1.8),   -- 80% premium
  ('pro',          'industrial',    5,   1.6),
  ('pro',          'mixed',        10,   1.4),
  ('pro',          'land',         20,   0.8),
  ('pro',          'any',          50,   1.0),

  -- ENTERPRISE — unlimited, all types, custom commercial rate
  ('enterprise',   'residential', 999,   1.0),
  ('enterprise',   'commercial',  999,   1.5),   -- 50% premium (volume discount vs Pro)
  ('enterprise',   'industrial',  999,   1.4),
  ('enterprise',   'mixed',       999,   1.3),
  ('enterprise',   'land',        999,   0.8),
  ('enterprise',   'any',         999,   1.0)
ON CONFLICT (tier_key, category_group) DO NOTHING;

ALTER TABLE public.property_tier_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhost_manages_tier_limits"
  ON public.property_tier_limits FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));
CREATE POLICY "public_reads_tier_limits"
  ON public.property_tier_limits FOR SELECT USING (true);

-- ── 4. Rebuild subscription_tiers for Lite / Pro / Enterprise ─
-- Rename and restructure the tiers
INSERT INTO public.subscription_tiers (tier_key, name, description, max_properties, max_units, price_per_property, features, display_order)
VALUES
  ('lite',       'Lite',       'Individual managers — residential only, up to 10 properties',      10,  100, 400,
   '["M-Pesa STK push","Tenant portal","Basic invoicing","Email support","Water billing","Up to 10 residential properties"]', 1),
  ('pro',        'Pro',        'Growing agencies — all property types, up to 50 properties',        50,  500, 600,
   '["All Lite features","Commercial properties","Bank reconciliation","Submanager accounts","Custom reports","Priority support","Bulk SMS & WhatsApp"]', 2),
  ('enterprise', 'Enterprise', 'Large agencies — unlimited properties, custom pricing, white label', 999, 9999, 500,
   '["All Pro features","Unlimited properties","All commercial & industrial types","White label branding","API access","Dedicated account manager","SLA guarantee","Custom integrations"]', 3)
ON CONFLICT (tier_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  max_properties = EXCLUDED.max_properties,
  max_units = EXCLUDED.max_units,
  price_per_property = EXCLUDED.price_per_property,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order;

-- ── 5. get_category_group() helper function ───────────────────
CREATE OR REPLACE FUNCTION public.get_category_group(p_category_key text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE
    WHEN p_category_key LIKE 'residential_%' THEN 'residential'
    WHEN p_category_key LIKE 'commercial_%'  THEN 'commercial'
    WHEN p_category_key LIKE 'industrial_%'  THEN 'industrial'
    WHEN p_category_key LIKE 'mixed_%'       THEN 'mixed'
    WHEN p_category_key LIKE 'land_%'        THEN 'land'
    ELSE 'residential'
  END;
END;
$$;

-- ── 6. calculate_property_billing_rate() ─────────────────────
-- Given a manager's tier and a property's category, return the KES/month charge
CREATE OR REPLACE FUNCTION public.calculate_property_billing_rate(
  p_tier_key      text,
  p_category_key  text
) RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_base_rate     numeric;
  v_multiplier    numeric;
  v_cat_group     text;
BEGIN
  -- Get base rate from subscription_tiers
  SELECT price_per_property INTO v_base_rate
  FROM public.subscription_tiers WHERE tier_key = p_tier_key;

  v_base_rate := COALESCE(v_base_rate, 500);
  v_cat_group := public.get_category_group(p_category_key);

  -- Get multiplier from property_tier_limits
  SELECT price_multiplier INTO v_multiplier
  FROM public.property_tier_limits
  WHERE tier_key = p_tier_key AND category_group = v_cat_group;

  v_multiplier := COALESCE(v_multiplier, 1.0);

  -- Also apply category billing_multiplier
  SELECT v_multiplier * pc.billing_multiplier INTO v_multiplier
  FROM public.property_categories pc
  WHERE pc.key = p_category_key;

  RETURN ROUND(v_base_rate * COALESCE(v_multiplier, 1.0), 0);
END;
$$;

-- ── 7. check_tier_allows_property() ──────────────────────────
-- Returns true if the manager's tier allows adding a property of this category
CREATE OR REPLACE FUNCTION public.check_tier_allows_property(
  p_manager_id    uuid,
  p_category_key  text
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_tier          text;
  v_cat_group     text;
  v_max_allowed   integer;
  v_current_count integer;
BEGIN
  -- Get manager tier
  SELECT subscription_tier INTO v_tier
  FROM public.manager_profiles WHERE manager_user_id = p_manager_id;

  v_tier := COALESCE(v_tier, 'lite');
  v_cat_group := public.get_category_group(p_category_key);

  -- Check category-specific limit
  SELECT max_properties INTO v_max_allowed
  FROM public.property_tier_limits
  WHERE tier_key = v_tier AND category_group = v_cat_group;

  IF COALESCE(v_max_allowed, 0) = 0 THEN
    RETURN false; -- category not allowed on this tier
  END IF;

  IF v_max_allowed >= 999 THEN
    RETURN true; -- unlimited
  END IF;

  -- Count current properties of this category group
  SELECT COUNT(*) INTO v_current_count
  FROM public.properties p
  JOIN public.property_categories pc ON pc.key = p.category_key
  WHERE p.manager_id = p_manager_id
    AND p.status = 'active'
    AND public.get_category_group(pc.key) = v_cat_group;

  RETURN v_current_count < v_max_allowed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_group TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_property_billing_rate TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_tier_allows_property TO authenticated;
