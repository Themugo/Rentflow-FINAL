-- M-Pesa: add property/unit scoping
ALTER TABLE public.manager_mpesa_settings
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;

ALTER TABLE public.manager_mpesa_settings
  DROP CONSTRAINT IF EXISTS manager_mpesa_settings_manager_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS manager_mpesa_settings_scope_uniq
  ON public.manager_mpesa_settings (
    manager_user_id,
    COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS manager_mpesa_settings_property_idx
  ON public.manager_mpesa_settings (property_id);

-- E-Wallet: add property/unit scoping
ALTER TABLE public.manager_ewallet_settings
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;

ALTER TABLE public.manager_ewallet_settings
  DROP CONSTRAINT IF EXISTS manager_ewallet_settings_manager_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS manager_ewallet_settings_scope_uniq
  ON public.manager_ewallet_settings (
    manager_user_id,
    COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    provider
  );

CREATE INDEX IF NOT EXISTS manager_ewallet_settings_property_idx
  ON public.manager_ewallet_settings (property_id);