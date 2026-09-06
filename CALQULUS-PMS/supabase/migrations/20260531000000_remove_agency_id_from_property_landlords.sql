-- ──────────────────────────────────────────────────────────────
-- Remove agency_id column from property_landlords table
-- ──────────────────────────────────────────────────────────────
-- Agency relationships are now managed through property_landlords.operating_model
-- The agency_id column is no longer needed and should be removed
-- ──────────────────────────────────────────────────────────────

-- Drop the index first (without ON clause)
DROP INDEX IF EXISTS public.idx_property_landlords_agency_id;

-- Drop the column
ALTER TABLE public.property_landlords
  DROP COLUMN IF EXISTS agency_id;
