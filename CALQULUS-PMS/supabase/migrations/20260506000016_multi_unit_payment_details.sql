-- ============================================================
-- CALQULUS RMS: Multi-unit tenant support + payment details sync
-- ============================================================

-- ── 1. tenant_unit_links — already exists, ensure columns complete ──
ALTER TABLE public.tenant_unit_links
  ADD COLUMN IF NOT EXISTS tenancy_type   text NOT NULL DEFAULT 'standard'
    CHECK (tenancy_type IN ('standard', 'formal_lease', 'short_term', 'commercial')),
  ADD COLUMN IF NOT EXISTS monthly_rent   numeric(12,2),
  ADD COLUMN IF NOT EXISTS house_deposit  numeric(12,2),
  ADD COLUMN IF NOT EXISTS water_deposit  numeric(12,2),
  ADD COLUMN IF NOT EXISTS other_charges  numeric(12,2),
  ADD COLUMN IF NOT EXISTS other_charges_description text,
  ADD COLUMN IF NOT EXISTS start_date     date,
  ADD COLUMN IF NOT EXISTS end_date       date,
  ADD COLUMN IF NOT EXISTS is_primary     boolean NOT NULL DEFAULT true,
  -- is_primary = true → this is the tenant's main unit (used for portal home)
  ADD COLUMN IF NOT EXISTS payment_day    integer DEFAULT 1 CHECK (payment_day BETWEEN 1 AND 28),
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'paused'));

-- ── 2. payment_details_snapshot — what manager set at registration ──
-- Stores the payment terms agreed at tenant onboarding so they are
-- always visible on the tenant portal regardless of later invoice changes.
CREATE TABLE IF NOT EXISTS public.tenant_payment_details (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid    NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  manager_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id     uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id         uuid    REFERENCES public.units(id) ON DELETE SET NULL,

  -- What the tenant pays
  monthly_rent        numeric(12,2),
  house_deposit       numeric(12,2),
  water_deposit       numeric(12,2),
  other_charges       numeric(12,2),
  other_charges_desc  text,
  total_deposit       numeric(12,2) GENERATED ALWAYS AS (
    COALESCE(house_deposit, 0) + COALESCE(water_deposit, 0)
  ) STORED,

  -- Deposit tracking
  deposit_paid        numeric(12,2) DEFAULT 0,
  deposit_balance     numeric(12,2),

  -- Payment schedule
  payment_day         integer DEFAULT 1,  -- day of month rent is due
  grace_period_days   integer DEFAULT 0,
  payment_method      text DEFAULT 'mpesa', -- mpesa | bank | cash

  -- Tenancy type
  tenancy_type        text DEFAULT 'standard',
  -- standard | formal_lease | short_term | commercial

  -- M-Pesa details for tenant's payment (from manager's settings)
  paybill_number      text,
  till_number         text,
  account_reference   text,  -- what tenant enters as account ref (usually unit number)

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_payment_details ENABLE ROW LEVEL SECURITY;

-- Tenant reads their own payment details
CREATE POLICY "tenant_reads_own_payment_details"
  ON public.tenant_payment_details FOR SELECT
  USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      JOIN public.user_roles ur ON ur.tenant_id = t.id
      WHERE ur.user_id = auth.uid() AND ur.role = 'tenant'
    )
  );

-- Manager manages payment details
CREATE POLICY "manager_manages_payment_details"
  ON public.tenant_payment_details FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER tenant_payment_details_upd
  BEFORE UPDATE ON public.tenant_payment_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. Backfill from existing tenants table ────────────────────────
-- For existing tenants, create payment_details from their tenants row
INSERT INTO public.tenant_payment_details (
  tenant_id, manager_id, property_id, unit_id,
  monthly_rent, house_deposit, water_deposit,
  other_charges, other_charges_desc,
  deposit_paid, deposit_balance
)
SELECT
  t.id,
  t.manager_id,
  t.property_id,
  t.unit_id,
  t.monthly_rent,
  CASE WHEN t.deposit_months IS NOT NULL AND t.monthly_rent IS NOT NULL
    THEN t.monthly_rent * t.deposit_months
    ELSE t.deposit_amount
  END AS house_deposit,
  NULL AS water_deposit,
  t.other_charges,
  t.other_charges_description,
  COALESCE(t.deposit_amount, 0) - COALESCE(t.deposit_balance, 0),
  t.deposit_balance
FROM public.tenants t
WHERE t.status = 'active'
ON CONFLICT (tenant_id) DO NOTHING;

-- ── 4. Sync function — called when tenant is registered ─────────────
CREATE OR REPLACE FUNCTION public.sync_tenant_payment_details(
  p_tenant_id     uuid,
  p_manager_id    uuid,
  p_property_id   uuid DEFAULT NULL,
  p_unit_id       uuid DEFAULT NULL,
  p_monthly_rent  numeric DEFAULT NULL,
  p_house_deposit numeric DEFAULT NULL,
  p_water_deposit numeric DEFAULT NULL,
  p_other_charges numeric DEFAULT NULL,
  p_other_charges_desc text DEFAULT NULL,
  p_payment_day   integer DEFAULT 1,
  p_paybill       text DEFAULT NULL,
  p_account_ref   text DEFAULT NULL,
  p_tenancy_type  text DEFAULT 'standard'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.tenant_payment_details (
    tenant_id, manager_id, property_id, unit_id,
    monthly_rent, house_deposit, water_deposit,
    other_charges, other_charges_desc,
    deposit_balance,
    payment_day, paybill_number, account_reference, tenancy_type
  ) VALUES (
    p_tenant_id, p_manager_id, p_property_id, p_unit_id,
    p_monthly_rent, p_house_deposit, p_water_deposit,
    p_other_charges, p_other_charges_desc,
    COALESCE(p_house_deposit, 0) + COALESCE(p_water_deposit, 0),
    p_payment_day, p_paybill, p_account_ref, p_tenancy_type
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    manager_id    = EXCLUDED.manager_id,
    property_id   = EXCLUDED.property_id,
    unit_id       = EXCLUDED.unit_id,
    monthly_rent  = COALESCE(EXCLUDED.monthly_rent, tenant_payment_details.monthly_rent),
    house_deposit = COALESCE(EXCLUDED.house_deposit, tenant_payment_details.house_deposit),
    water_deposit = COALESCE(EXCLUDED.water_deposit, tenant_payment_details.water_deposit),
    other_charges = COALESCE(EXCLUDED.other_charges, tenant_payment_details.other_charges),
    other_charges_desc = COALESCE(EXCLUDED.other_charges_desc, tenant_payment_details.other_charges_desc),
    payment_day   = EXCLUDED.payment_day,
    paybill_number = COALESCE(EXCLUDED.paybill_number, tenant_payment_details.paybill_number),
    account_reference = COALESCE(EXCLUDED.account_reference, tenant_payment_details.account_reference),
    tenancy_type  = EXCLUDED.tenancy_type,
    updated_at    = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_tenant_payment_details TO authenticated;
