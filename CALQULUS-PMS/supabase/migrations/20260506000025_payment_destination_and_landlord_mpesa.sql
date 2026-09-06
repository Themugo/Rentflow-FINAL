-- Payment Destination: controls who receives M-Pesa payments for a property
-- 'manager'  = the property manager receives payments (default, existing behavior)
-- 'landlord' = the property owner receives payments directly
ALTER TABLE public.property_landlords
  ADD COLUMN IF NOT EXISTS payment_destination text NOT NULL DEFAULT 'manager'
  CHECK (payment_destination IN ('manager', 'landlord'));

-- Track which party receives each payment transaction
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS landlord_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_receiver_type    text NOT NULL DEFAULT 'manager'
    CHECK (payment_receiver_type IN ('manager', 'landlord'));

-- Landlord M-Pesa Settings: separate from manager_mpesa_settings
-- Used when payment_destination = 'landlord' on property_landlords
CREATE TABLE IF NOT EXISTS public.landlord_mpesa_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id              uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id                  uuid REFERENCES public.units(id) ON DELETE SET NULL,
  consumer_key             text,
  consumer_secret          text,
  is_live                  boolean NOT NULL DEFAULT false,
  paybill_enabled          boolean NOT NULL DEFAULT false,
  paybill_shortcode        text,
  paybill_passkey          text,
  paybill_account_reference text,
  till_enabled             boolean NOT NULL DEFAULT false,
  till_shortcode           text,
  till_passkey             text,
  use_unit_as_account_ref  boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS landlord_mpesa_settings_scope_uniq
  ON public.landlord_mpesa_settings (
    landlord_user_id,
    COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS landlord_mpesa_settings_property_idx
  ON public.landlord_mpesa_settings (property_id);

CREATE INDEX IF NOT EXISTS landlord_mpesa_settings_landlord_idx
  ON public.landlord_mpesa_settings (landlord_user_id);
