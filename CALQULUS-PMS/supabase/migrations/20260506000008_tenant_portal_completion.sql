-- ============================================================
-- CALQULUS RMS: Final tenant-portal completion
-- ============================================================

-- ── 1. tenant_notification_preferences ───────────────────────
-- Move notification prefs out of localStorage into persistent DB.
-- Survives device changes, app reinstalls.
CREATE TABLE IF NOT EXISTS public.tenant_notification_preferences (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tenant_id           uuid    REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Channels
  email_enabled       boolean NOT NULL DEFAULT true,
  sms_enabled         boolean NOT NULL DEFAULT true,
  whatsapp_enabled    boolean NOT NULL DEFAULT false,
  push_enabled        boolean NOT NULL DEFAULT true,

  -- Event types
  payment_reminders   boolean NOT NULL DEFAULT true,
  invoice_due         boolean NOT NULL DEFAULT true,
  payment_confirmed   boolean NOT NULL DEFAULT true,
  maintenance_updates boolean NOT NULL DEFAULT true,
  lease_alerts        boolean NOT NULL DEFAULT true,
  manager_messages    boolean NOT NULL DEFAULT true,
  announcements       boolean NOT NULL DEFAULT true,
  rent_increase       boolean NOT NULL DEFAULT true,

  -- Timing
  reminder_days_before integer NOT NULL DEFAULT 3,  -- days before due date
  quiet_hours_start   time,    -- e.g. 22:00
  quiet_hours_end     time,    -- e.g. 07:00

  -- Language preference
  language            text DEFAULT 'en',  -- en | sw (Kiswahili)

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_manages_own_prefs"
  ON public.tenant_notification_preferences FOR ALL
  USING (tenant_user_id = auth.uid())
  WITH CHECK (tenant_user_id = auth.uid());

-- ── 2. tenant_lease_renewal_responses ────────────────────────
-- Tenant's formal response to a lease renewal offer from manager.
CREATE TABLE IF NOT EXISTS public.tenant_lease_renewal_responses (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_user_id  uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  lease_id        uuid    REFERENCES public.leases(id) ON DELETE SET NULL,
  notice_id       uuid    REFERENCES public.tenant_notices(id) ON DELETE SET NULL,

  decision        text    NOT NULL CHECK (decision IN ('accept', 'decline', 'negotiate')),
  counter_rent    numeric(12,2),   -- tenant's counter-proposed rent (if negotiating)
  counter_term    integer,         -- months (if negotiating)
  message         text,            -- tenant's message to manager
  signed_at       timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_lease_renewal_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_manages_own_renewal"
  ON public.tenant_lease_renewal_responses FOR ALL
  USING (tenant_user_id = auth.uid())
  WITH CHECK (tenant_user_id = auth.uid());
CREATE POLICY "manager_reads_renewal_responses"
  ON public.tenant_lease_renewal_responses FOR SELECT
  USING (manager_id = auth.uid());

-- ── 3. tenant_reference_requests ─────────────────────────────
-- Tenant formally requests a reference letter from their manager.
CREATE TABLE IF NOT EXISTS public.tenant_reference_requests (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_user_id  uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,

  issued_to       text,     -- new landlord name
  issued_to_email text,     -- where to send
  purpose         text,     -- 'new_rental' | 'employment' | 'bank_loan' | 'other'
  message         text,     -- request message

  status          text    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'issued', 'declined')),
  reference_id    uuid    REFERENCES public.tenant_references(id) ON DELETE SET NULL,
  responded_at    timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_reference_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_manages_own_ref_requests"
  ON public.tenant_reference_requests FOR ALL
  USING (tenant_user_id = auth.uid())
  WITH CHECK (tenant_user_id = auth.uid());
CREATE POLICY "manager_reads_ref_requests"
  ON public.tenant_reference_requests FOR SELECT
  USING (manager_id = auth.uid());

-- ── Updated_at triggers ───────────────────────────────────────
CREATE TRIGGER tenant_notif_prefs_upd
  BEFORE UPDATE ON public.tenant_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
