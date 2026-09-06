-- ============================================================
-- CALQULUS RMS: Landlord portal completion
-- Full independent landlord control layer
-- ============================================================

-- ── 1. landlord_bank_details ──────────────────────────────────
-- Where landlord wants payouts sent
-- Separate from general profiles — financial data needs tighter control
CREATE TABLE IF NOT EXISTS public.landlord_bank_details (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id    uuid    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- M-Pesa (most common in Kenya)
  mpesa_number        text,
  mpesa_name          text,   -- name as registered on M-Pesa

  -- Bank transfer
  bank_name           text,
  bank_account_number text,
  bank_account_name   text,
  bank_branch         text,
  bank_code           text,
  swift_code          text,

  -- Preferred payout method
  preferred_method    text NOT NULL DEFAULT 'mpesa'
    CHECK (preferred_method IN ('mpesa', 'bank_transfer', 'cheque', 'cash')),

  -- Payout preferences
  minimum_payout      numeric(12,2) DEFAULT 0,  -- don't release below this amount
  auto_request        boolean DEFAULT false,     -- auto-request payout monthly
  auto_request_day    integer DEFAULT 5,         -- day of month to auto-request

  -- KRA PIN for tax compliance
  kra_pin             text,
  vat_registered      boolean DEFAULT false,
  vat_number          text,

  verified            boolean DEFAULT false,     -- manager verified bank details
  verified_at         timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landlord_bank_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "landlord_manages_own_bank_details"
  ON public.landlord_bank_details FOR ALL
  USING (landlord_user_id = auth.uid())
  WITH CHECK (landlord_user_id = auth.uid());
CREATE POLICY "manager_reads_landlord_bank_details"
  ON public.landlord_bank_details FOR SELECT
  USING (
    landlord_user_id IN (
      SELECT landlord_user_id FROM public.property_landlords
      WHERE manager_id = auth.uid()
    )
  );

-- ── 2. Extend payout_requests with payment proof ──────────────
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS recipient_type     text DEFAULT 'manager'
    CHECK (recipient_type IN ('manager', 'webhost')),
  ADD COLUMN IF NOT EXISTS payment_method     text,
  ADD COLUMN IF NOT EXISTS payment_reference  text,   -- M-Pesa transaction ID or bank ref
  ADD COLUMN IF NOT EXISTS payment_proof_url  text,   -- screenshot/receipt upload
  ADD COLUMN IF NOT EXISTS rejection_reason   text,
  ADD COLUMN IF NOT EXISTS bank_details_snapshot jsonb, -- bank details at time of payment
  ADD COLUMN IF NOT EXISTS net_amount         numeric(12,2), -- after deductions/fees
  ADD COLUMN IF NOT EXISTS management_fee_pct numeric(5,2),  -- fee charged by manager
  ADD COLUMN IF NOT EXISTS management_fee_amt numeric(12,2); -- fee amount

-- ── 3. landlord_documents ────────────────────────────────────
-- Documents landlord can access (contracts, inspections, statements)
-- Does NOT include tenant personal data (name/email/phone) — only unit data
CREATE TABLE IF NOT EXISTS public.landlord_documents (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id          uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id         uuid    REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id             uuid    REFERENCES public.units(id) ON DELETE SET NULL,

  document_type       text    NOT NULL,
  -- lease_summary | inspection_report | financial_statement | property_photo
  -- maintenance_summary | occupancy_report | custom

  title               text    NOT NULL,
  description         text,
  document_url        text,           -- downloadable file
  period_start        date,
  period_end          date,
  is_visible          boolean DEFAULT true,  -- manager can hide documents

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ld_landlord_idx ON public.landlord_documents(landlord_user_id);
CREATE INDEX IF NOT EXISTS ld_property_idx ON public.landlord_documents(property_id);

ALTER TABLE public.landlord_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "landlord_reads_own_documents"
  ON public.landlord_documents FOR SELECT
  USING (landlord_user_id = auth.uid() AND is_visible = true);
CREATE POLICY "manager_manages_landlord_documents"
  ON public.landlord_documents FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- ── 4. landlord_messages ─────────────────────────────────────
-- Direct messaging between landlord and their manager(s)
-- Completely separate from tenant communications
CREATE TABLE IF NOT EXISTS public.landlord_messages (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  sender_id           uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role         text    NOT NULL, -- 'landlord' | 'manager'
  recipient_id        uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject             text,
  body                text    NOT NULL,
  is_read             boolean DEFAULT false,
  read_at             timestamptz,
  parent_id           uuid    REFERENCES public.landlord_messages(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lm_sender_idx    ON public.landlord_messages(sender_id);
CREATE INDEX IF NOT EXISTS lm_recipient_idx ON public.landlord_messages(recipient_id);

ALTER TABLE public.landlord_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "landlord_or_manager_sees_own_messages"
  ON public.landlord_messages FOR ALL
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- ── 5. landlord_notification_preferences ─────────────────────
CREATE TABLE IF NOT EXISTS public.landlord_notification_preferences (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id    uuid    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  email_enabled       boolean DEFAULT true,
  sms_enabled         boolean DEFAULT true,
  whatsapp_enabled    boolean DEFAULT false,

  -- Events
  payout_approved     boolean DEFAULT true,
  payout_paid         boolean DEFAULT true,
  monthly_statement   boolean DEFAULT true,
  new_tenant_moved_in boolean DEFAULT true,
  tenant_moved_out    boolean DEFAULT true,
  maintenance_completed boolean DEFAULT true,
  vacancy_alert       boolean DEFAULT true,  -- unit becomes vacant
  arrears_alert       boolean DEFAULT true,  -- tenant in arrears

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landlord_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "landlord_manages_own_notif_prefs"
  ON public.landlord_notification_preferences FOR ALL
  USING (landlord_user_id = auth.uid())
  WITH CHECK (landlord_user_id = auth.uid());

-- ── 6. Helper: compute landlord revenue for a property+period ─
CREATE OR REPLACE FUNCTION public.get_landlord_revenue(
  p_property_id       uuid,
  p_landlord_user_id  uuid,
  p_period_start      date DEFAULT (date_trunc('month', CURRENT_DATE))::date,
  p_period_end        date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  gross_rent_collected  numeric,
  management_fee        numeric,
  net_to_landlord       numeric,
  revenue_share_pct     numeric,
  total_units           bigint,
  occupied_units        bigint,
  occupancy_rate        numeric,
  arrears_total         numeric,
  payout_pending        numeric
) LANGUAGE sql STABLE AS $$
  WITH
  link AS (
    SELECT revenue_share_pct FROM public.property_landlords
    WHERE property_id = p_property_id AND landlord_user_id = p_landlord_user_id
  ),
  payments AS (
    SELECT COALESCE(SUM(pt.amount), 0) AS collected
    FROM public.payment_transactions pt
    WHERE pt.property_id = p_property_id
      AND pt.status = 'completed'
      AND pt.completed_at::date BETWEEN p_period_start AND p_period_end
  ),
  units AS (
    SELECT
      COUNT(*) FILTER (WHERE status != 'inactive') AS total_u,
      COUNT(*) FILTER (WHERE status = 'occupied') AS occupied_u
    FROM public.units WHERE property_id = p_property_id
  ),
  arrears AS (
    SELECT COALESCE(SUM(i.balance_due), 0) AS total_arr
    FROM public.invoices i
    JOIN public.leases l ON l.id = i.lease_id
    WHERE l.property_id = p_property_id AND i.status IN ('pending', 'overdue')
  ),
  pending_payouts AS (
    SELECT COALESCE(SUM(amount), 0) AS pending
    FROM public.payout_requests
    WHERE property_id = p_property_id
      AND landlord_user_id = p_landlord_user_id
      AND status IN ('pending', 'approved')
  )
  SELECT
    payments.collected,
    ROUND(payments.collected * (1 - link.revenue_share_pct / 100), 2) AS management_fee,
    ROUND(payments.collected * link.revenue_share_pct / 100, 2) AS net_to_landlord,
    link.revenue_share_pct,
    units.total_u,
    units.occupied_u,
    CASE WHEN units.total_u > 0 THEN ROUND((units.occupied_u::numeric / units.total_u) * 100, 1) ELSE 0 END,
    arrears.total_arr,
    pending_payouts.pending
  FROM payments, link, units, arrears, pending_payouts;
$$;

-- ── 7. Updated_at triggers ────────────────────────────────────
CREATE TRIGGER landlord_bank_details_upd
  BEFORE UPDATE ON public.landlord_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER landlord_notif_prefs_upd
  BEFORE UPDATE ON public.landlord_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
