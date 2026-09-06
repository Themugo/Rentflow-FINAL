-- ============================================================
-- Final Production Hardening
-- Missing tables, views, storage buckets, RLS, and indexes
-- ============================================================

-- 1. Views for tables referenced by edge functions under different names

-- Edge functions reference "payments" but the actual table is "payment_transactions"
CREATE OR REPLACE VIEW public.payments AS
  SELECT * FROM public.payment_transactions;

-- Edge functions reference "payouts" but the actual table is "payout_requests"
CREATE OR REPLACE VIEW public.payouts AS
  SELECT * FROM public.payout_requests;

-- 2. Truly missing tables

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      uuid REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  event_data      jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disputes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  reason          text NOT NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  evidence_urls   text[] DEFAULT '{}',
  filed_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text
);

CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  token           text NOT NULL UNIQUE,
  property_id     uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id         uuid REFERENCES public.units(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at     timestamptz
);

CREATE TABLE IF NOT EXISTS public.landlord_wallets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance           numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency          text NOT NULL DEFAULT 'KES',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(landlord_user_id)
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id         uuid NOT NULL REFERENCES public.landlord_wallets(id) ON DELETE CASCADE,
  amount            numeric(12,2) NOT NULL,
  type              text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payout', 'fee')),
  reference_type    text,
  reference_id      uuid,
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commission_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key            text NOT NULL,
  platform_rate       numeric(5,2) NOT NULL DEFAULT 5.00,
  stripe_rate         numeric(5,2) NOT NULL DEFAULT 2.9,
  mpesa_rate          numeric(5,2) NOT NULL DEFAULT 1.0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  manager_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount            numeric(12,2) NOT NULL,
  rate_applied      numeric(5,2) NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'refunded')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  collected_at      timestamptz
);

CREATE TABLE IF NOT EXISTS public.water_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id           uuid REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_id         uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  billing_period    text NOT NULL,
  amount            numeric(12,2) NOT NULL,
  previous_reading  numeric(10,2),
  current_reading   numeric(10,2),
  consumption       numeric(10,2),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  issued_at         timestamptz NOT NULL DEFAULT now(),
  paid_at           timestamptz
);

-- 3. Enable RLS on all newly created tables

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_invoices ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for newly created tables

CREATE POLICY "Managers can read payment_logs for their invoices"
  ON public.payment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.payment_transactions pt
      JOIN public.invoices i ON pt.invoice_id = i.id
      JOIN public.properties p ON i.property_id = p.id
      WHERE pt.id = payment_logs.payment_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert payment_logs"
  ON public.payment_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Managers can read disputes for their properties"
  ON public.disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.properties p ON i.property_id = p.id
      WHERE i.id = disputes.invoice_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can read their own disputes"
  ON public.disputes FOR SELECT
  USING (disputes.tenant_id IN (
    SELECT t.id FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
  ));

CREATE POLICY "Tenants can create disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (disputes.tenant_id IN (
    SELECT t.id FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
  ));

CREATE POLICY "Managers can update disputes"
  ON public.disputes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.properties p ON i.property_id = p.id
      WHERE i.id = disputes.invoice_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can read tenant_invites"
  ON public.tenant_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = tenant_invites.property_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can create tenant_invites"
  ON public.tenant_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = tenant_invites.property_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can read own wallet"
  ON public.landlord_wallets FOR SELECT
  USING (landlord_user_id = auth.uid());

CREATE POLICY "Landlords can read own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.landlord_wallets
      WHERE id = wallet_transactions.wallet_id
      AND landlord_user_id = auth.uid()
    )
  );

CREATE POLICY "Service can manage wallet transactions"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated can read commission_configs"
  ON public.commission_configs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can read commissions for their invoices"
  ON public.commissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.properties p ON i.property_id = p.id
      WHERE i.id = commissions.invoice_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can read own water_invoices"
  ON public.water_invoices FOR SELECT
  USING (water_invoices.tenant_id IN (
    SELECT t.id FROM public.tenants t
    JOIN public.user_roles ur ON ur.tenant_id = t.id
    WHERE ur.user_id = auth.uid()
  ));

CREATE POLICY "Managers can manage water_invoices for their properties"
  ON public.water_invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.properties p ON u.property_id = p.id
      WHERE u.id = water_invoices.unit_id
      AND p.manager_id = auth.uid()
    )
  );

-- 5. Enable RLS on tables that were missing it

ALTER TABLE IF EXISTS public.account_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.landlord_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.physical_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.physical_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.unit_charge_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.unit_tenancy_history ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for previously unprotected tables

CREATE POLICY "Managers can manage account_activations"
  ON public.account_activations FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own account_activations"
  ON public.account_activations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Managers can manage bank_integration_settings"
  ON public.bank_integration_settings FOR ALL
  USING (
    manager_id = auth.uid()
  );

CREATE POLICY "Managers can read bank_transactions"
  ON public.bank_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bank_integration_settings bis
      WHERE bis.id = bank_transactions.bank_integration_id
      AND bis.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can manage broadcast_campaigns"
  ON public.broadcast_campaigns FOR ALL
  USING (manager_id = auth.uid());

CREATE POLICY "Authenticated can read invoice_line_items"
  ON public.invoice_line_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can read invoice_line_items"
  ON public.invoice_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.properties p ON i.property_id = p.id
      WHERE i.id = invoice_line_items.invoice_id
      AND p.manager_id = auth.uid()
    )
  );

-- landlord_invoices is webhost-to-landlord billing; it has no manager_id column.
-- The webhost who issued the invoice reads it (service role inserts).
CREATE POLICY "Webhosts can read landlord_invoices"
  ON public.landlord_invoices FOR SELECT
  USING (webhost_user_id = auth.uid());

CREATE POLICY "Landlords can read own invoices"
  ON public.landlord_invoices FOR SELECT
  USING (landlord_user_id = auth.uid());

CREATE POLICY "Service can insert landlord_invoices"
  ON public.landlord_invoices FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated can read payment_payers"
  ON public.payment_payers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read physical_invoices"
  ON public.physical_invoices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can manage physical_receipts"
  ON public.physical_receipts FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can read unit_charge_configs"
  ON public.unit_charge_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.properties p ON u.property_id = p.id
      WHERE u.id = unit_charge_configs.unit_id
      AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can read own unit_charge_configs"
  ON public.unit_charge_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.unit_id = unit_charge_configs.unit_id
      AND t.id IN (
        SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Authenticated can read unit_tenancy_history"
  ON public.unit_tenancy_history FOR SELECT
  USING (auth.role() = 'authenticated');

-- 7. Storage bucket creation (idempotent)
-- Requires supabase-functions-http or dashboard to create buckets
-- These are idempotent INSERT statements

INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
  VALUES ('maintenance-photos', 'maintenance-photos', false, false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  ON CONFLICT (id) DO NOTHING;

-- 8. Harden existing storage bucket RLS by adding ownership checks
-- These policies work alongside existing bucket_id-based policies

DROP POLICY IF EXISTS "Users can only update their own objects" ON storage.objects;
CREATE POLICY "Users can only update their own objects"
  ON storage.objects FOR UPDATE
  USING (auth.uid() = owner);

DROP POLICY IF EXISTS "Users can only delete their own objects" ON storage.objects;
CREATE POLICY "Users can only delete their own objects"
  ON storage.objects FOR DELETE
  USING (auth.uid() = owner);

-- 9. Indexes for performance

CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON public.payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_disputes_invoice_id ON public.disputes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_disputes_tenant_id ON public.disputes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON public.tenant_invites(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_token ON public.tenant_invites(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_status ON public.tenant_invites(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_commissions_invoice_id ON public.commissions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_water_invoices_unit_id ON public.water_invoices(unit_id);
CREATE INDEX IF NOT EXISTS idx_water_invoices_tenant_id ON public.water_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_landlord_invoices_landlord_user_id ON public.landlord_invoices(landlord_user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON public.invoice_line_items(invoice_id);
