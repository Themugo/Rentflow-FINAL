# Database Migration Rollback Guide

This document provides rollback procedures for CALQULUS PMS database migrations.

## Rollback Strategy

### Rollback Categories
- **Safe Rollbacks**: Reversible operations (ADD COLUMN, ADD INDEX, CREATE TABLE)
- **Data Loss Rollbacks**: Operations that may cause data loss (DROP COLUMN, DROP TABLE)
- **Complex Rollbacks**: Multi-step migrations requiring careful sequencing

### Rollback Prerequisites
1. Database backup created before migration
2. Current migration state documented
3. Rollback script tested in staging
4. Application compatibility verified
5. Stakeholders notified of rollback

## Critical Migration Rollbacks

### 20260601000000_enforce_management_structure.sql
**Risk Level**: HIGH  
**Data Loss**: YES  
**Rollback Complexity**: VERY HIGH

**Changes Made**:
- Dropped `can_manage_tenants` column from admin_permissions
- Updated RLS policies for multiple tables
- Created landlord_tenant_summary view
- Added multiple functions and indexes

**Rollback Procedure**:
```sql
-- Step 1: Restore can_manage_tenants column
ALTER TABLE public.admin_permissions 
ADD COLUMN IF NOT EXISTS can_manage_tenants boolean NOT NULL DEFAULT false;

-- Step 2: Restore previous RLS policies
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
CREATE POLICY "tenants_select"
  ON public.tenants FOR SELECT
  USING (auth.role() = 'authenticated');

-- Step 3: Remove landlord_tenant_summary view
DROP VIEW IF EXISTS public.landlord_tenant_summary;

-- Step 4: Remove new functions
DROP FUNCTION IF EXISTS public.is_landlord_managed(UUID);
DROP FUNCTION IF EXISTS public.get_webhost_landlords();

-- Step 5: Remove new indexes
DROP INDEX IF EXISTS idx_property_landlords_manager_id_null;
DROP INDEX IF EXISTS idx_property_landlords_manager_id_not_null;

-- Step 6: Remove admin_level column
ALTER TABLE public.platform_admins 
DROP COLUMN IF EXISTS admin_level;
```

**Warning**: This rollback may expose tenant data to webhost roles. Test thoroughly in staging.

---

### 20260604000000_financial_amount_check_constraints.sql
**Risk Level**: MEDIUM  
**Data Loss**: NO  
**Rollback Complexity**: LOW

**Changes Made**:
- Added CHECK constraints to financial tables (NOT VALID)
- Added supporting indexes

**Rollback Procedure**:
```sql
-- Step 1: Drop CHECK constraints
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_amount_positive;
ALTER TABLE public.manager_invoices DROP CONSTRAINT IF EXISTS manager_invoices_amount_positive;
ALTER TABLE public.expenditures DROP CONSTRAINT IF EXISTS expenditures_amount_positive;
ALTER TABLE public.payment_receipts DROP CONSTRAINT IF EXISTS payment_receipts_amount_positive;
ALTER TABLE public.manager_subscriptions DROP CONSTRAINT IF EXISTS manager_subscriptions_amount_positive;
ALTER TABLE public.property_amenity_charges DROP CONSTRAINT IF EXISTS property_amenity_charges_amount_positive;
ALTER TABLE public.property_deductions DROP CONSTRAINT IF EXISTS property_deductions_amount_positive;
ALTER TABLE public.deposit_deductions DROP CONSTRAINT IF EXISTS deposit_deductions_amount_positive;
ALTER TABLE public.deposit_refunds DROP CONSTRAINT IF EXISTS deposit_refunds_refund_amount_nonneg;
ALTER TABLE public.deposit_refunds DROP CONSTRAINT IF EXISTS deposit_refunds_total_deductions_nonneg;
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_deposit_amount_nonneg;
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_deposit_balance_nonneg;
ALTER TABLE public.maintenance_requests DROP CONSTRAINT IF EXISTS maintenance_requests_deposit_deduction_nonneg;
ALTER TABLE public.water_billing_config DROP CONSTRAINT IF EXISTS water_billing_config_flat_rate_nonneg;
ALTER TABLE public.water_meter_readings DROP CONSTRAINT IF EXISTS water_meter_readings_total_amount_nonneg;

-- Step 2: Drop supporting indexes
DROP INDEX IF EXISTS payment_transactions_invoice_id_idx;
DROP INDEX IF EXISTS invoices_tenant_id_idx;
DROP INDEX IF EXISTS invoices_property_id_idx;
DROP INDEX IF EXISTS invoices_unit_id_idx;
```

**Note**: This rollback removes data integrity protections. Consider carefully before executing.

---

### 20260603000000_remove_agency_id_from_properties.sql
**Risk Level**: HIGH  
**Data Loss**: YES  
**Rollback Complexity**: MEDIUM

**Changes Made**:
- Dropped agency_id column from properties table

**Rollback Procedure**:
```sql
-- Step 1: Restore agency_id column
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

-- Step 2: Create index
CREATE INDEX IF NOT EXISTS idx_properties_agency_id 
ON public.properties(agency_id);

-- Step 3: Restore RLS policies that reference agency_id
-- (Specific policies depend on your RLS configuration)
```

**Warning**: Data cannot be recovered after column drop unless backup exists.

---

### 20260506000002_authority_structure_v2.sql
**Risk Level**: HIGH  
**Data Loss**: NO  
**Rollback Complexity**: HIGH

**Changes Made**:
- Added landlord to app_role enum
- Added can_manage_system_landlords to admin_permissions
- Created property_landlords table
- Updated RLS policies

**Rollback Procedure**:
```sql
-- Step 1: Remove landlord from app_role enum
-- Note: PostgreSQL doesn't support removing enum values directly
-- Alternative: Create new enum without landlord and migrate data

-- Step 2: Remove can_manage_system_landlords column
ALTER TABLE public.admin_permissions 
DROP COLUMN IF EXISTS can_manage_system_landlords;

-- Step 3: Drop property_landlords table
DROP TABLE IF EXISTS public.property_landlords CASCADE;

-- Step 4: Restore previous RLS policies
-- (Specific policies depend on your previous configuration)
```

**Warning**: Enum value removal requires table recreation. Test thoroughly.

---

### 20260506000000_fix_properties_manager_column.sql
**Risk Level**: LOW  
**Data Loss**: NO  
**Rollback Complexity**: LOW

**Changes Made**:
- Added manager_id column to properties table
- Created index
- Enabled RLS
- Created RLS policies

**Rollback Procedure**:
```sql
-- Step 1: Disable RLS on properties
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop RLS policies
DROP POLICY IF EXISTS "manager_manages_own_properties" ON public.properties;
DROP POLICY IF EXISTS "submanager_reads_assigned_properties" ON public.properties;
DROP POLICY IF EXISTS "landlord_reads_owned_properties" ON public.properties;

-- Step 3: Drop index
DROP INDEX IF EXISTS idx_properties_manager_id;

-- Step 4: Drop manager_id column
ALTER TABLE public.properties 
DROP COLUMN IF EXISTS manager_id;
```

**Note**: This rollback removes manager-property relationships.

---

## Rollback Script Template

### Template Structure
```sql
-- ============================================================================
-- Rollback: [Migration Name]
-- Original Migration: [Migration File]
-- Rollback Date: [Date]
-- Risk Level: [LOW/MEDIUM/HIGH]
-- Data Loss: [YES/NO]
-- ============================================================================

BEGIN;

-- Step 1: [Description]
-- [SQL statements]

-- Step 2: [Description]
-- [SQL statements]

-- Continue with additional steps as needed

COMMIT;

-- Verification queries
SELECT [verification query];
```

### Rollback Best Practices
1. Always use transactions for atomic rollbacks
2. Include verification queries after rollback
3. Document data loss risks clearly
4. Test rollback scripts in staging first
5. Have database backup available before rollback
6. Notify stakeholders before executing rollback
7. Monitor application after rollback
8. Document rollback results

## Emergency Rollback Procedures

### Complete Database Restore
If rollback scripts fail or cause issues:

1. **Stop Application**: Prevent new data writes
2. **Assess Impact**: Determine affected functionality
3. **Restore Backup**: Use most recent pre-migration backup
4. **Verify Restore**: Check data integrity
5. **Restart Application**: Resume normal operations
6. **Investigate**: Determine root cause of failure
7. **Document**: Record incident for future reference

### Partial Rollback
If only specific migrations need rollback:

1. **Identify Target Migration**: Determine which migration to rollback
2. **Check Dependencies**: Verify dependent migrations
3. **Execute Rollback**: Run rollback script in order
4. **Verify Functionality**: Test affected features
5. **Monitor**: Watch for issues

## Rollback Testing

### Testing Checklist
- [ ] Rollback script executes without errors
- [ ] Data integrity maintained after rollback
- [ ] Application functions correctly after rollback
- [ ] Performance acceptable after rollback
- [ ] No orphaned data or references
- [ ] RLS policies work correctly
- [ ] Indexes properly restored/removed
- [ ] Functions and views work as expected

### Testing Environment
1. Use staging database for testing
2. Create backup before testing
3. Test with realistic data volume
4. Verify application functionality
5. Monitor for performance issues
6. Document test results

## Rollback Communication

### Pre-Rollback Communication
- Notify development team
- Inform stakeholders
- Alert users if downtime expected
- Provide estimated rollback time
- Share rollback plan

### Post-Rollback Communication
- Confirm rollback completion
- Report any issues encountered
- Provide system status update
- Document lessons learned
- Schedule follow-up review

## Rollback Monitoring

### Metrics to Monitor
- Database performance after rollback
- Application error rates
- User-reported issues
- Data integrity checks
- Query performance
- Connection pool status

### Alert Thresholds
- Error rate > 5% for 5 minutes
- Query latency > 2x baseline
- Connection pool exhaustion
- Data integrity check failures
- Application crash rate increase

## Rollback Documentation

### Required Documentation
- Rollback reason and trigger
- Rollback steps executed
- Issues encountered during rollback
- Verification results
- Post-rollback system status
- Lessons learned
- Recommendations for prevention

### Documentation Template
```markdown
## Rollback Report

**Date**: [Date]
**Migration**: [Migration Name]
**Trigger**: [Reason for rollback]
**Executor**: [Name]

### Rollback Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Issues Encountered
- [Issue 1]
- [Issue 2]

### Verification Results
- [Result 1]
- [Result 2]

### Post-Rollback Status
- System Status: [Status]
- Application Status: [Status]
- Data Integrity: [Status]

### Lessons Learned
- [Lesson 1]
- [Lesson 2]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]
```

## Rollback Automation

### Automated Rollback Considerations
- Implement automated rollback triggers
- Use CI/CD pipeline for rollback execution
- Integrate with monitoring and alerting
- Automate rollback verification
- Schedule regular rollback drills

### Automation Safety
- Require manual approval for production rollbacks
- Implement rollback confirmation steps
- Include pre-flight checks
- Maintain audit trail
- Test automation thoroughly

## Rollback Decision Tree

```
Migration Failure
├── Can fix with hotfix?
│   ├── Yes → Deploy hotfix
│   └── No → Continue
├── Data integrity at risk?
│   ├── Yes → Immediate rollback
│   └── No → Continue
├── User impact severe?
│   ├── Yes → Immediate rollback
│   └── No → Continue
├── Rollback available?
│   ├── Yes → Execute rollback
│   └── No → Restore from backup
└── Post-rollback actions
    ├── Verify system status
    ├── Monitor for issues
    ├── Document incident
    └── Schedule review
```

## Contact Information

### Rollback Contacts
- **Database Team**: [Contact]
- **DevOps Team**: [Contact]
- **Application Team**: [Contact]
- **Management**: [Contact]

### Escalation Path
1. **Level 1**: On-call engineer
2. **Level 2**: Team lead
3. **Level 3**: Engineering manager
4. **Level 4**: CTO/VP Engineering
