-- ============================================================
-- CALQULUS RMS: Fix properties.manager column name mismatch
-- The properties table has column 'manager' but all code
-- expects 'manager_id'. Add manager_id as a proper FK column
-- and copy data from 'manager'.
-- ============================================================

-- Step 1: Add manager_id column if it doesn't exist
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: manager_id column already has correct data
-- (the 'manager' column does not exist — manager_id is the correct column name)
-- Nothing to copy

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_properties_manager_id ON public.properties(manager_id);

-- Step 4: Enable RLS on properties (so each manager sees only their own)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
DROP POLICY IF EXISTS "manager_manages_own_properties" ON public.properties;
CREATE POLICY "manager_manages_own_properties"
  ON public.properties FOR ALL
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "submanager_reads_assigned_properties" ON public.properties;
CREATE POLICY "submanager_reads_assigned_properties"
  ON public.properties FOR SELECT
  USING (
    id IN (
      SELECT unnest(assigned_property_ids)
      FROM public.submanager_permissions
      WHERE submanager_user_id = auth.uid()
    )
  );

-- property_landlords is created by later migration 20260506000002; the same
-- policy is (re)created by 20260506000012_complete_rbac_enforcement.sql.
-- Guard so an empty-database replay does not fail.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'property_landlords') THEN
    DROP POLICY IF EXISTS "landlord_reads_owned_properties" ON public.properties;
    CREATE POLICY "landlord_reads_owned_properties"
      ON public.properties FOR SELECT
      USING (
        id IN (
          SELECT property_id FROM public.property_landlords
          WHERE landlord_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Step 6: Verify the fix
SELECT
  COUNT(*) as total_properties,
  COUNT(manager_id) as with_manager_id
FROM public.properties;
