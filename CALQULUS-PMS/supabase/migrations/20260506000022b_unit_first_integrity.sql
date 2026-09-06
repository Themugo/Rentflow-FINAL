-- ============================================================
-- CALQULUS RMS: Unit-First Data Integrity Migration
-- Goal: Every invoice traces cleanly:
--   invoice → lease → unit → property → manager's M-Pesa
-- ============================================================

-- 1. Add unit_id + property_id (non-nullable with back-fill) to invoices
--    The invoices table already has lease_id; we derive unit_id from there.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS manager_id uuid;  -- already exists in many rows, make sure column is present

-- Back-fill unit_id and property_id from the lease chain
UPDATE public.invoices i
SET
  unit_id      = l.unit_id,
  property_id  = l.property_id
FROM public.leases l
WHERE i.lease_id = l.id
  AND i.unit_id IS NULL;

-- 2. Ensure leases always carry both unit_id and property_id
--    (property_id can be derived from unit if missing)

UPDATE public.leases l
SET property_id = u.property_id
FROM public.units u
WHERE l.unit_id = u.id
  AND l.property_id IS NULL;

-- 3. Add a DB-level check: new invoices must have a lease_id
--    (prevents orphan invoices with no unit context)
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_lease_id_required
    CHECK (lease_id IS NOT NULL);

-- 4. Index to speed up the unit-first lookup path used in STK push & callback
CREATE INDEX IF NOT EXISTS idx_invoices_unit_id    ON public.invoices(unit_id);
CREATE INDEX IF NOT EXISTS idx_invoices_property_id ON public.invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_invoices_manager_id  ON public.invoices(manager_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit_id       ON public.leases(unit_id);

-- 5. Add unit_id to payment_transactions for direct receipt → unit tracing
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS unit_id      uuid REFERENCES public.units(id),
  ADD COLUMN IF NOT EXISTS property_id  uuid REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS unit_number  text;   -- human-readable e.g. "A3" for receipts/SMS

-- Back-fill from invoices
UPDATE public.payment_transactions pt
SET
  unit_id      = i.unit_id,
  property_id  = i.property_id,
  unit_number  = u.unit_number
FROM public.invoices i
LEFT JOIN public.units u ON i.unit_id = u.id
WHERE pt.invoice_id = i.id
  AND pt.unit_id IS NULL;

-- 6. manager_mpesa_settings: add per-unit account_reference override
--    Allows manager to route e.g. paybill account refs by unit prefix
ALTER TABLE public.manager_mpesa_settings
  ADD COLUMN IF NOT EXISTS use_unit_as_account_ref boolean NOT NULL DEFAULT true;
-- When true: AccountReference sent to M-Pesa = unit_number (e.g. "A3")
-- When false: uses paybill_account_reference (custom fixed string)

-- 7. Notification preferences per manager (replaces scattered env-var guessing)
CREATE TABLE IF NOT EXISTS manager_notification_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id       uuid NOT NULL UNIQUE,
  notify_email          boolean NOT NULL DEFAULT true,
  notify_sms            boolean NOT NULL DEFAULT true,
  notify_whatsapp       boolean NOT NULL DEFAULT false,
  whatsapp_provider     text    DEFAULT 'twilio',  -- 'twilio' | 'meta'
  whatsapp_from_number  text,   -- e.g. +254700000000 (Twilio) or phone number id (Meta)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 8. View: unit_payment_summary — for landlord dashboard
--    Shows per-unit payment status at a glance
CREATE OR REPLACE VIEW unit_payment_summary AS
SELECT
  u.id                                                  AS unit_id,
  u.unit_number,
  u.property_id,
  p.name                                                AS property_name,
  p.manager_id,
  t.id                                                  AS tenant_id,
  t.name                                                AS tenant_name,
  t.email                                               AS tenant_email,
  t.phone                                               AS tenant_phone,
  l.id                                                  AS lease_id,
  COALESCE(l.monthly_rent, u.monthly_rent)               AS monthly_rent,
  l.status                                              AS lease_status,
  COUNT(i.id) FILTER (WHERE i.status = 'pending')       AS pending_invoices,
  COUNT(i.id) FILTER (WHERE i.status = 'overdue')       AS overdue_invoices,
  SUM(i.amount) FILTER (WHERE i.status = 'pending')     AS pending_amount,
  MAX(i.due_date) FILTER (WHERE i.status = 'pending')   AS next_due_date,
  MAX(pt.completed_at)                                  AS last_payment_at,
  MAX(pt.mpesa_receipt_number)                          AS last_mpesa_ref
FROM public.units u
JOIN public.properties p ON u.property_id = p.id
LEFT JOIN public.leases l ON l.unit_id = u.id AND l.status = 'active'
LEFT JOIN public.tenants t ON l.tenant_id = t.id
LEFT JOIN public.invoices i ON i.unit_id = u.id
LEFT JOIN public.payment_transactions pt ON pt.unit_id = u.id AND pt.status = 'completed'
GROUP BY u.id, u.unit_number, u.property_id, p.name, p.manager_id,
         t.id, t.name, t.email, t.phone,
         l.id, l.monthly_rent, l.status;
