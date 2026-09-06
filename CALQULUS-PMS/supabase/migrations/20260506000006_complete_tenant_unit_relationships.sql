-- ============================================================
-- CALQULUS RMS: Complete tenant-unit relationship layer
-- Covers every relationship most property management systems miss.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: THIRD-PARTY & MULTI-UNIT PAYMENT FLOWS
-- ══════════════════════════════════════════════════════════════

-- ── 1a. payment_payers ───────────────────────────────────────
-- Tracks who actually pays rent — could be the tenant, an employer,
-- a parent/guardian, a housing association, or any third party.
-- One tenant can have multiple payers (partial splits).
CREATE TABLE IF NOT EXISTS public.payment_payers (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  manager_id        uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id       uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id           uuid    REFERENCES public.units(id) ON DELETE SET NULL,

  payer_type        text    NOT NULL DEFAULT 'self'
    CHECK (payer_type IN (
      'self',          -- tenant pays directly
      'employer',      -- employer/company pays on behalf
      'guarantor',     -- guarantor steps in when tenant defaults
      'parent',        -- parent/guardian pays
      'housing_assoc', -- housing association / government housing
      'split',         -- multiple payers share the rent
      'custom'
    )),

  -- Payer identity (for non-self payers)
  payer_name        text,
  payer_email       text,
  payer_phone       text,
  payer_organisation text,  -- company name / association name
  payer_address     text,
  national_id       text,   -- payer's ID number

  -- Financial arrangement
  pays_amount       numeric(12,2),         -- fixed amount this payer covers (NULL = full)
  pays_percentage   numeric(5,2),          -- or percentage (e.g. 60%)
  payment_day       integer CHECK (payment_day BETWEEN 1 AND 31), -- day of month they pay
  preferred_method  text DEFAULT 'mpesa',  -- mpesa | bank | cheque | standing_order
  mpesa_number      text,
  bank_account      text,
  bank_name         text,
  standing_order_ref text,  -- bank standing order reference

  -- Authorisation proof
  letter_of_undertaking_url text,  -- uploaded authorisation letter
  contract_url        text,

  is_active         boolean NOT NULL DEFAULT true,
  start_date        date,
  end_date          date,          -- NULL = ongoing
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pp_tenant_idx  ON public.payment_payers(tenant_id);
CREATE INDEX IF NOT EXISTS pp_manager_idx ON public.payment_payers(manager_id);

-- ── 1b. multi_unit_tenants ────────────────────────────────────
-- A tenant (or company) can occupy/pay for more than one unit.
-- Examples: a company rents multiple units for staff housing;
--           a landlord's relative occupies two adjacent units.
CREATE TABLE IF NOT EXISTS public.tenant_unit_links (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id     uuid    NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  property_id uuid    NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  manager_id  uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  link_type   text    NOT NULL DEFAULT 'primary'
    CHECK (link_type IN (
      'primary',   -- main/original unit
      'secondary', -- additional unit same tenant
      'storage',   -- storage unit
      'parking',   -- parking bay
      'shop',      -- commercial unit
      'staff'      -- unit occupied by employee of the primary tenant
    )),
  monthly_rent  numeric(12,2),  -- may differ from unit's default rent
  move_in_date  date,
  move_out_date date,
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, unit_id)
);

CREATE INDEX IF NOT EXISTS tul_tenant_idx ON public.tenant_unit_links(tenant_id);
CREATE INDEX IF NOT EXISTS tul_unit_idx   ON public.tenant_unit_links(unit_id);

-- Extend payment_transactions to record who paid (payer vs tenant)
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS paid_by_payer_id  uuid REFERENCES public.payment_payers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_name         text,  -- denormalised for display
  ADD COLUMN IF NOT EXISTS payer_type         text,  -- 'self' | 'employer' | etc.
  ADD COLUMN IF NOT EXISTS payer_phone        text,  -- number that actually paid
  ADD COLUMN IF NOT EXISTS covers_unit_ids    uuid[], -- for multi-unit consolidated payments
  ADD COLUMN IF NOT EXISTS split_invoice_ids  uuid[]; -- if one payment covers multiple invoices

-- ══════════════════════════════════════════════════════════════
-- SECTION 2: DEPOSIT ACCOUNTABILITY (full audit, who did what)
-- ══════════════════════════════════════════════════════════════

-- ── 2a. Extend deposit_deductions with full accountability ────
ALTER TABLE public.deposit_deductions
  ADD COLUMN IF NOT EXISTS unit_id          uuid REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenancy_id       uuid REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS performed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS performed_by_name text,  -- denormalised name for reports
  ADD COLUMN IF NOT EXISTS performed_by_role text,  -- 'manager' | 'submanager' | 'landlord'
  ADD COLUMN IF NOT EXISTS verified_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at      timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_url     text,   -- photo / receipt of damage/repair
  ADD COLUMN IF NOT EXISTS deduction_date   date,
  ADD COLUMN IF NOT EXISTS category         text DEFAULT 'general'
    CHECK (category IN (
      'general',        -- general deduction
      'cleaning',       -- professional cleaning
      'damages',        -- physical damage to unit/fixtures
      'unpaid_rent',    -- rent arrears deducted from deposit
      'unpaid_water',   -- water bill arrears
      'unpaid_bills',   -- other unpaid charges
      'key_replacement',-- lost keys / lock change
      'repainting',     -- repainting after damage
      'maintenance',    -- linked to a maintenance request
      'other'
    ));

-- ── 2b. Extend deposit_refunds with full breakdown ────────────
ALTER TABLE public.deposit_refunds
  ADD COLUMN IF NOT EXISTS unit_id          uuid REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenancy_id       uuid REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_proof_url text,    -- receipt / confirmation
  ADD COLUMN IF NOT EXISTS tenant_acknowledged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tenant_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_raised   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispute_reason   text,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz;

-- ── 2c. deposit_statement view (for PDF generation) ──────────
-- A full statement: original deposit, all deductions with who/when/why, balance, refund
CREATE OR REPLACE VIEW public.deposit_statement AS
SELECT
  dr.id                AS refund_id,
  dr.tenant_id,
  dr.unit_id,
  dr.tenancy_id,
  dr.original_deposit,
  dr.total_deductions,
  dr.final_balance,
  dr.refund_amount,
  dr.refund_method,
  dr.refund_reference,
  dr.status            AS refund_status,
  dr.move_out_date,
  dr.approved_by,
  dr.approved_at,
  dr.paid_by,
  dr.payment_proof_url,
  dr.tenant_acknowledged,
  dr.dispute_raised,
  -- Deductions as JSON array for PDF generation
  COALESCE(
    (SELECT json_agg(json_build_object(
      'id',             dd.id,
      'category',       dd.category,
      'description',    dd.description,
      'amount',         dd.amount,
      'deduction_date', dd.deduction_date,
      'performed_by_name', dd.performed_by_name,
      'performed_by_role', dd.performed_by_role,
      'verified_by',    dd.verified_by,
      'evidence_url',   dd.evidence_url,
      'maintenance_request_id', dd.maintenance_request_id
    ) ORDER BY dd.deduction_date)
    FROM public.deposit_deductions dd
    WHERE dd.tenant_id = dr.tenant_id
  ), '[]'::json) AS deductions_detail
FROM public.deposit_refunds dr;

-- ══════════════════════════════════════════════════════════════
-- SECTION 3: TENANT PROFILE — MISSING FIELDS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.tenants
  -- Identity
  ADD COLUMN IF NOT EXISTS national_id       text,
  ADD COLUMN IF NOT EXISTS id_type           text DEFAULT 'national_id',
  -- id_type: national_id | passport | alien_id | driving_license
  ADD COLUMN IF NOT EXISTS date_of_birth     date,
  ADD COLUMN IF NOT EXISTS gender            text,
  ADD COLUMN IF NOT EXISTS nationality       text,

  -- Employment
  ADD COLUMN IF NOT EXISTS employment_status text DEFAULT 'employed',
  -- employed | self_employed | student | retired | unemployed
  ADD COLUMN IF NOT EXISTS employer_name     text,
  ADD COLUMN IF NOT EXISTS employer_phone    text,
  ADD COLUMN IF NOT EXISTS employer_address  text,
  ADD COLUMN IF NOT EXISTS occupation        text,
  ADD COLUMN IF NOT EXISTS monthly_income    numeric(12,2),

  -- Emergency contact
  ADD COLUMN IF NOT EXISTS emergency_contact_name         text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone        text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,

  -- Previous tenancy reference
  ADD COLUMN IF NOT EXISTS previous_landlord_name  text,
  ADD COLUMN IF NOT EXISTS previous_landlord_phone text,
  ADD COLUMN IF NOT EXISTS previous_address        text,

  -- Documents
  ADD COLUMN IF NOT EXISTS id_document_url         text,
  ADD COLUMN IF NOT EXISTS proof_of_income_url     text,

  -- Risk / credit
  ADD COLUMN IF NOT EXISTS credit_score      integer,
  ADD COLUMN IF NOT EXISTS risk_flag         text,   -- 'clear' | 'caution' | 'blacklisted'
  ADD COLUMN IF NOT EXISTS risk_reason       text,

  -- Number of occupants (not just the main tenant)
  ADD COLUMN IF NOT EXISTS adults_count      integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS children_count    integer DEFAULT 0;

-- ══════════════════════════════════════════════════════════════
-- SECTION 4: UNIT OCCUPANCY EXTRAS
-- ══════════════════════════════════════════════════════════════

-- ── 4a. tenant_pets ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_pets (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid  NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id       uuid  REFERENCES public.units(id) ON DELETE SET NULL,
  manager_id    uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  pet_type      text  NOT NULL,  -- dog | cat | bird | rabbit | other
  breed         text,
  name          text,
  pet_deposit   numeric(12,2) DEFAULT 0,
  is_approved   boolean NOT NULL DEFAULT false,
  approved_by   uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at   timestamptz,
  notes         text,
  photo_url     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 4b. tenant_vehicles ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_vehicles (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid  NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id       uuid  REFERENCES public.units(id) ON DELETE SET NULL,
  manager_id    uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  make          text,
  model         text,
  colour        text,
  plate_number  text  NOT NULL,
  parking_bay   text,   -- assigned parking bay label
  parking_fee   numeric(12,2) DEFAULT 0,
  is_approved   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 4c. unit_key_records ─────────────────────────────────────
-- Every key/fob/card issued to a unit — tracks who has what
CREATE TABLE IF NOT EXISTS public.unit_key_records (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid  NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  property_id     uuid  REFERENCES public.properties(id) ON DELETE SET NULL,
  manager_id      uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id       uuid  REFERENCES public.tenants(id) ON DELETE SET NULL,
  tenancy_id      uuid  REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,

  key_type        text  NOT NULL DEFAULT 'door_key',
  -- door_key | gate_key | mailbox_key | fob | card | master_key | spare_key
  key_label       text,   -- e.g. "Key #3", "Red fob"
  serial_number   text,

  -- Handover
  issued_date     date,
  issued_by       uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_to_name  text,
  tenant_signature_url text,  -- signed receipt of keys

  -- Return
  returned_date   date,
  returned_to     uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  return_condition text, -- 'good' | 'damaged' | 'lost'
  replacement_cost numeric(12,2),
  deducted_from_deposit boolean DEFAULT false,

  status          text  NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'returned', 'lost', 'replaced')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ukr_unit_idx   ON public.unit_key_records(unit_id);
CREATE INDEX IF NOT EXISTS ukr_tenant_idx ON public.unit_key_records(tenant_id);

-- ── 4d. unit_inspections ─────────────────────────────────────
-- Move-in and move-out inspections — room by room with photos
CREATE TABLE IF NOT EXISTS public.unit_inspections (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid  NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  property_id     uuid  REFERENCES public.properties(id) ON DELETE SET NULL,
  manager_id      uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id       uuid  REFERENCES public.tenants(id) ON DELETE SET NULL,
  tenancy_id      uuid  REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,

  inspection_type text  NOT NULL DEFAULT 'move_in'
    CHECK (inspection_type IN ('move_in', 'move_out', 'periodic', 'maintenance', 'complaint')),
  inspection_date date  NOT NULL DEFAULT CURRENT_DATE,
  conducted_by    uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  conducted_by_name text,

  -- Overall condition ratings
  overall_condition text,  -- 'excellent' | 'good' | 'fair' | 'poor'
  cleanliness       text,
  walls_condition   text,
  floor_condition   text,
  ceiling_condition text,
  bathroom_condition text,
  kitchen_condition text,
  windows_condition text,
  doors_condition   text,

  -- Notes and evidence
  notes           text,
  photos_urls     text[],  -- array of photo URLs
  damage_found    boolean DEFAULT false,
  damage_description text,
  estimated_repair_cost numeric(12,2),

  -- Tenant acknowledgement
  tenant_present      boolean DEFAULT false,
  tenant_signature_url text,
  tenant_agreed       boolean,
  tenant_comments     text,

  -- Manager sign-off
  manager_signature_url text,
  manager_signed_at   timestamptz,

  status          text  NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'completed', 'disputed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ui_unit_idx    ON public.unit_inspections(unit_id);
CREATE INDEX IF NOT EXISTS ui_tenant_idx  ON public.unit_inspections(tenant_id);

-- ── 4e. tenant_guarantors ────────────────────────────────────
-- People who guarantee the tenant's obligations
CREATE TABLE IF NOT EXISTS public.tenant_guarantors (
  id                  uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid  NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id             uuid  REFERENCES public.units(id) ON DELETE SET NULL,
  manager_id          uuid  REFERENCES auth.users(id) ON DELETE SET NULL,

  name                text  NOT NULL,
  email               text,
  phone               text  NOT NULL,
  national_id         text,
  relationship        text,  -- 'employer' | 'parent' | 'spouse' | 'friend' | 'bank'
  employer_name       text,
  employer_phone      text,
  address             text,
  monthly_income      numeric(12,2),

  guarantee_amount    numeric(12,2),  -- max they cover
  guarantee_type      text DEFAULT 'personal',
  -- personal | corporate | bank_guarantee | insurance

  -- Documents
  id_document_url     text,
  letter_url          text,   -- letter of guarantee
  signature_url       text,

  is_active           boolean NOT NULL DEFAULT true,
  activated_at        timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tg_tenant_idx ON public.tenant_guarantors(tenant_id);

-- ── 4f. tenant_notices ───────────────────────────────────────
-- Manager → tenant notices (different from vacation notices which are tenant → manager)
-- Includes: rent increase notice, rule violation, maintenance entry notice, etc.
CREATE TABLE IF NOT EXISTS public.tenant_notices (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid  NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id         uuid  REFERENCES public.units(id) ON DELETE SET NULL,
  property_id     uuid  REFERENCES public.properties(id) ON DELETE SET NULL,
  manager_id      uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  tenancy_id      uuid  REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,

  notice_type     text  NOT NULL,
  -- rent_increase | eviction_warning | rule_violation | entry_notice
  -- maintenance_entry | lease_renewal | general | arrears_demand
  title           text  NOT NULL,
  body            text  NOT NULL,

  -- For rent increase
  current_rent    numeric(12,2),
  new_rent        numeric(12,2),
  effective_date  date,
  notice_period_days integer,

  delivery_method text  DEFAULT 'email',  -- email | sms | whatsapp | hand_delivered | posted
  sent_at         timestamptz,
  delivered_at    timestamptz,
  read_at         timestamptz,

  -- Tenant acknowledgement
  tenant_acknowledged boolean DEFAULT false,
  tenant_ack_at   timestamptz,
  tenant_response text,

  document_url    text,  -- attached formal notice document
  status          text  NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'delivered', 'acknowledged', 'disputed', 'withdrawn')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tn_tenant_idx ON public.tenant_notices(tenant_id);
CREATE INDEX IF NOT EXISTS tn_unit_idx   ON public.tenant_notices(unit_id);

-- ── 4g. tenant_blacklist ─────────────────────────────────────
-- Property-management-level risk tracking
-- (NOT a global blacklist — only visible to managers in this system)
CREATE TABLE IF NOT EXISTS public.tenant_blacklist (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid  REFERENCES public.tenants(id) ON DELETE SET NULL,
  manager_id      uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id     uuid  REFERENCES public.properties(id) ON DELETE SET NULL,

  -- Can blacklist by identifier even if not a user
  tenant_name     text,
  tenant_email    text,
  tenant_phone    text,
  national_id     text,

  reason          text  NOT NULL,
  category        text  DEFAULT 'other',
  -- rent_default | property_damage | antisocial | fraud | lease_breach | other
  severity        text  DEFAULT 'medium',  -- low | medium | high | critical

  incident_date   date,
  amount_owed     numeric(12,2) DEFAULT 0,  -- unpaid at time of blacklisting

  -- Evidence
  evidence_urls   text[],
  notes           text,

  is_active       boolean NOT NULL DEFAULT true,
  expires_at      date,   -- optional: some flags expire
  removed_at      timestamptz,
  removed_reason  text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tbl_manager_idx ON public.tenant_blacklist(manager_id);
CREATE INDEX IF NOT EXISTS tbl_email_idx   ON public.tenant_blacklist(tenant_email);
CREATE INDEX IF NOT EXISTS tbl_nid_idx     ON public.tenant_blacklist(national_id);

-- ── 4h. tenant_references ────────────────────────────────────
-- Reference letters issued by manager to outgoing tenants
CREATE TABLE IF NOT EXISTS public.tenant_references (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid  NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  manager_id      uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id         uuid  REFERENCES public.units(id) ON DELETE SET NULL,
  tenancy_id      uuid  REFERENCES public.unit_tenancy_history(id) ON DELETE SET NULL,

  reference_type  text  DEFAULT 'tenancy',  -- tenancy | character | employment
  issued_to       text,         -- name of recipient (e.g. new landlord)
  issued_to_email text,

  -- Content
  tenancy_period  text,         -- "Jan 2023 – Dec 2024"
  payment_record  text,         -- 'excellent' | 'good' | 'satisfactory' | 'poor'
  property_care   text,
  overall_rating  integer CHECK (overall_rating BETWEEN 1 AND 5),
  body            text,         -- full letter text
  recommend       boolean,      -- would you rent to them again?

  -- Delivery
  document_url    text,         -- signed PDF
  sent_at         timestamptz,
  expires_at      date,

  status          text  NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'revoked')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 4i. unit_utility_meters ──────────────────────────────────
-- Assigns specific utility meters to units (electricity, water, gas)
CREATE TABLE IF NOT EXISTS public.unit_utility_meters (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid  NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  property_id     uuid  REFERENCES public.properties(id) ON DELETE SET NULL,
  manager_id      uuid  REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id       uuid  REFERENCES public.tenants(id) ON DELETE SET NULL,

  utility_type    text  NOT NULL,  -- water | electricity | gas | internet
  meter_number    text  NOT NULL,
  meter_label     text,            -- "Main water meter", "Kitchen electric"
  provider        text,            -- Kenya Power, Nairobi Water, etc.
  account_number  text,            -- account at the utility provider
  billing_method  text DEFAULT 'prepaid',  -- prepaid | postpaid | flat_rate
  rate_per_unit   numeric(10,4),
  current_reading numeric(12,3) DEFAULT 0,
  last_read_date  date,
  installation_date date,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uum_unit_idx ON public.unit_utility_meters(unit_id);

-- ══════════════════════════════════════════════════════════════
-- SECTION 5: RLS POLICIES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.payment_payers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_unit_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_pets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_vehicles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_key_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_inspections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_guarantors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_notices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_blacklist      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_references     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_utility_meters   ENABLE ROW LEVEL SECURITY;

-- Manager manages all
DO $$ DECLARE t text;
BEGIN FOR t IN SELECT unnest(ARRAY[
  'payment_payers','tenant_unit_links','tenant_pets','tenant_vehicles',
  'unit_key_records','unit_inspections','tenant_guarantors',
  'tenant_notices','tenant_blacklist','tenant_references','unit_utility_meters'
]) LOOP
  EXECUTE format('DROP POLICY IF EXISTS "manager_%1$s" ON public.%1$s', t);
  EXECUTE format(
    'CREATE POLICY "manager_%1$s" ON public.%1$s FOR ALL USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid())',
    t
  );
END LOOP; END $$;

-- Tenant reads own records
DROP POLICY IF EXISTS "tenant_reads_payers" ON public.payment_payers;
CREATE POLICY "tenant_reads_payers"      ON public.payment_payers    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE id::text = auth.uid()::text));
DROP POLICY IF EXISTS "tenant_reads_pets" ON public.tenant_pets;
CREATE POLICY "tenant_reads_pets"        ON public.tenant_pets       FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE id::text = auth.uid()::text));
DROP POLICY IF EXISTS "tenant_reads_vehicles" ON public.tenant_vehicles;
CREATE POLICY "tenant_reads_vehicles"    ON public.tenant_vehicles   FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE id::text = auth.uid()::text));
DROP POLICY IF EXISTS "tenant_reads_notices" ON public.tenant_notices;
CREATE POLICY "tenant_reads_notices"     ON public.tenant_notices    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE id::text = auth.uid()::text));
DROP POLICY IF EXISTS "tenant_reads_inspections" ON public.unit_inspections;
CREATE POLICY "tenant_reads_inspections" ON public.unit_inspections  FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE id::text = auth.uid()::text));
DROP POLICY IF EXISTS "tenant_reads_references" ON public.tenant_references;
CREATE POLICY "tenant_reads_references"  ON public.tenant_references FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE id::text = auth.uid()::text));

-- Updated_at triggers
DROP TRIGGER IF EXISTS payment_payers_upd ON public.payment_payers;
CREATE TRIGGER payment_payers_upd     BEFORE UPDATE ON public.payment_payers     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS unit_key_records_upd ON public.unit_key_records;
CREATE TRIGGER unit_key_records_upd   BEFORE UPDATE ON public.unit_key_records   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS unit_inspections_upd ON public.unit_inspections;
CREATE TRIGGER unit_inspections_upd   BEFORE UPDATE ON public.unit_inspections   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS unit_utility_meters_upd ON public.unit_utility_meters;
CREATE TRIGGER unit_utility_meters_upd BEFORE UPDATE ON public.unit_utility_meters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
