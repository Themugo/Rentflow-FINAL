# Supabase Migration Instructions

## Migrations to Apply

The following migrations need to be applied to your Supabase database:

### 1. Migration: 20260601000000_enforce_management_structure.sql
**Purpose:** Enforce multi-tier management structure with RLS policies and landlord revenue-only view

**Key Changes:**
- Removes landlord direct access to tenants table
- Landlords can only access landlord_tenant_summary view (hides tenant PII)
- Enforces manager data isolation via RLS policies
- Blocks webhosts from tenant data

**How to Apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Open the file: `supabase/migrations/20260601000000_enforce_management_structure.sql`
3. Copy the entire SQL content
4. Paste into Supabase SQL Editor
5. Click "Run" to execute

### 2. Migration: 20260601000001_remove_agency_id_from_property_landlords.sql
**Purpose:** Remove deprecated agency_id column from property_landlords table

**Key Changes:**
- Drops agency_id column (no longer needed after agency→landlord refactor)
- Simplifies schema

**How to Apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Open the file: `supabase/migrations/20260601000001_remove_agency_id_from_property_landlords.sql`
3. Copy the entire SQL content
4. Paste into Supabase SQL Editor
5. Click "Run" to execute

## Verification

After applying migrations, verify:

1. Check that agency_id column is removed from property_landlords table:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'property_landlords' AND table_schema = 'public';
```

2. Verify landlord cannot access tenants table directly (should return error):
```sql
-- Run as a landlord user
SELECT * FROM public.tenants LIMIT 1;
```

3. Verify landlord can access landlord_tenant_summary view:
```sql
-- Run as a landlord user
SELECT * FROM public.landlord_tenant_summary LIMIT 1;
```

## Rollback (if needed)

If you need to rollback, you can manually revert the changes:

### Rollback Migration 2:
```sql
ALTER TABLE public.property_landlords ADD COLUMN agency_id uuid;
```

### Rollback Migration 1:
Restore the tenants_select_landlord policy:
```sql
CREATE POLICY "tenants_select_landlord"
  ON public.tenants FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'landlord'
    )
  );
```
