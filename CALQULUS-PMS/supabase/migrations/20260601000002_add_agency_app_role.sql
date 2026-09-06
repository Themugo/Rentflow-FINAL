-- Agency is now a first-class portal role.
-- Keep landlord here as a no-op guard for environments missing the earlier role migration.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'landlord';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agency';
