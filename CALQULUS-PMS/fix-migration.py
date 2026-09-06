file_path = r"c:\Users\hp\Desktop\CALQULUS-RMS\supabase\migrations\20230101000000_base_schema.sql"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix END ; to END $$
content = content.replace('END ;', 'END $$;')

# Replace remaining ADD CONSTRAINT IF NOT EXISTS with DO blocks
replacements = [
    ('-- submanager_property_assignments → properties\nALTER TABLE public.submanager_property_assignments\n  ADD CONSTRAINT IF NOT EXISTS submanager_property_assignments_property_id_fkey\n  FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;',
     '''-- submanager_property_assignments → properties
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
END $$;'''),
    
    ('-- submanager_property_assignments → profiles (submanager)\nALTER TABLE public.submanager_property_assignments\n  ADD CONSTRAINT IF NOT EXISTS submanager_property_assignments_submanager_user_id_fkey\n  FOREIGN KEY (submanager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;',
     '''-- submanager_property_assignments → profiles (submanager)
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
END $$;'''),
    
    ('-- tenant_history → tenants\nALTER TABLE public.tenant_history\n  ADD CONSTRAINT IF NOT EXISTS tenant_history_tenant_id_fkey\n  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;',
     '''-- tenant_history → tenants
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
END $$;'''),
    
    ('-- tenants → profiles (manager)\nALTER TABLE public.tenants\n  ADD CONSTRAINT IF NOT EXISTS tenants_manager_id_fkey\n  FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;',
     '''-- tenants → profiles (manager)
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
END $$;'''),
    
    ('-- tenants → properties\nALTER TABLE public.tenants\n  ADD CONSTRAINT IF NOT EXISTS tenants_property_id_fkey\n  FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;',
     '''-- tenants → properties
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
END $$;'''),
    
    ('-- tenants → units\nALTER TABLE public.tenants\n  ADD CONSTRAINT IF NOT EXISTS tenants_unit_id_fkey\n  FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;',
     '''-- tenants → units
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
END $$;'''),
    
    ('-- unit_water_config → properties\nALTER TABLE public.unit_water_config\n  ADD CONSTRAINT IF NOT EXISTS unit_water_config_property_id_fkey\n  FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;',
     '''-- unit_water_config → properties
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
END $$;'''),
    
    ('-- unit_water_config → units\nALTER TABLE public.unit_water_config\n  ADD CONSTRAINT IF NOT EXISTS unit_water_config_unit_id_fkey\n  FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;',
     '''-- unit_water_config → units
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
END $$;'''),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed remaining ADD CONSTRAINT IF NOT EXISTS statements")
