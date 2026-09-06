$file = "c:\Users\hp\Desktop\CALQULUS-RMS\supabase\migrations\20230101000000_base_schema.sql"
$content = Get-Content $file
$newContent = @()

$i = 0
while ($i -lt $content.Count) {
    $line = $content[$i]
    
    # Check if this line starts an ADD CONSTRAINT IF NOT EXISTS pattern
    if ($line -match '^\s*-- submanager_property_assignments → properties$') {
        # Replace with DO block
        $newContent += "-- submanager_property_assignments → properties"
        $newContent += "DO $$"
        $newContent += "BEGIN"
        $newContent += "  IF NOT EXISTS ("
        $newContent += "    SELECT 1 FROM pg_constraint"
        $newContent += "    WHERE conname = 'submanager_property_assignments_property_id_fkey'"
        $newContent += "  ) THEN"
        $newContent += "    ALTER TABLE public.submanager_property_assignments"
        $newContent += "      ADD CONSTRAINT submanager_property_assignments_property_id_fkey"
        $newContent += "      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;"
        $newContent += "  END IF;"
        $newContent += "END $$;"
        # Skip the next 3 lines (the original ALTER TABLE statements)
        $i += 4
        continue
    }
    
    if ($line -match '^\s*-- submanager_property_assignments → profiles \(submanager\)$') {
        $newContent += "-- submanager_property_assignments → profiles (submanager)"
        $newContent += "DO $$"
        $newContent += "BEGIN"
        $newContent += "  IF NOT EXISTS ("
        $newContent += "    SELECT 1 FROM pg_constraint"
        $newContent += "    WHERE conname = 'submanager_property_assignments_submanager_user_id_fkey'"
        $newContent += "  ) THEN"
        $newContent += "    ALTER TABLE public.submanager_property_assignments"
        $newContent += "      ADD CONSTRAINT submanager_property_assignments_submanager_user_id_fkey"
        $newContent += "      FOREIGN KEY (submanager_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;"
        $newContent += "  END IF;"
        $newContent += "END $$;"
        $i += 4
        continue
    }
    
    if ($line -match '^\s*-- tenant_history → tenants$') {
        $newContent += "-- tenant_history → tenants"
        $newContent += "DO $$"
        $newContent += "BEGIN"
        $newContent += "  IF NOT EXISTS ("
        $newContent += "    SELECT 1 FROM pg_constraint"
        $newContent += "    WHERE conname = 'tenant_history_tenant_id_fkey'"
        $newContent += "  ) THEN"
        $newContent += "    ALTER TABLE public.tenant_history"
        $newContent += "      ADD CONSTRAINT tenant_history_tenant_id_fkey"
        $newContent += "      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;"
        $newContent += "  END IF;"
        $newContent += "END $$;"
        $i += 4
        continue
    }
    
    if ($line -match '^\s*-- tenants → profiles \(manager\)$') {
        $newContent += "-- tenants → profiles (manager)"
        $newContent += "DO $$"
        $newContent += "BEGIN"
        $newContent += "  IF NOT EXISTS ("
        $newContent += "    SELECT 1 FROM pg_constraint"
        $newContent += "    WHERE conname = 'tenants_manager_id_fkey'"
        $newContent += "  ) THEN"
        $newContent += "    ALTER TABLE public.tenants"
        $newContent += "      ADD CONSTRAINT tenants_manager_id_fkey"
        $newContent += "      FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;"
        $newContent += "  END IF;"
        $newContent += "END $$;"
        $i += 4
        continue
    }
    
    if ($line -match '^\s*-- tenants → properties$') {
        $newContent += "-- tenants → properties"
        $newContent += "DO $$"
        $newContent += "BEGIN"
        $newContent += "  IF NOT EXISTS ("
        $newContent += "    SELECT 1 FROM pg_constraint"
        $newContent += "    WHERE conname = 'tenants_property_id_fkey'"
        $newContent += "  ) THEN"
        $newContent += "    ALTER TABLE public.tenants"
        $newContent += "      ADD CONSTRAINT tenants_property_id_fkey"
        $newContent += "      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;"
        $newContent += "  END IF;"
        $newContent += "END $$;"
        $i += 4
        continue
    }
    
    if ($line -match '^\s*-- tenants → units$') {
        $newContent += "-- tenants → units"
        $newContent += "DO $$"
        $newContent += "BEGIN"
        $newContent += "  IF NOT EXISTS ("
        $newContent += "    SELECT 1 FROM pg_constraint"
        $newContent += "    WHERE conname = 'tenants_unit_id_fkey'"
        $newContent += "  ) THEN"
        $newContent += "    ALTER TABLE public.tenants"
        $newContent += "      ADD CONSTRAINT tenants_unit_id_fkey"
        $newContent += "      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;"
        $newContent += "  END IF;"
        $newContent += "END $$;"
        $i += 4
        continue
    }
    
    if ($line -match '^\s*-- unit_water_config → properties$') {
        $newContent += "-- unit_water_config → properties"
        $newContent += "DO $$"
        $newContent += "BEGIN"
        $newContent += "  IF NOT EXISTS ("
        $newContent += "    SELECT 1 FROM pg_constraint"
        $newContent += "    WHERE conname = 'unit_water_config_property_id_fkey'"
        $newContent += "  ) THEN"
        $newContent += "    ALTER TABLE public.unit_water_config"
        $newContent += "      ADD CONSTRAINT unit_water_config_property_id_fkey"
        $newContent += "      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;"
        $newContent += "  END IF;"
        $newContent += "END $$;"
        $i += 4
        continue
    }
    
    if ($line -match '^\s*-- unit_water_config → units$') {
        $newContent += "-- unit_water_config → units"
        $newContent += "DO $$"
        $newContent += "BEGIN"
        $newContent += "  IF NOT EXISTS ("
        $newContent += "    SELECT 1 FROM pg_constraint"
        $newContent += "    WHERE conname = 'unit_water_config_unit_id_fkey'"
        $newContent += "  ) THEN"
        $newContent += "    ALTER TABLE public.unit_water_config"
        $newContent += "      ADD CONSTRAINT unit_water_config_unit_id_fkey"
        $newContent += "      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;"
        $newContent += "  END IF;"
        $newContent += "END $$;"
        $i += 4
        continue
    }
    
    # Fix END ; to END $$
    if ($line -match '^\s*END\s*;$') {
        $line = $line -replace 'END\s*;$', 'END $$;'
    }
    
    $newContent += $line
    $i++
}

$newContent | Set-Content $file
Write-Host "Fixed remaining ADD CONSTRAINT IF NOT EXISTS statements"
