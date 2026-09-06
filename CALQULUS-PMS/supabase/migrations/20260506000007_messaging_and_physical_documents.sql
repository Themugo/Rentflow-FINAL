-- ============================================================
-- CALQULUS RMS: Communication & Physical Document Layer
-- Covers:
--   1. messages table (manager↔tenant, manager↔all, system)
--   2. broadcast_campaigns (bulk message tracking)
--   3. physical_invoices (paper invoice entry by manager)
--   4. physical_receipts (scanned receipt confirmation)
--   5. in_app_notifications (tenant/manager in-app alerts)
-- ============================================================

-- ── 1. messages ───────────────────────────────────────────────
-- Every message sent through the platform — one-to-one or broadcast.
-- Direction: manager→tenant, tenant→manager, system→tenant, manager→all
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id     uuid    REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id         uuid    REFERENCES public.units(id) ON DELETE SET NULL,

  -- Sender
  sender_id       uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role     text    NOT NULL DEFAULT 'manager',
  -- manager | tenant | system | submanager | landlord

  -- Recipient targeting
  recipient_type  text    NOT NULL DEFAULT 'tenant',
  -- tenant | all_property | all_unit | all_manager | landlord | custom_group
  recipient_id    uuid,               -- specific user (for 1-to-1)
  tenant_id       uuid    REFERENCES public.tenants(id) ON DELETE SET NULL,

  -- Content
  subject         text,
  body            text    NOT NULL,
  message_type    text    NOT NULL DEFAULT 'general',
  -- general | invoice_notice | payment_reminder | maintenance_update
  -- rent_increase | eviction_warning | announcement | emergency

  -- Channels fired
  sent_via_sms        boolean DEFAULT false,
  sent_via_email      boolean DEFAULT false,
  sent_via_whatsapp   boolean DEFAULT false,
  sent_via_push       boolean DEFAULT false,
  sent_via_app        boolean DEFAULT true,   -- always stored in-app

  -- Delivery status
  sms_status          text,    -- sent | failed | pending
  email_status        text,
  whatsapp_status     text,
  push_status         text,

  -- Read tracking
  is_read         boolean DEFAULT false,
  read_at         timestamptz,

  -- Thread / reply
  parent_message_id uuid    REFERENCES public.messages(id) ON DELETE SET NULL,

  -- Campaign link (if part of a broadcast)
  campaign_id     uuid,

  -- Metadata
  attachments     text[],   -- URLs of attached files
  metadata        jsonb,
  scheduled_at    timestamptz,   -- for scheduled sends
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msg_sender_idx     ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS msg_recipient_idx  ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS msg_tenant_idx     ON public.messages(tenant_id);
CREATE INDEX IF NOT EXISTS msg_property_idx   ON public.messages(property_id);
CREATE INDEX IF NOT EXISTS msg_manager_idx    ON public.messages(manager_id);
CREATE INDEX IF NOT EXISTS msg_campaign_idx   ON public.messages(campaign_id);
CREATE INDEX IF NOT EXISTS msg_unread_idx     ON public.messages(recipient_id, is_read)
  WHERE is_read = false;

-- ── 2. broadcast_campaigns ────────────────────────────────────
-- Groups a bulk send so manager can see delivery stats
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id     uuid    REFERENCES public.properties(id) ON DELETE SET NULL,

  name            text    NOT NULL,
  subject         text,
  body            text    NOT NULL,
  message_type    text    NOT NULL DEFAULT 'announcement',

  -- Audience
  audience_type   text    NOT NULL DEFAULT 'all_tenants',
  -- all_tenants | property_tenants | unit_tenants | overdue_tenants
  -- arrears_tenants | active_leases | custom_list
  audience_filter jsonb,  -- e.g. { "property_ids": ["..."], "status": "active" }

  -- Channels
  send_sms        boolean DEFAULT false,
  send_email      boolean DEFAULT false,
  send_whatsapp   boolean DEFAULT false,
  send_push       boolean DEFAULT false,
  send_app        boolean DEFAULT true,

  -- Stats (updated as messages send)
  total_recipients   integer DEFAULT 0,
  sms_sent           integer DEFAULT 0,
  sms_failed         integer DEFAULT 0,
  email_sent         integer DEFAULT 0,
  email_failed       integer DEFAULT 0,
  whatsapp_sent      integer DEFAULT 0,
  push_sent          integer DEFAULT 0,

  -- State
  status          text    NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'sent', 'scheduled', 'failed', 'cancelled')),
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bc_manager_idx  ON public.broadcast_campaigns(manager_id);
CREATE INDEX IF NOT EXISTS bc_property_idx ON public.broadcast_campaigns(property_id);

-- ── 3. physical_invoices ──────────────────────────────────────
-- Manager manually enters paper invoices issued outside the system.
-- Covers: receipts from banks, cash collection books, physical receipts.
CREATE TABLE IF NOT EXISTS public.physical_invoices (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       uuid    REFERENCES public.tenants(id) ON DELETE SET NULL,
  unit_id         uuid    REFERENCES public.units(id) ON DELETE SET NULL,
  property_id     uuid    REFERENCES public.properties(id) ON DELETE SET NULL,

  -- Invoice details
  invoice_number  text    NOT NULL,
  invoice_date    date    NOT NULL DEFAULT CURRENT_DATE,
  due_date        date,
  description     text    NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  tax_amount      numeric(12,2) DEFAULT 0,
  total_amount    numeric(12,2) NOT NULL,

  -- Line items (stored as JSON for flexibility)
  line_items      jsonb,
  -- [{ "label": "Monthly Rent", "amount": 12000 }, { "label": "Garbage", "amount": 250 }]

  -- Status
  status          text    NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'paid', 'partially_paid', 'cancelled', 'overdue')),
  paid_amount     numeric(12,2) DEFAULT 0,
  paid_date       date,

  -- Document
  document_url    text,    -- scanned copy if available
  notes           text,

  -- Linking to digital system
  linked_invoice_id uuid   REFERENCES public.invoices(id) ON DELETE SET NULL,
  -- If matched to a digital invoice after reconciliation

  recorded_by     uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  entered_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pi_tenant_idx  ON public.physical_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS pi_unit_idx    ON public.physical_invoices(unit_id);
CREATE INDEX IF NOT EXISTS pi_manager_idx ON public.physical_invoices(manager_id);

-- ── 4. physical_receipts ──────────────────────────────────────
-- Manager enters or scans paper receipts given to tenants.
-- Can be linked to a payment_transaction after verification.
CREATE TABLE IF NOT EXISTS public.physical_receipts (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       uuid    REFERENCES public.tenants(id) ON DELETE SET NULL,
  unit_id         uuid    REFERENCES public.units(id) ON DELETE SET NULL,
  property_id     uuid    REFERENCES public.properties(id) ON DELETE SET NULL,

  -- Receipt details
  receipt_number  text    NOT NULL,
  receipt_date    date    NOT NULL DEFAULT CURRENT_DATE,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method  text    NOT NULL DEFAULT 'cash',
  -- cash | cheque | bank_transfer | mpesa | other
  reference       text,   -- cheque number, M-Pesa code, bank ref, etc.
  description     text    NOT NULL,
  received_by     text,   -- name of person who collected

  -- Line items (what the payment covers)
  line_items      jsonb,

  -- Scanned copy
  document_url    text,   -- photo/scan of physical receipt

  -- Linking to digital
  linked_transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  linked_invoice_id     uuid REFERENCES public.invoices(id) ON DELETE SET NULL,

  -- Confirmation: digital receipt sent after physical?
  digital_receipt_sent  boolean DEFAULT false,
  digital_sent_at       timestamptz,
  sent_via              text,   -- email | sms | whatsapp

  notes           text,
  recorded_by     uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pr_tenant_idx  ON public.physical_receipts(tenant_id);
CREATE INDEX IF NOT EXISTS pr_unit_idx    ON public.physical_receipts(unit_id);
CREATE INDEX IF NOT EXISTS pr_manager_idx ON public.physical_receipts(manager_id);

-- ── 5. in_app_notifications ───────────────────────────────────
-- Persistent in-app notification store for both tenants and managers.
-- Shown in notification bell / mobile banner.
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id      uuid    REFERENCES auth.users(id) ON DELETE SET NULL,

  title           text    NOT NULL,
  body            text    NOT NULL,
  type            text    NOT NULL DEFAULT 'info',
  -- info | payment | maintenance | notice | alert | reminder | broadcast

  -- Deep link
  action_url      text,   -- e.g. /portal/invoices/[id]
  action_label    text,   -- e.g. "View invoice"

  -- Reference
  reference_id    uuid,
  reference_type  text,   -- 'invoice' | 'maintenance' | 'message' | 'contract' | 'notice'

  -- Read state
  is_read         boolean NOT NULL DEFAULT false,
  read_at         timestamptz,

  -- Dismissal
  is_dismissed    boolean NOT NULL DEFAULT false,
  dismissed_at    timestamptz,

  -- Source
  source          text    DEFAULT 'system',
  -- system | manager | payment_engine | maintenance | broadcast

  priority        text    DEFAULT 'normal',  -- low | normal | high | urgent

  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ian_user_idx    ON public.in_app_notifications(user_id);
CREATE INDEX IF NOT EXISTS ian_unread_idx  ON public.in_app_notifications(user_id, is_read)
  WHERE is_read = false;
CREATE INDEX IF NOT EXISTS ian_type_idx    ON public.in_app_notifications(type);

-- ── 6. RLS policies ───────────────────────────────────────────
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_invoices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_receipts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_app_notifications  ENABLE ROW LEVEL SECURITY;

-- messages: sender sees sent; recipient sees received; manager sees all for their tenants
DROP POLICY IF EXISTS "sender_reads_sent_messages" ON public.messages;
CREATE POLICY "sender_reads_sent_messages"
  ON public.messages FOR SELECT USING (sender_id = auth.uid());
DROP POLICY IF EXISTS "recipient_reads_messages" ON public.messages;
CREATE POLICY "recipient_reads_messages"
  ON public.messages FOR SELECT USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "manager_manages_messages" ON public.messages;
CREATE POLICY "manager_manages_messages"
  ON public.messages FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- broadcast_campaigns: manager only
DROP POLICY IF EXISTS "manager_manages_campaigns" ON public.broadcast_campaigns;
CREATE POLICY "manager_manages_campaigns"
  ON public.broadcast_campaigns FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- physical_invoices/receipts: manager manages; tenant reads own
DROP POLICY IF EXISTS "manager_manages_physical_invoices" ON public.physical_invoices;
CREATE POLICY "manager_manages_physical_invoices"
  ON public.physical_invoices FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());
DROP POLICY IF EXISTS "tenant_reads_physical_invoices" ON public.physical_invoices;
CREATE POLICY "tenant_reads_physical_invoices"
  ON public.physical_invoices FOR SELECT
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE id::text = auth.uid()::text));

DROP POLICY IF EXISTS "manager_manages_physical_receipts" ON public.physical_receipts;
CREATE POLICY "manager_manages_physical_receipts"
  ON public.physical_receipts FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());
DROP POLICY IF EXISTS "tenant_reads_physical_receipts" ON public.physical_receipts;
CREATE POLICY "tenant_reads_physical_receipts"
  ON public.physical_receipts FOR SELECT
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE id::text = auth.uid()::text));

-- in_app_notifications: user reads/updates own
DROP POLICY IF EXISTS "user_reads_own_notifications" ON public.in_app_notifications;
CREATE POLICY "user_reads_own_notifications"
  ON public.in_app_notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_updates_own_notifications" ON public.in_app_notifications;
CREATE POLICY "user_updates_own_notifications"
  ON public.in_app_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "manager_creates_notifications" ON public.in_app_notifications;
CREATE POLICY "manager_creates_notifications"
  ON public.in_app_notifications FOR INSERT
  WITH CHECK (manager_id = auth.uid() OR manager_id IS NULL);

-- ── 7. Helper: broadcast to all tenants in a property ─────────
CREATE OR REPLACE FUNCTION public.notify_all_tenants(
  p_manager_id  uuid,
  p_property_id uuid,
  p_title       text,
  p_body        text,
  p_type        text DEFAULT 'info',
  p_action_url  text DEFAULT NULL,
  p_action_label text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_count integer := 0;
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN
    SELECT DISTINCT t.id as tenant_id, ur.user_id
    FROM public.tenants t
    JOIN public.user_roles ur ON ur.role = 'tenant'
    WHERE t.property_id = p_property_id
      AND t.manager_id = p_manager_id
      AND t.status = 'active'
  LOOP
    INSERT INTO public.in_app_notifications (
      user_id, manager_id, title, body, type,
      action_url, action_label, reference_id, reference_type, source
    ) VALUES (
      v_tenant.user_id, p_manager_id, p_title, p_body, p_type,
      p_action_url, p_action_label, p_reference_id, p_reference_type, 'manager'
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Updated_at triggers
DROP TRIGGER IF EXISTS broadcast_campaigns_upd ON public.broadcast_campaigns;
CREATE TRIGGER broadcast_campaigns_upd
  BEFORE UPDATE ON public.broadcast_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
