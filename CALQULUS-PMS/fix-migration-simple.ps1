$file = "c:\Users\hp\Desktop\CALQULUS-RMS\supabase\migrations\20230101000000_base_schema.sql"
$content = Get-Content $file -Raw

# Fix END ; to END $$
$content = $content -replace 'END\s*;', 'END $$;'

# Replace each ADD CONSTRAINT IF NOT EXISTS with DO block pattern
$content = $content -replace '(?s)(-- submanager_property_assignments → properties\s*ALTER TABLE public\.submanager_property_assignments\s*ADD CONSTRAINT IF NOT EXISTS submanager_property_assignments_property_id_fkey\s*FOREIGN KEY \(property_id\) REFERENCES public\.properties\(id\) ON DELETE CASCADE;)', 
@"-- submanager_property_assignments → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'submanager_property_assignments_property_id_fkey'
  ) THEN
    ALTER TABLE public.submanager_property_assignments
      ADD CONSTRAINT submanager_property_assignments_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;"@

$content = $content -replace '(?s)(-- submanager_property_assignments → profiles \(submanager\)\s*ALTER TABLE public\.submanager_property_assignments\s*ADD CONSTRAINT IF NOT EXISTS submanager_property_assignments_submanager_user_id_fkey\s*FOREIGN KEY \(submanager_user_id\) REFERENCES public\.profiles\(id\) ON DELETE CASCADE;)', 
@"-- submanager_property_assignments → profiles (submanager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'submanager_property_assignments_submanager_user_id_fkey'
  ) THEN
    ALTER TABLE public.submanager_property_assignments
      ADD CONSTRAINT submanager_property_assignments_submanager_user_id_fkey
      FOREIGN KEY (submanager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;"@

$content = $content -replace '(?s)(-- tenant_history → tenants\s*ALTER TABLE public\.tenant_history\s*ADD CONSTRAINT IF NOT EXISTS tenant_history_tenant_id_fkey\s*FOREIGN KEY \(tenant_id\) REFERENCES public\.tenants\(id\) ON DELETE CASCADE;)', 
@"-- tenant_history → tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenant_history_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.tenant_history
      ADD CONSTRAINT tenant_history_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;"@

$content = $content -replace '(?s)(-- tenants → profiles \(manager\)\s*ALTER TABLE public\.tenants\s*ADD CONSTRAINT IF NOT EXISTS tenants_manager_id_fkey\s*FOREIGN KEY \(manager_id\) REFERENCES public\.profiles\(id\) ON DELETE SET NULL;)', 
@"-- tenants → profiles (manager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_manager_id_fkey'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;"@

$content = $content -replace '(?s)(-- tenants → properties\s*ALTER TABLE public\.tenants\s*ADD CONSTRAINT IF NOT EXISTS tenants_property_id_fkey\s*FOREIGN KEY \(property_id\) REFERENCES public\.properties\(id\) ON DELETE SET NULL;)', 
@"-- tenants → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_property_id_fkey'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
END $$;"@

$content = $content -replace '(?s)(-- tenants → units\s*ALTER TABLE public\.tenants\s*ADD CONSTRAINT IF NOT EXISTS tenants_unit_id_fkey\s*FOREIGN KEY \(unit_id\) REFERENCES public\.units\(id\) ON DELETE SET NULL;)', 
@"-- tenants → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_unit_id_fkey'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
  END IF;
END $$;"@

$content = $content -replace '(?s)(-- unit_water_config → properties\s*ALTER TABLE public\.unit_water_config\s*ADD CONSTRAINT IF NOT EXISTS unit_water_config_property_id_fkey\s*FOREIGN KEY \(property_id\) REFERENCES public\.properties\(id\) ON DELETE CASCADE;)', 
@"-- unit_water_config → properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unit_water_config_property_id_fkey'
  ) THEN
    ALTER TABLE public.unit_water_config
      ADD CONSTRAINT unit_water_config_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;
END $$;"@

$content = $content -replace '(?s)(-- unit_water_config → units\s*ALTER TABLE public\.unit_water_config\s*ADD CONSTRAINT IF NOT EXISTS unit_water_config_unit_id_fkey\s*FOREIGN KEY \(unit_id\) REFERENCES public\.units\(id\) ON DELETE CASCADE;)', 
@"-- unit_water_config → units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unit_water_config_unit_id_fkey'
  ) THEN
    ALTER TABLE public.unit_water_config
      ADD CONSTRAINT unit_water_config_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;
  END IF;
END $$;"@

$content | Set-Content $file
Write-Host "Fixed remaining ADD CONSTRAINT IF NOT EXISTS statements"
