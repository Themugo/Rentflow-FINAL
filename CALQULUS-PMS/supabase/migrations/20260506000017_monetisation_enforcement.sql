-- ============================================================
-- CALQULUS RMS: Platform monetisation enforcement
-- ============================================================

-- ── 1. landlord_invoices — webhost bills landlords ────────────
-- Landlords pay for: property listing, landlord portal access,
-- document hosting, premium features
CREATE TABLE IF NOT EXISTS public.landlord_invoices (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id  uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webhost_user_id   uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_number    text    NOT NULL UNIQUE,
  invoice_type      text    NOT NULL DEFAULT 'portal_access'
    CHECK (invoice_type IN (
      'portal_access',      -- monthly landlord portal fee
      'property_listing',   -- per-property listing fee
      'document_storage',   -- document hosting fee
      'premium_reports',    -- advanced reporting access
      'one_time',           -- custom charge
      'annual_membership'   -- annual membership fee
    )),
  amount            numeric(12,2) NOT NULL,
  description       text,
  status            text    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'waived')),
  due_date          date    NOT NULL,
  paid_date         date,
  payment_method    text,
  payment_reference text,
  period_start      date,
  period_end        date,
  -- Link to manager who manages this landlord (if applicable)
  manager_user_id   uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id       uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landlord_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhost_manages_landlord_invoices"
  ON public.landlord_invoices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));
CREATE POLICY "landlord_reads_own_invoices"
  ON public.landlord_invoices FOR SELECT
  USING (landlord_user_id = auth.uid());
CREATE TRIGGER landlord_invoices_upd
  BEFORE UPDATE ON public.landlord_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. platform_billing_rules — configurable billing per client type ─
-- Webhost sets rules: how much to charge managers, landlords, agencies
CREATE TABLE IF NOT EXISTS public.platform_billing_rules (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name           text    NOT NULL,
  client_type         text    NOT NULL CHECK (client_type IN ('manager', 'landlord', 'agency')),
  billing_model       text    NOT NULL DEFAULT 'per_property'
    CHECK (billing_model IN (
      'per_property',      -- KES X per property per month
      'per_unit',          -- KES X per unit per month
      'flat_monthly',      -- flat monthly fee
      'commission',        -- % of rent collected
      'tiered',            -- from subscription_tiers table
      'free'               -- waived
    )),
  rate_amount         numeric(10,2) NOT NULL DEFAULT 0,
  rate_pct            numeric(5,2)  DEFAULT 0,  -- for commission model
  applies_to_tier     text,  -- if tiered: 'starter' | 'growth' | etc.
  registration_fee    numeric(10,2) DEFAULT 0,
  free_trial_days     integer DEFAULT 30,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_billing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhost_manages_billing_rules"
  ON public.platform_billing_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));
CREATE POLICY "public_reads_active_rules"
  ON public.platform_billing_rules FOR SELECT USING (is_active = true);

-- Seed default billing rules
INSERT INTO public.platform_billing_rules (rule_name, client_type, billing_model, rate_amount, registration_fee, free_trial_days)
VALUES
  ('Manager — Starter tier',      'manager',  'per_property',  500, 3000, 30),
  ('Manager — Growth tier',       'manager',  'per_property',  450, 3000, 30),
  ('Manager — Professional tier', 'manager',  'per_property',  400, 0,    30),
  ('Manager — Enterprise tier',   'manager',  'per_property',  350, 0,    30),
  ('Landlord — portal access',    'landlord', 'flat_monthly',  200, 0,    30),
  ('Agency flat rate',            'agency',   'flat_monthly', 2000, 5000, 30)
ON CONFLICT DO NOTHING;

-- ── 3. Extend manager_invoices with tier info ──────────────────
ALTER TABLE public.manager_invoices
  ADD COLUMN IF NOT EXISTS subscription_tier   text,
  ADD COLUMN IF NOT EXISTS billing_period_start date,
  ADD COLUMN IF NOT EXISTS billing_period_end   date,
  ADD COLUMN IF NOT EXISTS overdue_reminder_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspension_notice_sent boolean DEFAULT false;

-- ── 4. billing_events — audit trail for all platform billing ──
CREATE TABLE IF NOT EXISTS public.billing_events (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text    NOT NULL,
  -- invoice_created | payment_received | invoice_overdue |
  -- suspension_warning | account_suspended | account_reinstated
  client_type     text    NOT NULL, -- manager | landlord | agency
  client_user_id  uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id      uuid,
  amount          numeric(12,2),
  notes           text,
  performed_by    uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhost_reads_billing_events"
  ON public.billing_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost'));
CREATE POLICY "client_reads_own_events"
  ON public.billing_events FOR SELECT
  USING (client_user_id = auth.uid());

-- ── 5. auto_generate_platform_invoice() ──────────────────────
-- Called by pg_cron on the 1st of each month for all active managers
CREATE OR REPLACE FUNCTION public.auto_generate_platform_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_manager       RECORD;
  v_settings      RECORD;
  v_tier_rate     numeric(10,2);
  v_prop_count    integer;
  v_amount        numeric(12,2);
  v_inv_number    text;
  v_count         integer := 0;
  v_due_date      date;
  v_period_start  date;
  v_period_end    date;
BEGIN
  -- Get billing settings
  SELECT * INTO v_settings
  FROM public.webhost_payment_settings LIMIT 1;

  v_due_date     := date_trunc('month', now())::date + interval '14 days';
  v_period_start := date_trunc('month', now())::date;
  v_period_end   := (date_trunc('month', now()) + interval '1 month - 1 day')::date;

  FOR v_manager IN
    SELECT
      mp.manager_user_id,
      mp.subscription_tier,
      mp.property_count,
      mp.max_properties,
      mp.platform_rate
    FROM public.manager_profiles mp
    WHERE mp.status = 'approved'
      AND mp.property_count > 0
  LOOP
    -- Determine rate from tier
    v_tier_rate := COALESCE(v_manager.platform_rate, v_settings.subscription_rate * 100, 500);
    v_prop_count := v_manager.property_count;
    v_amount := v_tier_rate * v_prop_count;

    IF v_amount <= 0 THEN CONTINUE; END IF;

    -- Generate invoice number
    v_inv_number := 'PLAT-' || to_char(now(), 'YYYY-MM') || '-' || substring(v_manager.manager_user_id::text, 1, 8);

    -- Skip if already generated this month
    IF EXISTS (
      SELECT 1 FROM public.manager_invoices
      WHERE manager_user_id = v_manager.manager_user_id
        AND billing_period_start = v_period_start
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.manager_invoices (
      manager_user_id, invoice_number, amount, status,
      due_date, invoice_type, property_count, rate_per_property,
      subscription_tier, billing_period_start, billing_period_end,
      description
    ) VALUES (
      v_manager.manager_user_id,
      v_inv_number,
      v_amount,
      'pending',
      v_due_date,
      'subscription',
      v_prop_count,
      v_tier_rate,
      v_manager.subscription_tier,
      v_period_start,
      v_period_end,
      'Monthly platform fee — ' || v_prop_count || ' properties × KES ' || v_tier_rate
    );

    -- Log billing event
    INSERT INTO public.billing_events (event_type, client_type, client_user_id, amount)
    VALUES ('invoice_created', 'manager', v_manager.manager_user_id, v_amount);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 6. escalate_overdue_manager_invoices() ────────────────────
CREATE OR REPLACE FUNCTION public.escalate_overdue_manager_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv   RECORD;
  v_days  integer;
  v_count integer := 0;
BEGIN
  FOR v_inv IN
    SELECT mi.id, mi.manager_user_id, mi.amount, mi.due_date,
           mi.overdue_reminder_sent, mi.suspension_notice_sent,
           mp.status AS manager_status
    FROM public.manager_invoices mi
    JOIN public.manager_profiles mp ON mp.manager_user_id = mi.manager_user_id
    WHERE mi.status IN ('pending', 'overdue')
      AND mi.due_date < CURRENT_DATE
  LOOP
    v_days := CURRENT_DATE - v_inv.due_date;

    -- Mark as overdue
    UPDATE public.manager_invoices
    SET status = 'overdue'
    WHERE id = v_inv.id AND status = 'pending';

    -- 7-day: send reminder
    IF v_days >= 7 AND NOT v_inv.overdue_reminder_sent THEN
      UPDATE public.manager_invoices
      SET overdue_reminder_sent = true WHERE id = v_inv.id;

      INSERT INTO public.billing_events (event_type, client_type, client_user_id, invoice_id, notes)
      VALUES ('invoice_overdue', 'manager', v_inv.manager_user_id, v_inv.id, '7-day reminder triggered');
    END IF;

    -- 21-day: suspension warning
    IF v_days >= 21 AND NOT v_inv.suspension_notice_sent THEN
      UPDATE public.manager_invoices
      SET suspension_notice_sent = true WHERE id = v_inv.id;

      INSERT INTO public.billing_events (event_type, client_type, client_user_id, invoice_id, notes)
      VALUES ('suspension_warning', 'manager', v_inv.manager_user_id, v_inv.id, '21-day suspension warning');
    END IF;

    -- 30-day: suspend account
    IF v_days >= 30 AND v_inv.manager_status = 'approved' THEN
      UPDATE public.manager_profiles
      SET status = 'suspended_nonpayment',
          suspension_reason = 'Platform invoice overdue by 30+ days. Invoice: ' || v_inv.id::text
      WHERE manager_user_id = v_inv.manager_user_id;

      -- Block login
      UPDATE public.user_roles
      SET approval_status = 'rejected'
      WHERE user_id = v_inv.manager_user_id AND role = 'manager';

      INSERT INTO public.billing_events (event_type, client_type, client_user_id, invoice_id, notes)
      VALUES ('account_suspended', 'manager', v_inv.manager_user_id, v_inv.id, 'Auto-suspended: 30-day non-payment');
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 7. reinstate_manager_on_payment() ────────────────────────
CREATE OR REPLACE FUNCTION public.reinstate_manager_on_payment(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_manager_id uuid;
BEGIN
  SELECT manager_user_id INTO v_manager_id
  FROM public.manager_invoices WHERE id = p_invoice_id;

  IF v_manager_id IS NULL THEN RETURN; END IF;

  -- Only reinstate if suspended for non-payment
  IF EXISTS (
    SELECT 1 FROM public.manager_profiles
    WHERE manager_user_id = v_manager_id
      AND status = 'suspended_nonpayment'
  ) THEN
    UPDATE public.manager_profiles
    SET status = 'approved', suspension_reason = NULL
    WHERE manager_user_id = v_manager_id;

    UPDATE public.user_roles
    SET approval_status = 'approved'
    WHERE user_id = v_manager_id AND role = 'manager';

    INSERT INTO public.billing_events (event_type, client_type, client_user_id, invoice_id, notes)
    VALUES ('account_reinstated', 'manager', v_manager_id, p_invoice_id, 'Reinstated after payment');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_generate_platform_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_manager_invoices TO authenticated;
GRANT EXECUTE ON FUNCTION public.reinstate_manager_on_payment TO authenticated;
