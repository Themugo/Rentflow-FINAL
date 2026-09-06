-- Remove agency_id column from properties table
-- Agency relationships are now managed through property_landlords.operating_model
-- The agency_id column in properties is no longer needed and should be removed

-- Drop the foreign key constraint first
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_agency_id_fkey;

-- Drop the index if it exists
DROP INDEX IF EXISTS public.idx_properties_agency_id;

-- Drop the column
ALTER TABLE public.properties
  DROP COLUMN IF EXISTS agency_id;

-- Add a comment to document the change
COMMENT ON COLUMN public.properties.manager_id IS 'The manager who owns this property. Agency relationships are managed through property_landlords table.';
