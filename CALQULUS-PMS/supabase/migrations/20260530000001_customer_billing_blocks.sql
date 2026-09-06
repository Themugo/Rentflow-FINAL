-- ──────────────────────────────────────────────────────────────
-- Phase 2: Per-Unit Billing Overhaul
-- ──────────────────────────────────────────────────────────────
-- Creates customer_billing_blocks table for per-unit pricing
-- overrides, waivers, discounts, and custom negotiated blocks.
-- Also adds price_per_unit to subscription_tiers.
-- ──────────────────────────────────────────────────────────────

-- ── 1. Add price_per_unit to subscription_tiers ────────────
ALTER TABLE public.subscription_tiers
  ADD COLUMN IF NOT EXISTS price_per_unit numeric(10,2);

UPDATE public.subscription_tiers
SET price_per_unit = CASE tier_key
  WHEN 'lite'       THEN 40   -- KES per unit per month
  WHEN 'pro'        THEN 30
  WHEN 'enterprise' THEN 20
  ELSE 40
END
WHERE price_per_unit IS NULL;

-- ── 2. customer_billing_blocks table ───────────────────────
CREATE TABLE IF NOT EXISTS public.customer_billing_blocks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_type       text NOT NULL CHECK (customer_type IN ('manager', 'landlord', 'agency')),
  agency_id           uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  -- Per-unit pricing override (NULL = use tier default)
  price_per_unit      numeric(10,2),
  unit_count_locked   boolean NOT NULL DEFAULT false,
  -- Waivers & discounts
  registration_fee_waived    boolean NOT NULL DEFAULT false,
  registration_fee_amount    numeric(10,2) DEFAULT 0,
  monthly_discount_pct       numeric(5,2) DEFAULT 0,
  monthly_discount_flat      numeric(10,2) DEFAULT 0,
  discount_label             text,
  discount_expires_at        timestamptz,
  -- Zero registration control
  zero_registration    boolean NOT NULL DEFAULT false,
  -- Custom negotiated block
  custom_block_name    text,
  custom_block_price   numeric(10,2),
  custom_block_units   integer,
  custom_block_notes   text,
  -- Approval tracking
  approved_by          uuid REFERENCES public.platform_admins(id),
  approved_at          timestamptz,
  -- Timestamps
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid REFERENCES auth.users(id)
);

-- ── 3. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customer_billing_blocks_customer ON public.customer_billing_blocks(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_billing_blocks_customer_type ON public.customer_billing_blocks(customer_type);
CREATE INDEX IF NOT EXISTS idx_customer_billing_blocks_agency ON public.customer_billing_blocks(agency_id);

-- ── 4. RLS ────────────────────────────────────────────────────
ALTER TABLE public.customer_billing_blocks ENABLE ROW LEVEL SECURITY;

-- Webhost platform admins can see all billing blocks
DROP POLICY IF EXISTS "webhost_select_billing_blocks" ON public.customer_billing_blocks;
CREATE POLICY "webhost_select_billing_blocks"
  ON public.customer_billing_blocks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND NOT suspended)
  );

-- Webhost platform admins can manage billing blocks
DROP POLICY IF EXISTS "webhost_manage_billing_blocks" ON public.customer_billing_blocks;
CREATE POLICY "webhost_manage_billing_blocks"
  ON public.customer_billing_blocks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND admin_type IN ('owner', 'business') AND NOT suspended)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND admin_type IN ('owner', 'business') AND NOT suspended)
  );

-- Customers can see their own billing block
DROP POLICY IF EXISTS "customer_select_own_block" ON public.customer_billing_blocks;
CREATE POLICY "customer_select_own_block"
  ON public.customer_billing_blocks FOR SELECT
  USING (customer_id = auth.uid());

-- ── 5. Auto-update trigger ─────────────────────────────────
DROP TRIGGER IF EXISTS trg_customer_billing_blocks_updated_at ON public.customer_billing_blocks;
CREATE TRIGGER trg_customer_billing_blocks_updated_at
  BEFORE UPDATE ON public.customer_billing_blocks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_platform_admin_timestamp();

-- ── 6. Grants ──────────────────────────────────────────────
GRANT ALL ON public.customer_billing_blocks TO authenticated;
GRANT ALL ON public.customer_billing_blocks TO service_role;
