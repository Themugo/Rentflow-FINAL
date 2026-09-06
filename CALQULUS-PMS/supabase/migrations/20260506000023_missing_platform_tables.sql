-- ============================================================
-- CALQULUS RMS Migration 023: Missing platform tables
-- Creates manager_invoices, manager_contracts, and
-- webhost_payment_settings — referenced by the webhost
-- dashboard and approval flow but never created.
-- Also adds orphan tenant count to webhost stats.
-- ============================================================

-- ── 1. webhost_payment_settings ──────────────────────────────
-- Platform-level payment configuration set by webhost admin.
-- Single-row table (one global config).
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

-- Only webhosts can read/write payment settings
CREATE POLICY "webhost_manages_payment_settings"
  ON public.webhost_payment_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'webhost'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'webhost'
    )
  );

-- Seed default settings row
INSERT INTO public.webhost_payment_settings (registration_fee, subscription_rate)
VALUES (3000.00, 0.0100)
ON CONFLICT DO NOTHING;

-- ── 2. manager_invoices ───────────────────────────────────────
-- Platform subscription and registration invoices issued
-- BY the webhost TO managers (NOT tenant rent invoices).
CREATE TABLE IF NOT EXISTS public.manager_invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number   text NOT NULL UNIQUE,
  amount           numeric(12,2) NOT NULL,
  description      text,
  due_date         date NOT NULL,
  paid_date        date,
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','cancelled')),
  invoice_type     text DEFAULT 'subscription'
    CHECK (invoice_type IN ('registration','subscription','penalty','other')),
  property_count   integer,
  rate_per_property numeric(10,2),
  net_collection   numeric(12,2),
  commission_rate  numeric(5,4),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_invoices_manager ON public.manager_invoices(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_manager_invoices_status  ON public.manager_invoices(status);

ALTER TABLE public.manager_invoices ENABLE ROW LEVEL SECURITY;

-- Webhost sees all manager invoices
CREATE POLICY "webhost_manages_manager_invoices"
  ON public.manager_invoices FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- Manager sees only their own invoices
CREATE POLICY "manager_reads_own_platform_invoices"
  ON public.manager_invoices FOR SELECT
  USING (manager_user_id = auth.uid());

-- Auto-mark overdue
-- NOTE: the full escalation function (reminders, suspension, RETURNS integer) is
-- created by earlier migration 20260506000017_monetisation_enforcement.sql.
-- CREATE OR REPLACE cannot change a return type, so only create the minimal
-- fallback here when the function does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'escalate_overdue_manager_invoices'
  ) THEN
    CREATE FUNCTION public.escalate_overdue_manager_invoices()
    RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $fn$
    DECLARE
      v_count integer;
    BEGIN
      UPDATE public.manager_invoices
      SET status = 'overdue', updated_at = now()
      WHERE status = 'pending'
        AND due_date < CURRENT_DATE;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      RETURN v_count;
    END;
    $fn$;
  END IF;
END $$;

-- ── 3. manager_contracts ─────────────────────────────────────
-- Service agreements between webhost and managers.
-- Auto-created when a manager is approved.
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

CREATE POLICY "webhost_manages_contracts"
  ON public.manager_contracts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

CREATE POLICY "manager_reads_own_contract"
  ON public.manager_contracts FOR SELECT
  USING (manager_user_id = auth.uid());

-- ── 4. manager_status_log — ensure it exists ─────────────────
-- Already created in migration 014 but guard with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.manager_status_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by       uuid REFERENCES auth.users(id),
  changed_by_role  text,
  old_status       text,
  new_status       text NOT NULL,
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhost_reads_status_log"
  ON public.manager_status_log FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'webhost')
  );

-- ── 5. Webhost stats: count all tenants including orphans ─────
-- The webhost overview shows manager/property counts but
-- never showed tenant counts. Add a helper view.
CREATE OR REPLACE VIEW public.webhost_platform_stats AS
SELECT
  -- Managers
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'manager') AS total_managers,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'manager' AND approval_status = 'pending') AS pending_managers,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'manager' AND approval_status = 'approved') AS approved_managers,
  -- Properties
  (SELECT COUNT(*) FROM public.properties WHERE status != 'inactive') AS total_properties,
  -- Tenants (linked to a manager)
  (SELECT COUNT(*) FROM public.tenants WHERE status = 'active') AS linked_tenants,
  -- Orphan tenants (self-registered, no manager link)
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'tenant' AND tenant_id IS NULL) AS orphan_tenants,
  -- Platform billing
  (SELECT COUNT(*) FROM public.manager_invoices WHERE status = 'pending') AS pending_invoices,
  (SELECT COUNT(*) FROM public.manager_invoices WHERE status = 'overdue') AS overdue_invoices,
  (SELECT COALESCE(SUM(amount),0) FROM public.manager_invoices WHERE status = 'paid'
   AND paid_date >= date_trunc('month', now())) AS revenue_this_month;

-- Grant webhost access to the view
GRANT SELECT ON public.webhost_platform_stats TO authenticated;
