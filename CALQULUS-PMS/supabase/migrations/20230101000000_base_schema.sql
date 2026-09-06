-- ⚠ DO NOT paste this file into a live production SQL Editor.
-- Production already has these tables. CREATE TABLE IF NOT EXISTS is a no-op on
-- existing relations, but the DELETE FROM blocks below will remove rows that
-- fail the orphan check (including user_roles). This file does NOT fix 42P17
-- RLS recursion or missing RPCs (PGRST202).
-- For live P1: paste supabase/sql/apply-live-p1-rls.sql then apply-live-p1-rpcs.sql.

-- Base Schema: ONLY tables NOT created by any migration

CREATE TABLE IF NOT EXISTS public.account_activations (
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  token text NOT NULL,
  used_at timestamptz,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  admin_level text NOT NULL,
  can_create_webhosts boolean NOT NULL,
  can_manage_billing boolean NOT NULL,
  can_manage_managers boolean NOT NULL,
  can_manage_properties boolean NOT NULL,
  can_manage_tenants boolean NOT NULL,
  can_view_activity_logs boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  id uuid DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.agencies (
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  email text,
  id uuid DEFAULT gen_random_uuid(),
  logo_url text,
  manager_id uuid,
  name text NOT NULL,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  details jsonb,
  id uuid DEFAULT gen_random_uuid(),
  ip_address text,
  resource_id uuid,
  resource_type text NOT NULL,
  user_agent text,
  user_email text,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.bank_details (
  account_label text,
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text NOT NULL,
  branch_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  is_default boolean,
  manager_id uuid NOT NULL,
  paybill_number text,
  property_id uuid,
  swift_code text,
  till_number text,
  unit_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.company_settings (
  address text,
  city text,
  company_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  email text,
  id uuid DEFAULT gen_random_uuid(),
  logo_url text,
  manager_user_id uuid,
  phone text,
  state text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  website text,
  zip_code text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.contract_templates (
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  id uuid DEFAULT gen_random_uuid(),
  is_default boolean,
  manager_user_id uuid,
  name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.contracts (
  approved_at timestamptz,
  approved_by text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  deletion_confirmed_at timestamptz,
  deletion_confirmed_by text,
  deletion_reason text,
  id uuid DEFAULT gen_random_uuid(),
  lease_id uuid,
  manager_signature text,
  manager_signed_at timestamptz,
  pending_approval boolean NOT NULL,
  property_id uuid,
  rejection_reason text,
  status text NOT NULL,
  template_id uuid,
  tenant_id uuid,
  tenant_ip_address text,
  tenant_signature text,
  tenant_signed_at timestamptz,
  title text NOT NULL,
  unit_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  uploaded_contract_url text,
  valid_from text,
  valid_until text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.deposit_deductions (
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  deduction_type text NOT NULL,
  description text NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  maintenance_request_id uuid,
  tenant_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.deposit_refunds (
  bank_account_name text,
  bank_account_number text,
  bank_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  final_balance numeric NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  move_out_date date NOT NULL,
  mpesa_number text,
  notes text,
  original_deposit numeric NOT NULL,
  processed_at timestamptz,
  processed_by text,
  refund_amount numeric NOT NULL,
  refund_method text NOT NULL,
  refund_reference text,
  status text NOT NULL,
  tenant_id uuid NOT NULL,
  total_deductions numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.expenditures (
  amount numeric NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  id uuid DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  month text NOT NULL,
  property_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  due_date date NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  lease_id uuid,
  manager_id uuid,
  paid_date date,
  status text NOT NULL,
  tenant_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.leases (
  created_at timestamptz NOT NULL DEFAULT now(),
  deposit numeric,
  document_url text,
  end_date date NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  manager_id uuid,
  monthly_rent numeric NOT NULL,
  property text NOT NULL,
  property_id uuid,
  start_date date NOT NULL,
  status text NOT NULL,
  tenant_id uuid,
  terms text,
  unit text NOT NULL,
  unit_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  assigned_to text,
  budget numeric,
  category text,
  completion_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_role text,
  deduct_from_deposit boolean,
  deposit_deducted_at timestamptz,
  deposit_deduction_amount numeric,
  description text NOT NULL,
  expected_completion_date date,
  id uuid DEFAULT gen_random_uuid(),
  manager_id uuid,
  priority text NOT NULL,
  property_name text NOT NULL,
  requested_date date NOT NULL,
  status text NOT NULL,
  tenant_email text NOT NULL,
  tenant_name text NOT NULL,
  title text NOT NULL,
  unit_id uuid,
  unit_number text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.manager_ewallet_settings (
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  instructions text,
  is_enabled boolean NOT NULL,
  manager_user_id uuid NOT NULL,
  property_id uuid,
  provider text NOT NULL,
  unit_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  wallet_id uuid,
  wallet_name text,
  wallet_phone text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.manager_mpesa_settings (
  consumer_key text,
  consumer_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  is_live boolean NOT NULL,
  manager_user_id uuid NOT NULL,
  paybill_account_reference text,
  paybill_enabled boolean NOT NULL,
  paybill_passkey text,
  paybill_shortcode text,
  property_id uuid,
  till_enabled boolean NOT NULL,
  till_passkey text,
  till_shortcode text,
  unit_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.manager_submanagers (
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  submanager_user_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.manager_profiles (
  id uuid DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  agency_id uuid,
  status text NOT NULL,
  approval_notes text,
  rejection_reason text,
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  -- Defaults mirror the intended definition in 20260506000014 (whose
  -- CREATE TABLE IF NOT EXISTS is skipped when this base table exists first).
  -- The tier CHECK constraint is intentionally omitted: migration 18 later
  -- adds lite/pro tier keys that it would reject.
  subscription_tier text NOT NULL DEFAULT 'starter',
  max_properties integer NOT NULL DEFAULT 5,
  max_units integer NOT NULL DEFAULT 50,
  billing_day integer NOT NULL DEFAULT 1,
  platform_rate numeric NOT NULL DEFAULT 500,
  billing_method text NOT NULL DEFAULT 'mpesa',
  property_count integer NOT NULL DEFAULT 0,
  unit_count integer NOT NULL DEFAULT 0,
  tenant_count integer NOT NULL DEFAULT 0,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.agency_members (
  id uuid DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  role_in_agency text NOT NULL,
  joined_at timestamptz NOT NULL,
  is_active boolean NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id uuid DEFAULT gen_random_uuid(),
  tier_key text NOT NULL,
  name text NOT NULL,
  description text,
  max_properties integer NOT NULL,
  max_units integer NOT NULL,
  price_per_property numeric NOT NULL,
  price_flat numeric,
  features jsonb,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.manager_status_log (
  id uuid DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  changed_by uuid,
  changed_by_role text,
  old_status text,
  new_status text NOT NULL,
  reason text,
  internal_note text,
  notify_manager boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.manager_subscriptions (
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  payment_method text,
  payment_reference text,
  phone_number text,
  property_count numeric NOT NULL,
  status text NOT NULL,
  stripe_subscription_id uuid,
  subscription_end text,
  subscription_start text,
  tier text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  invoice_id uuid,
  notes text,
  payment_date date NOT NULL,
  payment_method text NOT NULL,
  receipt_url text NOT NULL,
  reference_number text,
  rejection_reason text,
  status text NOT NULL,
  tenant_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  amount numeric NOT NULL,
  callback_secret text,
  checkout_request_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  failure_reason text,
  id uuid DEFAULT gen_random_uuid(),
  initiated_at timestamptz NOT NULL,
  invoice_id uuid,
  manager_id uuid,
  merchant_request_id uuid,
  mpesa_receipt_number text,
  payment_type text NOT NULL,
  phone_number text NOT NULL,
  status text NOT NULL,
  tenant_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  created_at timestamptz NOT NULL DEFAULT now(),
  currency text,
  email text NOT NULL,
  full_name text,
  id uuid DEFAULT gen_random_uuid(),
  phone text,
  photo_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.properties (
  address text NOT NULL,
  agency_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  house_label_prefix text,
  house_number text,
  id uuid DEFAULT gen_random_uuid(),
  image_url text,
  manager_id uuid,
  name text NOT NULL,
  number_of_floors numeric,
  occupied numeric NOT NULL DEFAULT 0,
  payment_details text,
  property_type text,
  rent_per_house numeric,
  revenue numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  units numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.property_amenity_charges (
  amount numeric NOT NULL,
  charge_label text NOT NULL,
  charge_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL,
  manager_id uuid NOT NULL,
  property_id uuid NOT NULL,
  unit_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.property_deductions (
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deduction_name text NOT NULL,
  deduction_type text NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL,
  is_recurring boolean NOT NULL,
  manager_id uuid NOT NULL,
  property_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.property_history (
  action text NOT NULL,
  changed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  details jsonb,
  id uuid DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  auth_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  p256dh_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.receipt_settings (
  auto_send_receipts boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  footer_message text,
  id uuid DEFAULT gen_random_uuid(),
  include_logo boolean,
  manager_user_id uuid NOT NULL,
  primary_color text,
  secondary_color text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.submanager_permissions (
  assigned_property_ids uuid[],
  can_view_activity_logs boolean NOT NULL,
  can_view_contracts boolean NOT NULL,
  can_view_invoices boolean NOT NULL,
  can_view_leases boolean NOT NULL,
  can_view_maintenance boolean NOT NULL,
  can_view_properties boolean NOT NULL,
  can_view_tenants boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  restrict_to_assigned_properties boolean,
  submanager_user_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.submanager_property_assignments (
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  property_id uuid NOT NULL,
  submanager_user_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tenant_history (
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  invited_by text NOT NULL,
  property_id uuid,
  property_name text NOT NULL,
  status text NOT NULL,
  tenant_name text NOT NULL,
  token text NOT NULL,
  unit text,
  used_at timestamptz,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tenants (
  account_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deposit_amount numeric,
  deposit_balance numeric,
  deposit_months numeric,
  email text NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  manager_id uuid,
  monthly_rent numeric,
  move_in_date date,
  name text NOT NULL,
  other_charges numeric,
  other_charges_description text,
  phone text,
  photo_url text,
  property text,
  property_id uuid,
  statement_history_months numeric,
  status text NOT NULL,
  unit text,
  unit_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  whatsapp text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.unit_water_config (
  created_at timestamptz NOT NULL DEFAULT now(),
  flat_rate_override numeric,
  has_meter boolean NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  meter_number text,
  property_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.units (
  bathrooms numeric,
  bedrooms numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  id uuid DEFAULT gen_random_uuid(),
  monthly_rent numeric,
  property_id uuid NOT NULL,
  square_feet numeric,
  status text NOT NULL,
  unit_number text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.uploaded_documents (
  contract_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  file_name text NOT NULL,
  file_size numeric,
  file_type text,
  file_url text NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  uploaded_at timestamptz NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  approval_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  role text NOT NULL,
  tenant_id uuid,
  user_id uuid NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.vacation_notices (
  acknowledged_at timestamptz,
  acknowledged_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  forwarding_address text,
  id uuid DEFAULT gen_random_uuid(),
  intended_move_out_date date NOT NULL,
  manager_id uuid,
  manager_notes text,
  notice_date date NOT NULL,
  phone_number text,
  property_id uuid,
  property_name text NOT NULL,
  reason text,
  status text NOT NULL,
  tenant_email text NOT NULL,
  tenant_id uuid NOT NULL,
  tenant_name text NOT NULL,
  tenant_signature text,
  tenant_signed_at timestamptz,
  unit_number text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  uploaded_document_url text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.water_billing_config (
  billing_cycle_day numeric,
  billing_method text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  flat_rate_amount numeric,
  id uuid DEFAULT gen_random_uuid(),
  invoice_mode text NOT NULL,
  is_active boolean NOT NULL,
  manager_id uuid NOT NULL,
  meter_number text,
  property_id uuid NOT NULL,
  rate_per_unit numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  water_provider text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.water_meter_readings (
  billing_period_end text,
  billing_period_start text,
  consumption numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  current_reading numeric NOT NULL,
  id uuid DEFAULT gen_random_uuid(),
  invoice_id uuid,
  manager_id uuid NOT NULL,
  notes text,
  previous_reading numeric NOT NULL,
  property_id uuid NOT NULL,
  rate_per_unit numeric NOT NULL,
  reading_date date NOT NULL,
  status text NOT NULL,
  total_amount numeric,
  unit_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.webhost_payment_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_fee     numeric(10,2) NOT NULL DEFAULT 3000.00,
  subscription_rate    numeric(5,4)  NOT NULL DEFAULT 0.0100,
  mpesa_paybill_number text,
  mpesa_paybill_account text,
  mpesa_till_number    text,
  mpesa_phone_number   text,
  bank_name            text,
  bank_account_name    text,
  bank_account_number  text,
  bank_branch          text,
  bank_swift_code      text,
  payment_instructions text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhost_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.manager_invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number        text NOT NULL UNIQUE,
  amount                numeric(12,2) NOT NULL,
  description           text,
  due_date              date NOT NULL,
  paid_date             date,
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','cancelled')),
  invoice_type          text DEFAULT 'subscription'
    CHECK (invoice_type IN ('registration','subscription','penalty','other')),
  property_count        integer,
  rate_per_property     numeric(10,2),
  net_collection        numeric(12,2),
  commission_rate       numeric(5,4),
  subscription_tier     text,
  billing_period_start  date,
  billing_period_end    date,
  overdue_reminder_sent boolean DEFAULT false,
  suspension_notice_sent boolean DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_invoices_manager ON public.manager_invoices(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_manager_invoices_status  ON public.manager_invoices(status);

ALTER TABLE public.manager_invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.manager_contracts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_email    text,
  manager_name     text,
  title            text NOT NULL DEFAULT 'CALQULUS RMS Platform Service Agreement',
  contract_type    text NOT NULL DEFAULT 'service_agreement',
  description      text,
  status           text NOT NULL DEFAULT 'pending_signature'
    CHECK (status IN ('pending_signature','signed','expired','terminated')),
  valid_from       date,
  valid_until      date,
  signed_at        timestamptz,
  signed_by        uuid REFERENCES auth.users(id),
  signature_url    text,
  contract_url     text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_contracts_manager ON public.manager_contracts(manager_user_id);

ALTER TABLE public.manager_contracts ENABLE ROW LEVEL SECURITY;

-- Helper function used by multiple migrations
CREATE OR REPLACE FUNCTION public.role_in(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = required_role) $$;

-- Ensure landlord_invitations has invited_by_webhost (migration 02 expects it)
ALTER TABLE IF EXISTS public.landlord_invitations ADD COLUMN IF NOT EXISTS invited_by_webhost boolean DEFAULT false;

-- Add property_id to invoices (migration 12 expects it, only added by patched migration)
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE IF EXISTS public.invoices ADD COLUMN IF NOT EXISTS unit_id uuid;

-- ── Foreign Key Constraints ─────────────────────────────────────────
-- These ensure referential integrity across all core tables.
-- Using DO blocks to check if constraints exist before adding them.

-- ── Cleanup Orphaned Data ─────────────────────────────────────────
-- Remove orphaned manager_id references before adding foreign key constraints
-- This handles data integrity issues from previous migrations
-- Only cleaning tables that have manager_id foreign keys being added

DELETE FROM public.agencies 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.bank_details 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.company_settings 
WHERE manager_user_id IS NOT NULL 
  AND manager_user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.expenditures 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.properties 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.invoices 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.leases 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.maintenance_requests 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.manager_ewallet_settings 
WHERE manager_user_id IS NOT NULL 
  AND manager_user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.manager_mpesa_settings 
WHERE manager_user_id IS NOT NULL 
  AND manager_user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.manager_submanagers 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.manager_submanagers 
WHERE submanager_user_id IS NOT NULL 
  AND submanager_user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.manager_profiles 
WHERE manager_user_id IS NOT NULL 
  AND manager_user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.manager_profiles 
WHERE suspended_by IS NOT NULL 
  AND suspended_by NOT IN (SELECT id FROM auth.users);

DELETE FROM public.manager_profiles 
WHERE approved_by IS NOT NULL 
  AND approved_by NOT IN (SELECT id FROM auth.users);

DELETE FROM public.agency_members 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.agency_members 
WHERE member_user_id IS NOT NULL 
  AND member_user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.property_amenity_charges 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.property_deductions 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.submanager_permissions 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.submanager_permissions 
WHERE submanager_user_id IS NOT NULL 
  AND submanager_user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.submanager_property_assignments 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.submanager_property_assignments 
WHERE submanager_user_id IS NOT NULL 
  AND submanager_user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.uploaded_documents 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.user_roles 
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.user_roles 
WHERE tenant_id IS NOT NULL 
  AND tenant_id NOT IN (SELECT id FROM public.tenants);

DELETE FROM public.water_billing_config 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.water_meter_readings 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

-- bank_transactions is created by a later migration; guard for clean-database replay
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_transactions') THEN
    DELETE FROM public.bank_transactions
    WHERE manager_id IS NOT NULL
      AND manager_id NOT IN (SELECT id FROM public.profiles);
  END IF;
END $$;

-- payment_allocations is created by a later migration; guard for clean-database replay
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_allocations') THEN
    DELETE FROM public.payment_allocations
    WHERE manager_id IS NOT NULL
      AND manager_id NOT IN (SELECT id FROM public.profiles);
  END IF;
END $$;

-- bank_integration_settings is created by a later migration; guard for clean-database replay
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_integration_settings') THEN
    DELETE FROM public.bank_integration_settings
    WHERE manager_id IS NOT NULL
      AND manager_id NOT IN (SELECT id FROM public.profiles);
  END IF;
END $$;

-- property_billing_config is created by a later migration; guard for clean-database replay
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'property_billing_config') THEN
    DELETE FROM public.property_billing_config
    WHERE manager_id IS NOT NULL
      AND manager_id NOT IN (SELECT id FROM public.profiles);
  END IF;
END $$;

DELETE FROM public.vacation_notices 
WHERE manager_id IS NOT NULL 
  AND manager_id NOT IN (SELECT id FROM public.profiles);

-- ── Add Foreign Key Constraints ─────────────────────────────────────

-- admin_permissions → profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'admin_permissions_user_id_fkey'
  ) THEN
    ALTER TABLE public.admin_permissions
      ADD CONSTRAINT admin_permissions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- agencies → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agencies_manager_id_fkey'
  ) THEN
    ALTER TABLE public.agencies
      ADD CONSTRAINT agencies_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- bank_details → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bank_details_manager_id_fkey'
  ) THEN
    ALTER TABLE public.bank_details
      ADD CONSTRAINT bank_details_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- bank_details → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bank_details_property_id_fkey'
  ) THEN
    ALTER TABLE public.bank_details
      ADD CONSTRAINT bank_details_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- company_settings → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'company_settings_manager_user_id_fkey'
  ) THEN
    ALTER TABLE public.company_settings
      ADD CONSTRAINT company_settings_manager_user_id_fkey
      FOREIGN KEY (manager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- contracts → leases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contracts_lease_id_fkey'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- contracts → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contracts_property_id_fkey'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- contracts → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contracts_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- contracts → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contracts_unit_id_fkey'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- deposit_deductions → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deposit_deductions_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.deposit_deductions
      ADD CONSTRAINT deposit_deductions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- deposit_refunds → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deposit_refunds_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.deposit_refunds
      ADD CONSTRAINT deposit_refunds_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- expenditures → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'expenditures_manager_id_fkey'
  ) THEN
    ALTER TABLE public.expenditures
      ADD CONSTRAINT expenditures_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- expenditures → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'expenditures_property_id_fkey'
  ) THEN
    ALTER TABLE public.expenditures
      ADD CONSTRAINT expenditures_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- invoices → leases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_lease_id_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- invoices → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_manager_id_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- invoices → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- invoices → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_property_id_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- invoices → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invoices_unit_id_fkey'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- leases → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leases_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.leases
      ADD CONSTRAINT leases_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- leases → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leases_manager_id_fkey'
  ) THEN
    ALTER TABLE public.leases
      ADD CONSTRAINT leases_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- leases → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leases_property_id_fkey'
  ) THEN
    ALTER TABLE public.leases
      ADD CONSTRAINT leases_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- leases → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leases_unit_id_fkey'
  ) THEN
    ALTER TABLE public.leases
      ADD CONSTRAINT leases_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- maintenance_requests → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'maintenance_requests_manager_id_fkey'
  ) THEN
    ALTER TABLE public.maintenance_requests
      ADD CONSTRAINT maintenance_requests_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- maintenance_requests → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'maintenance_requests_unit_id_fkey'
  ) THEN
    ALTER TABLE public.maintenance_requests
      ADD CONSTRAINT maintenance_requests_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- manager_ewallet_settings → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_ewallet_settings_manager_user_id_fkey'
  ) THEN
    ALTER TABLE public.manager_ewallet_settings
      ADD CONSTRAINT manager_ewallet_settings_manager_user_id_fkey
      FOREIGN KEY (manager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- manager_mpesa_settings → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_mpesa_settings_manager_user_id_fkey'
  ) THEN
    ALTER TABLE public.manager_mpesa_settings
      ADD CONSTRAINT manager_mpesa_settings_manager_user_id_fkey
      FOREIGN KEY (manager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- manager_submanagers → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_submanagers_manager_id_fkey'
  ) THEN
    ALTER TABLE public.manager_submanagers
      ADD CONSTRAINT manager_submanagers_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- manager_submanagers → profiles (submanager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_submanagers_submanager_user_id_fkey'
  ) THEN
    ALTER TABLE public.manager_submanagers
      ADD CONSTRAINT manager_submanagers_submanager_user_id_fkey
      FOREIGN KEY (submanager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- manager_profiles → auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_profiles_manager_user_id_fkey'
  ) THEN
    ALTER TABLE public.manager_profiles
      ADD CONSTRAINT manager_profiles_manager_user_id_fkey
      FOREIGN KEY (manager_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- manager_profiles → agencies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_profiles_agency_id_fkey'
  ) THEN
    ALTER TABLE public.manager_profiles
      ADD CONSTRAINT manager_profiles_agency_id_fkey
      FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- manager_profiles → auth.users (suspended_by)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_profiles_suspended_by_fkey'
  ) THEN
    ALTER TABLE public.manager_profiles
      ADD CONSTRAINT manager_profiles_suspended_by_fkey
      FOREIGN KEY (suspended_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- manager_profiles → auth.users (approved_by)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_profiles_approved_by_fkey'
  ) THEN
    ALTER TABLE public.manager_profiles
      ADD CONSTRAINT manager_profiles_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- agency_members → agencies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agency_members_agency_id_fkey'
  ) THEN
    ALTER TABLE public.agency_members
      ADD CONSTRAINT agency_members_agency_id_fkey
      FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- agency_members → auth.users (manager_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agency_members_manager_id_fkey'
  ) THEN
    ALTER TABLE public.agency_members
      ADD CONSTRAINT agency_members_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- agency_members → auth.users (member_user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agency_members_member_user_id_fkey'
  ) THEN
    ALTER TABLE public.agency_members
      ADD CONSTRAINT agency_members_member_user_id_fkey
      FOREIGN KEY (member_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- manager_status_log → auth.users (manager_user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_status_log_manager_user_id_fkey'
  ) THEN
    ALTER TABLE public.manager_status_log
      ADD CONSTRAINT manager_status_log_manager_user_id_fkey
      FOREIGN KEY (manager_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- manager_status_log → auth.users (changed_by)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_status_log_changed_by_fkey'
  ) THEN
    ALTER TABLE public.manager_status_log
      ADD CONSTRAINT manager_status_log_changed_by_fkey
      FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- manager_subscriptions → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'manager_subscriptions_manager_user_id_fkey'
  ) THEN
    ALTER TABLE public.manager_subscriptions
      ADD CONSTRAINT manager_subscriptions_manager_user_id_fkey
      FOREIGN KEY (manager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- payment_receipts → invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_receipts_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.payment_receipts
      ADD CONSTRAINT payment_receipts_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- payment_receipts → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_receipts_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.payment_receipts
      ADD CONSTRAINT payment_receipts_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- payment_transactions → invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_transactions_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.payment_transactions
      ADD CONSTRAINT payment_transactions_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- payment_transactions → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_transactions_manager_id_fkey'
  ) THEN
    ALTER TABLE public.payment_transactions
      ADD CONSTRAINT payment_transactions_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- payment_transactions → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_transactions_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.payment_transactions
      ADD CONSTRAINT payment_transactions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- properties → agencies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'properties_agency_id_fkey'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_agency_id_fkey
      FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- properties → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'properties_manager_id_fkey'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- property_amenity_charges → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'property_amenity_charges_manager_id_fkey'
  ) THEN
    ALTER TABLE public.property_amenity_charges
      ADD CONSTRAINT property_amenity_charges_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- property_amenity_charges → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'property_amenity_charges_property_id_fkey'
  ) THEN
    ALTER TABLE public.property_amenity_charges
      ADD CONSTRAINT property_amenity_charges_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;

-- property_amenity_charges → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'property_amenity_charges_unit_id_fkey'
  ) THEN
    ALTER TABLE public.property_amenity_charges
      ADD CONSTRAINT property_amenity_charges_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;
  END IF;
END $$;

-- property_deductions → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'property_deductions_manager_id_fkey'
  ) THEN
    ALTER TABLE public.property_deductions
      ADD CONSTRAINT property_deductions_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- property_deductions → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'property_deductions_property_id_fkey'
  ) THEN
    ALTER TABLE public.property_deductions
      ADD CONSTRAINT property_deductions_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;

-- property_history → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'property_history_property_id_fkey'
  ) THEN
    ALTER TABLE public.property_history
      ADD CONSTRAINT property_history_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;

-- push_subscriptions → profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'push_subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- receipt_settings → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'receipt_settings_manager_user_id_fkey'
  ) THEN
    ALTER TABLE public.receipt_settings
      ADD CONSTRAINT receipt_settings_manager_user_id_fkey
      FOREIGN KEY (manager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- submanager_permissions → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'submanager_permissions_manager_id_fkey'
  ) THEN
    ALTER TABLE public.submanager_permissions
      ADD CONSTRAINT submanager_permissions_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- submanager_permissions → profiles (submanager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'submanager_permissions_submanager_user_id_fkey'
  ) THEN
    ALTER TABLE public.submanager_permissions
      ADD CONSTRAINT submanager_permissions_submanager_user_id_fkey
      FOREIGN KEY (submanager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- submanager_property_assignments → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'submanager_property_assignments_manager_id_fkey'
  ) THEN
    ALTER TABLE public.submanager_property_assignments
      ADD CONSTRAINT submanager_property_assignments_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- submanager_property_assignments → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'submanager_property_assignments_property_id_fkey'
  ) THEN
    ALTER TABLE public.submanager_property_assignments
      ADD CONSTRAINT submanager_property_assignments_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;

-- submanager_property_assignments → profiles (submanager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'submanager_property_assignments_submanager_user_id_fkey'
  ) THEN
    ALTER TABLE public.submanager_property_assignments
      ADD CONSTRAINT submanager_property_assignments_submanager_user_id_fkey
      FOREIGN KEY (submanager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- tenant_history → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenant_history_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.tenant_history
      ADD CONSTRAINT tenant_history_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- tenants → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_manager_id_fkey'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- tenants → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_property_id_fkey'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- tenants → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_unit_id_fkey'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- unit_water_config → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unit_water_config_property_id_fkey'
  ) THEN
    ALTER TABLE public.unit_water_config
      ADD CONSTRAINT unit_water_config_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;

-- unit_water_config → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unit_water_config_unit_id_fkey'
  ) THEN
    ALTER TABLE public.unit_water_config
      ADD CONSTRAINT unit_water_config_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;
  END IF;
END $$;

-- units → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'units_property_id_fkey'
  ) THEN
    ALTER TABLE public.units
      ADD CONSTRAINT units_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;

-- uploaded_documents → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uploaded_documents_manager_id_fkey'
  ) THEN
    ALTER TABLE public.uploaded_documents
      ADD CONSTRAINT uploaded_documents_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_roles → profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- user_roles → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_roles_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- vacation_notices → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vacation_notices_manager_id_fkey'
  ) THEN
    ALTER TABLE public.vacation_notices
      ADD CONSTRAINT vacation_notices_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- vacation_notices → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vacation_notices_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.vacation_notices
      ADD CONSTRAINT vacation_notices_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- vacation_notices → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vacation_notices_property_id_fkey'
  ) THEN
    ALTER TABLE public.vacation_notices
      ADD CONSTRAINT vacation_notices_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
END $$;

-- water_billing_config → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'water_billing_config_manager_id_fkey'
  ) THEN
    ALTER TABLE public.water_billing_config
      ADD CONSTRAINT water_billing_config_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- water_billing_config → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'water_billing_config_property_id_fkey'
  ) THEN
    ALTER TABLE public.water_billing_config
      ADD CONSTRAINT water_billing_config_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;

-- water_meter_readings → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'water_meter_readings_manager_id_fkey'
  ) THEN
    ALTER TABLE public.water_meter_readings
      ADD CONSTRAINT water_meter_readings_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- water_meter_readings → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'water_meter_readings_property_id_fkey'
  ) THEN
    ALTER TABLE public.water_meter_readings
      ADD CONSTRAINT water_meter_readings_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;

-- water_meter_readings → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'water_meter_readings_unit_id_fkey'
  ) THEN
    ALTER TABLE public.water_meter_readings
      ADD CONSTRAINT water_meter_readings_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;
  END IF;
END $$;

-- water_meter_readings → invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'water_meter_readings_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.water_meter_readings
      ADD CONSTRAINT water_meter_readings_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- bank_transactions table is created in migration 20260506000003_comprehensive_payment_schema.sql
-- Foreign key constraints for this table are defined there

-- notification_failures table is created in migration 20260520000000_payment_idempotency_and_notification_failures.sql
-- Foreign key constraints for this table are defined there

-- payment_allocations → payment_transactions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_allocations')
     AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_allocations_transaction_id_fkey'
  ) THEN
    ALTER TABLE public.payment_allocations
      ADD CONSTRAINT payment_allocations_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES public.payment_transactions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- payment_allocations → invoices
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_allocations')
     AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_allocations_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.payment_allocations
      ADD CONSTRAINT payment_allocations_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
  END IF;
END $$;

-- payment_allocations → tenants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_allocations')
     AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_allocations_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.payment_allocations
      ADD CONSTRAINT payment_allocations_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- payment_allocations → profiles (manager)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_allocations')
     AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_allocations_manager_id_fkey'
  ) THEN
    ALTER TABLE public.payment_allocations
      ADD CONSTRAINT payment_allocations_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- tenant_credit_ledger table is created in migration 20260506000003_comprehensive_payment_schema.sql
-- Foreign key constraints for this table are defined there

-- fraud_flags table is created in migration 20260528000000_missing_audit_tables.sql
-- Foreign key constraints for this table are defined there

-- security_audit_log table is created in migration 20260506000020_security_hardening.sql
-- Foreign key constraints for this table are defined there

-- bank_integration_settings table is created in migration 20260506000003_comprehensive_payment_schema.sql
-- Foreign key constraints for this table are defined there

-- bank_transactions table is created in migration 20260506000003_comprehensive_payment_schema.sql
-- Foreign key constraints for this table are defined there

-- property_billing_config table is created in migration 20260506000010_billing_modes_unit_management.sql
-- Foreign key constraints for this table are defined there

-- manager_notification_settings table is created in migration 20260526000000_settings_storage_and_notifications.sql
-- Foreign key constraints for this table are defined there

-- property_landlords table is created in migration 20260506000002_authority_structure_v2.sql
-- Foreign key constraints for this table are defined there

-- api_rate_limits table is created in migration 20260506000020_security_hardening.sql
-- Foreign key constraints for this table are defined there

-- dead_letter_queue table is created in migration 20260528000000_missing_audit_tables.sql
-- Foreign key constraints for this table are defined there

-- ── Unique Constraints ──────────────────────────────────────────────
-- Prevent duplicate role assignments per user
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_role_key
  ON public.user_roles(user_id, role);

-- Ensure invoice_number is unique per manager
CREATE UNIQUE INDEX IF NOT EXISTS invoices_manager_invoice_number_key
  ON public.invoices(manager_id, invoice_number) WHERE invoice_number IS NOT NULL AND invoice_number != '';

-- Prevent duplicate bank transactions from concurrent webhook deliveries
-- bank_transactions is created by a later migration; guard for clean-database replay
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bank_transactions') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_manager_external_id_key
      ON public.bank_transactions(manager_id, external_id) WHERE external_id IS NOT NULL AND external_id != '';
  END IF;
END $$;

-- ── Performance Indexes ─────────────────────────────────────────────
-- These indexes cover the most frequently queried columns across the
-- application. Without them, full table scans occur on every filter/sort.

-- invoices: filtered by status, tenant, due_date; sorted by due_date
CREATE INDEX IF NOT EXISTS idx_invoices_status         ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id      ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date       ON public.invoices(due_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_manager_status ON public.invoices(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_lease_id       ON public.invoices(lease_id);

-- tenants: filtered by manager, status, property
CREATE INDEX IF NOT EXISTS idx_tenants_manager_id   ON public.tenants(manager_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status       ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_property_id  ON public.tenants(property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_email        ON public.tenants(email);

-- leases: filtered by status, manager, tenant
CREATE INDEX IF NOT EXISTS idx_leases_status       ON public.leases(status);
CREATE INDEX IF NOT EXISTS idx_leases_manager_id   ON public.leases(manager_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_id    ON public.leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_property_id  ON public.leases(property_id);

-- properties: filtered by manager, status
CREATE INDEX IF NOT EXISTS idx_properties_manager_id ON public.properties(manager_id);
CREATE INDEX IF NOT EXISTS idx_properties_status     ON public.properties(status);

-- user_roles: looked up on every auth check
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role    ON public.user_roles(role);

-- maintenance_requests: filtered by manager, status
CREATE INDEX IF NOT EXISTS idx_maintenance_manager_id ON public.maintenance_requests(manager_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status     ON public.maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_unit_id    ON public.maintenance_requests(unit_id);

-- contracts: filtered by tenant, lease, status
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id ON public.contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_lease_id  ON public.contracts(lease_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status    ON public.contracts(status);

-- payment_transactions: filtered by tenant, manager, status
CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant_id    ON public.payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_manager_id   ON public.payment_transactions(manager_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status       ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_checkout_req ON public.payment_transactions(checkout_request_id);

-- payment_receipts: filtered by tenant, status
CREATE INDEX IF NOT EXISTS idx_payment_receipts_tenant_id ON public.payment_receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status    ON public.payment_receipts(status);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_invoice   ON public.payment_receipts(invoice_id);

-- profiles: email lookup during auth
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- admin_permissions: user_id lookup on every webhost login
CREATE INDEX IF NOT EXISTS idx_admin_permissions_user_id ON public.admin_permissions(user_id);

-- submanager_permissions: submanager_user_id lookup
CREATE INDEX IF NOT EXISTS idx_submanager_perms_user_id ON public.submanager_permissions(submanager_user_id);

-- submanager_property_assignments: submanager_user_id lookup
CREATE INDEX IF NOT EXISTS idx_submanager_assignments_user_id ON public.submanager_property_assignments(submanager_user_id);
CREATE INDEX IF NOT EXISTS idx_submanager_assignments_property ON public.submanager_property_assignments(property_id);

-- company_settings: manager_user_id lookup
CREATE INDEX IF NOT EXISTS idx_company_settings_manager ON public.company_settings(manager_user_id);

-- manager_mpesa_settings: manager_user_id lookup
CREATE INDEX IF NOT EXISTS idx_mpesa_settings_manager ON public.manager_mpesa_settings(manager_user_id);

-- manager_notification_settings: manager_user_id lookup
-- manager_notification_settings is created by a later migration; guard for clean-database replay
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'manager_notification_settings') THEN
    CREATE INDEX IF NOT EXISTS idx_notification_settings_manager ON public.manager_notification_settings(manager_user_id);
  END IF;
END $$;

-- receipt_settings: manager_user_id lookup
CREATE INDEX IF NOT EXISTS idx_receipt_settings_manager ON public.receipt_settings(manager_user_id);

-- units: property_id lookup (very frequent)
CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_status      ON public.units(status);

-- property_history: property_id lookup
CREATE INDEX IF NOT EXISTS idx_property_history_property ON public.property_history(property_id);

-- tenant_history: tenant_id lookup
CREATE INDEX IF NOT EXISTS idx_tenant_history_tenant ON public.tenant_history(tenant_id);

-- uploaded_documents: manager_id lookup
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_manager ON public.uploaded_documents(manager_id);

-- expenditures: manager_id, month lookup
CREATE INDEX IF NOT EXISTS idx_expenditures_manager_month ON public.expenditures(manager_id, month);

-- water_billing_config: property_id, manager_id lookup
CREATE INDEX IF NOT EXISTS idx_water_billing_property ON public.water_billing_config(property_id);
CREATE INDEX IF NOT EXISTS idx_water_billing_manager  ON public.water_billing_config(manager_id);

-- water_meter_readings: unit_id, property_id, manager_id lookup
CREATE INDEX IF NOT EXISTS idx_water_readings_unit     ON public.water_meter_readings(unit_id);
CREATE INDEX IF NOT EXISTS idx_water_readings_property ON public.water_meter_readings(property_id);
CREATE INDEX IF NOT EXISTS idx_water_readings_manager  ON public.water_meter_readings(manager_id);
CREATE INDEX IF NOT EXISTS idx_water_readings_status   ON public.water_meter_readings(status);

-- vacation_notices: tenant_id, manager_id, status lookup
CREATE INDEX IF NOT EXISTS idx_vacation_tenant_id  ON public.vacation_notices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vacation_manager_id ON public.vacation_notices(manager_id);
CREATE INDEX IF NOT EXISTS idx_vacation_status     ON public.vacation_notices(status);

-- tenant_invitations: token, email, status lookup
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token  ON public.tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email  ON public.tenant_invitations(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_status ON public.tenant_invitations(status);

-- manager_subscriptions: manager_user_id, status lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_manager ON public.manager_subscriptions(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON public.manager_subscriptions(status);

-- deposit_refunds: tenant_id, status lookup
CREATE INDEX IF NOT EXISTS idx_deposit_refunds_tenant ON public.deposit_refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deposit_refunds_status ON public.deposit_refunds(status);

-- deposit_deductions: tenant_id lookup
CREATE INDEX IF NOT EXISTS idx_deposit_deductions_tenant ON public.deposit_deductions(tenant_id);

-- bank_details: manager_id lookup
CREATE INDEX IF NOT EXISTS idx_bank_details_manager ON public.bank_details(manager_id);

-- property_amenity_charges: property_id, manager_id lookup
CREATE INDEX IF NOT EXISTS idx_amenity_charges_property ON public.property_amenity_charges(property_id);
CREATE INDEX IF NOT EXISTS idx_amenity_charges_manager  ON public.property_amenity_charges(manager_id);

-- property_deductions: property_id, manager_id lookup
CREATE INDEX IF NOT EXISTS idx_property_deductions_property ON public.property_deductions(property_id);
CREATE INDEX IF NOT EXISTS idx_property_deductions_manager  ON public.property_deductions(manager_id);

-- push_subscriptions: user_id lookup
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- account_activations: user_id, token lookup
CREATE INDEX IF NOT EXISTS idx_account_activations_user  ON public.account_activations(user_id);
CREATE INDEX IF NOT EXISTS idx_account_activations_token ON public.account_activations(token);

-- manager_submanagers: manager_id, submanager_user_id lookup
CREATE INDEX IF NOT EXISTS idx_manager_submanagers_manager    ON public.manager_submanagers(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_submanagers_submanager ON public.manager_submanagers(submanager_user_id);

-- manager_ewallet_settings: manager_user_id lookup
CREATE INDEX IF NOT EXISTS idx_ewallet_settings_manager ON public.manager_ewallet_settings(manager_user_id);

-- manager_profiles: manager_user_id lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_profiles_manager_user_id ON public.manager_profiles(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_manager_profiles_status ON public.manager_profiles(status);
CREATE INDEX IF NOT EXISTS idx_manager_profiles_agency_id ON public.manager_profiles(agency_id);

-- agency_members: agency_id, manager_id, member_user_id lookup
CREATE INDEX IF NOT EXISTS idx_agency_members_agency_id ON public.agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_manager_id ON public.agency_members(manager_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_member_user_id ON public.agency_members(member_user_id);

-- subscription_tiers: tier_key lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_tiers_tier_key ON public.subscription_tiers(tier_key);
CREATE INDEX IF NOT EXISTS idx_subscription_tiers_is_active ON public.subscription_tiers(is_active);

-- manager_status_log: manager_user_id lookup
CREATE INDEX IF NOT EXISTS idx_manager_status_log_manager_user_id ON public.manager_status_log(manager_user_id);
