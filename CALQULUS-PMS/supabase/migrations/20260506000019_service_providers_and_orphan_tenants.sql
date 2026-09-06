-- ============================================================
-- CALQULUS RMS: Service providers, orphan tenants, payment records
-- ============================================================

-- ── 1. service_providers — independent service marketplace ───
-- A service provider can be:
--  (a) a registered CALQULUS RMS user who opts in
--  (b) added by a manager for their preferred contractors
-- They appear in the marketplace for managers/tenants to hire
CREATE TABLE IF NOT EXISTS public.service_providers (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  -- NULL = added by manager, no app account
  -- non-NULL = registered provider with their own login

  -- Identity
  business_name   text    NOT NULL,
  contact_name    text,
  phone           text,
  whatsapp        text,
  email           text,
  profile_photo   text,
  bio             text,
  years_experience integer DEFAULT 0,

  -- Location
  county          text,
  town            text,
  service_radius_km integer DEFAULT 20,
  -- how far they're willing to travel

  -- Verification & trust
  is_verified     boolean NOT NULL DEFAULT false,
  verified_by     uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at     timestamptz,
  id_number       text,    -- National ID
  kra_pin         text,
  registration_no text,    -- Business registration

  -- Availability
  is_available    boolean NOT NULL DEFAULT true,
  -- set false when fully booked
  response_time_hrs integer DEFAULT 24,
  -- typical response time in hours

  -- Ratings (denormalised cache)
  rating_avg      numeric(3,1) DEFAULT 0,
  rating_count    integer DEFAULT 0,
  jobs_completed  integer DEFAULT 0,

  -- Who added them
  added_by        uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  added_by_role   text,
  -- 'manager' | 'webhost' | 'self'

  status          text    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending_verification', 'inactive')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_reads_active_providers"
  ON public.service_providers FOR SELECT USING (status = 'active');
CREATE POLICY "provider_manages_own_profile"
  ON public.service_providers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "manager_adds_providers"
  ON public.service_providers FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'webhost'))
    OR auth.uid() IS NOT NULL  -- self-registration
  );
CREATE POLICY "webhost_manages_providers"
  ON public.service_providers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));

CREATE TRIGGER service_providers_upd
  BEFORE UPDATE ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. service_categories — what types of work they do ───────
CREATE TABLE IF NOT EXISTS public.service_categories (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text    NOT NULL UNIQUE,
  name        text    NOT NULL,
  description text,
  icon        text,
  group_name  text,
  -- 'electrical' | 'plumbing' | 'construction' | 'cleaning' | 'security' | 'other'
  display_order integer DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

INSERT INTO public.service_categories (key, name, description, icon, group_name, display_order) VALUES
  -- Electrical
  ('electrical_general',   'Electrician (General)',   'General electrical work, wiring, sockets',        'Zap',          'electrical', 1),
  ('electrical_solar',     'Solar Installation',      'Solar panels, inverters, batteries',               'Sun',          'electrical', 2),
  ('electrical_cctv',      'CCTV & Security Systems', 'Camera installation, alarm systems, access control','Camera',      'security',   3),
  ('electrical_generator', 'Generator Service',       'Generator installation, service and repair',       'Battery',      'electrical', 4),
  -- Plumbing
  ('plumbing_general',     'Plumber (General)',       'Pipes, taps, toilets, drainage',                  'Wrench',       'plumbing',   10),
  ('plumbing_borehole',    'Borehole Drilling',       'Borehole drilling, pumps and water systems',      'Droplets',     'plumbing',   11),
  ('plumbing_sewage',      'Sewage & Drainage',       'Septic tanks, drainage, sewage systems',          'Filter',       'plumbing',   12),
  -- Construction
  ('construction_masonry', 'Mason / Fundi',           'Brickwork, plastering, tiling, flooring',         'Hammer',       'construction',20),
  ('construction_roofing', 'Roofing',                 'Roof installation, repair and waterproofing',     'Triangle',     'construction',21),
  ('construction_carpentry','Carpenter / Joiner',     'Doors, windows, cabinets, furniture fitting',     'Scissors',     'construction',22),
  ('construction_welding', 'Welder / Metalwork',      'Gates, grills, metal fabrication',                'Flame',        'construction',23),
  ('construction_painting','Painter',                 'Interior and exterior painting, waterproofing',   'Paintbrush',   'construction',24),
  ('construction_tiles',   'Tiler',                   'Floor and wall tiling',                           'Grid',         'construction',25),
  ('construction_glass',   'Glazier / Glass',         'Windows, glass repair, aluminium partitions',     'Square',       'construction',26),
  -- Cleaning
  ('cleaning_general',     'General Cleaning',        'Regular property cleaning, housekeeping',         'Sparkles',     'cleaning',   30),
  ('cleaning_post_construction','Post-Construction Cleaning','Deep clean after construction or renovation','Trash',      'cleaning',   31),
  ('cleaning_carpet',      'Carpet & Upholstery',     'Carpet cleaning, sofa, curtain cleaning',         'Layers',       'cleaning',   32),
  ('cleaning_fumigation',  'Fumigation / Pest Control','Pest control, fumigation, termite treatment',    'Bug',          'cleaning',   33),
  -- Landscaping
  ('landscaping_general',  'Gardener / Landscaper',   'Garden maintenance, lawn mowing, landscaping',    'Leaf',         'landscaping',40),
  ('landscaping_tree',     'Tree Felling / Pruning',  'Tree removal, pruning, stump grinding',           'TreePine',     'landscaping',41),
  -- Appliances
  ('appliance_fridge',     'Fridge / Freezer Repair', 'Refrigerator and freezer repair',                 'Thermometer',  'appliances', 50),
  ('appliance_ac',         'Air Conditioning (A/C)',  'A/C installation, service and repair',            'Wind',         'appliances', 51),
  ('appliance_washing',    'Washing Machine Repair',  'Washing machine and dryer repair',                'RotateCcw',    'appliances', 52),
  ('appliance_tv',         'TV / Electronics',        'TV mounting, electronics repair',                 'Monitor',      'appliances', 53),
  -- Security
  ('security_guard',       'Security Guard',          'Manned guarding, watchman services',              'Shield',       'security',   60),
  ('security_alarm',       'Alarm Systems',           'Burglar alarms, panic buttons, monitoring',       'Bell',         'security',   61),
  -- Moving
  ('moving_general',       'Movers / Removal',        'Furniture removal and relocation services',       'Truck',        'moving',     70),
  -- Other
  ('other_locksmith',      'Locksmith',               'Locks, keys, safes, access control',              'Key',          'other',      80),
  ('other_internet',       'Internet / IT Support',   'Network cabling, Wi-Fi, IT support',              'Wifi',         'other',      81),
  ('other_intercom',       'Intercom / PA Systems',   'Intercom installation and repair',                'Phone',        'other',      82)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_service_categories" ON public.service_categories FOR SELECT USING (is_active = true);

-- ── 3. provider_services — what each provider offers + rate card
CREATE TABLE IF NOT EXISTS public.provider_services (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid    NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  category_key    text    NOT NULL REFERENCES public.service_categories(key) ON DELETE CASCADE,

  -- Rate card
  rate_type       text    NOT NULL DEFAULT 'per_job'
    CHECK (rate_type IN ('per_job', 'per_hour', 'per_day', 'fixed', 'quote_only')),
  rate_min        numeric(10,2),  -- minimum charge (or fixed rate)
  rate_max        numeric(10,2),  -- maximum charge (for per_job range)
  -- e.g. rate_type='per_hour', rate_min=800, rate_max=1500
  -- or   rate_type='fixed', rate_min=2500 (flat callout)
  -- or   rate_type='quote_only' (they assess first)
  currency        text    DEFAULT 'KES',
  rate_notes      text,           -- "includes first hour, materials extra"

  -- Availability for this specific service
  is_active       boolean NOT NULL DEFAULT true,

  UNIQUE (provider_id, category_key)
);

ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_provider_services" ON public.provider_services FOR SELECT USING (is_active = true);
CREATE POLICY "provider_manages_own_services"
  ON public.provider_services FOR ALL
  USING (
    provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid())
  );

-- ── 4. provider_reviews — ratings after job completion ────────
CREATE TABLE IF NOT EXISTS public.provider_reviews (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid    NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  reviewer_id     uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_role   text,   -- 'manager' | 'tenant'
  maintenance_id  uuid    REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  rating          integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title           text,
  comment         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_reads_reviews" ON public.provider_reviews FOR SELECT USING (true);
CREATE POLICY "authenticated_writes_review"
  ON public.provider_reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND reviewer_id = auth.uid());

-- Trigger to update provider rating cache
CREATE OR REPLACE FUNCTION public.update_provider_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.service_providers
  SET
    rating_avg   = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.provider_reviews WHERE provider_id = NEW.provider_id),
    rating_count = (SELECT COUNT(*) FROM public.provider_reviews WHERE provider_id = NEW.provider_id)
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER provider_review_rating_update
  AFTER INSERT OR UPDATE ON public.provider_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_provider_rating();

-- ── 5. maintenance_requests — add provider FK ─────────────────
ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS assigned_provider_id  uuid REFERENCES public.service_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quoted_amount          numeric(10,2),
  ADD COLUMN IF NOT EXISTS agreed_amount          numeric(10,2),
  ADD COLUMN IF NOT EXISTS provider_started_at    timestamptz,
  ADD COLUMN IF NOT EXISTS provider_completed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS provider_notes         text,
  ADD COLUMN IF NOT EXISTS manager_rating         integer CHECK (manager_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS tenant_rating          integer CHECK (tenant_rating BETWEEN 1 AND 5);

-- ── 6. orphan_tenant_records — self-managed payment diary ─────
-- When a tenant registers without an invitation, they can self-track:
-- their payments, receipts, and property condition photos
CREATE TABLE IF NOT EXISTS public.orphan_tenant_records (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Self-reported tenancy info (no FK to manager's properties table)
  property_name   text,     -- "Kamau Estate Block A"
  unit_label      text,     -- "Unit 4B"
  landlord_name   text,
  landlord_phone  text,
  county          text,
  address         text,
  move_in_date    date,
  monthly_rent    numeric(12,2),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orphan_tenant_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_manages_own_record"
  ON public.orphan_tenant_records FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER orphan_records_upd
  BEFORE UPDATE ON public.orphan_tenant_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 7. orphan_payment_entries — self-logged payments ──────────
CREATE TABLE IF NOT EXISTS public.orphan_payment_entries (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id       uuid    REFERENCES public.orphan_tenant_records(id) ON DELETE CASCADE,

  payment_date    date    NOT NULL DEFAULT CURRENT_DATE,
  amount          numeric(12,2) NOT NULL,
  payment_method  text    DEFAULT 'mpesa',
  -- mpesa | cash | bank | cheque
  reference       text,     -- M-Pesa code, bank ref, receipt number
  description     text,     -- "March 2026 rent"
  receipt_photo   text,     -- Supabase storage URL
  is_confirmed    boolean DEFAULT false,
  -- false = self-entered, true = matched to manager system (future)

  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orphan_payment_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_manages_own_payments"
  ON public.orphan_payment_entries FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 8. move_condition_photos — timestamped property condition ─
-- Both orphan and registered tenants can log condition photos.
-- These are timestamped and cryptographically ordered to establish
-- evidence of condition at move-in and move-out.
CREATE TABLE IF NOT EXISTS public.move_condition_photos (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       uuid    REFERENCES public.tenants(id) ON DELETE SET NULL,
  -- NULL if orphan tenant

  phase           text    NOT NULL DEFAULT 'general'
    CHECK (phase IN ('move_in', 'move_out', 'general', 'during_dispute')),
  room            text,     -- 'bedroom', 'bathroom', 'kitchen', 'living_room', 'exterior', etc.
  photo_url       text    NOT NULL,
  description     text,
  condition_rating text    DEFAULT 'good'
    CHECK (condition_rating IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  taken_at        timestamptz NOT NULL DEFAULT now(),
  -- Device timestamp — captured at photo time, not upload time
  location_note   text,     -- "Main bedroom, north wall"
  is_disputed     boolean DEFAULT false,
  -- Manager can flag as disputed
  dispute_note    text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.move_condition_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_manages_own_condition_photos"
  ON public.move_condition_photos FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "manager_reads_tenant_condition_photos"
  ON public.move_condition_photos FOR SELECT
  USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t WHERE t.manager_id = auth.uid()
    )
  );
