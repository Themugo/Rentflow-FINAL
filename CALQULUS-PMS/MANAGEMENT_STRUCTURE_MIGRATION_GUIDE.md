# Management Structure Migration Guide

## Overview

This migration enforces the 4-tier management structure for CALQULUS RMS:

- **Tier 1: Platform ownership (Webhost)** - NO tenant data access ever
- **Tier 2: Property management (Managers/Agencies)** - Full tenant management
- **Tier 3: Property owners (Landlords)** - Managed vs System split
- **Tier 4: Tenants** - Only their property manager sees their data

## Migration File

`supabase/migrations/20260601000000_enforce_management_structure.sql`

## Steps to Apply Migration

### Option 1: Supabase SQL Editor (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `aelzsqxllkypbzslxyju`
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/20260601000000_enforce_management_structure.sql`
6. Paste into the SQL Editor
7. Click **Run**

### Option 2: Supabase CLI

```bash
supabase link --project-ref aelzsqxllkypbzslxyju
supabase db push
```

## What This Migration Does

### 1. Removes `can_manage_tenants` from admin_permissions
- Webhosts can NEVER have tenant data access
- Column dropped from table

### 2. Updates RLS policies for landlord split
- Webhost sees only system landlords (manager_id IS NULL)
- Manager-linked landlords (manager_id IS NOT NULL) are invisible to webhost

### 3. Enforces manager data isolation
- All tenant-related tables scoped by manager_id = auth.uid()
- Managers can only see their own tenants, invoices, payments
- Submanagers scoped to assigned properties

### 4. Creates landlord revenue-only view
- `landlord_tenant_summary` view hides all tenant PII
- No names, emails, or phone numbers
- Only aggregate revenue and occupancy data

### 5. Creates webhost manager invoices view
- `webhost_manager_invoices` shows only subscription invoices
- NO tenant rent payments visible to webhost
- Only manager subscription billing data

### 6. Adds helper functions
- `is_landlord_managed(landlord_user_id)` - Check if landlord is managed
- `get_webhost_landlords()` - Get landlords visible to webhost

### 7. Adds admin_level column to platform_admins
- Values: super_admin, admin, limited_admin
- Updates existing records based on admin_type

### 8. Adds performance indexes
- Indexes for landlord split queries (manager_id IS NULL vs NOT NULL)

### 9. Adds activity logging
- `access_blocked` column to track access violations
- Trigger to log webhost tenant access attempts

## Verification

After applying the migration, verify:

```sql
-- Check can_manage_tenants column removed
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'admin_permissions' AND column_name = 'can_manage_tenants';
-- Should return 0 rows

-- Check admin_level column added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'platform_admins' AND column_name = 'admin_level';
-- Should return 1 row

-- Check landlord_tenant_summary view exists
SELECT table_name FROM information_schema.views 
WHERE table_name = 'landlord_tenant_summary';
-- Should return 1 row

-- Check webhost_manager_invoices view exists
SELECT table_name FROM information_schema.views 
WHERE table_name = 'webhost_manager_invoices';
-- Should return 1 row
```

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Add back can_manage_tenants column (if needed)
ALTER TABLE public.admin_permissions ADD COLUMN can_manage_tenants BOOLEAN DEFAULT FALSE;

-- Drop views
DROP VIEW IF EXISTS public.landlord_tenant_summary;
DROP VIEW IF EXISTS public.webhost_manager_invoices;

-- Drop functions
DROP FUNCTION IF EXISTS public.is_landlord_managed;
DROP FUNCTION IF EXISTS public.get_webhost_landlords;
DROP FUNCTION IF EXISTS public.log_webhost_tenant_access_attempt;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_property_landlords_manager_id_null;
DROP INDEX IF EXISTS public.idx_property_landlords_manager_id_not_null;

-- Note: RLS policies would need to be manually restored from previous state
```

## Next Steps

After applying the migration:

1. **Test webhost access** - Ensure webhost cannot access tenant data
2. **Test manager isolation** - Ensure managers only see their own data
3. **Test landlord revenue view** - Ensure landlords see only revenue data, no PII
4. **Test system vs managed landlords** - Verify webhost sees only system landlords

## Support

If you encounter any issues:

1. Check Supabase logs for migration errors
2. Verify you have the necessary permissions
3. Ensure you're on the correct project: `aelzsqxllkypbzslxyju`
4. Contact support with error messages from SQL Editor
