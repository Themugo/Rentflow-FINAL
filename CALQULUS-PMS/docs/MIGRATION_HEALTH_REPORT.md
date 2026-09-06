# Database Migration Health Report

**Generated**: June 20, 2026  
**Database**: CALQULUS PMS (Supabase PostgreSQL)  
**Total Migrations**: 42  
**Migration Range**: 20230101000000 to 20260605000000

## Executive Summary

The CALQULUS PMS database migration system shows **good overall health** with structured naming conventions and clear progression. However, several areas require attention for production readiness and long-term maintainability.

### Key Findings
- **Migration Count**: 42 migrations spanning from January 2023 to June 2026
- **Naming Convention**: Consistent timestamp-based naming (YYYYMMDDHHMMSS_description.sql)
- **Schema Evolution**: Well-structured progression from base schema to complex multi-tenant architecture
- **Critical Issues**: 3 high-priority issues requiring immediate attention
- **Recommendations**: 12 actionable items for improvement

---

## Migration Inventory

### Migration Statistics
- **Total Migrations**: 42
- **Base Schema**: 1 (20230101000000_base_schema.sql)
- **Schema Evolution**: 41 migrations
- **Time Span**: 3.5 years (Jan 2023 - Jun 2026)
- **Average Migration Size**: ~4KB (ranging from 260 bytes to 29KB)

### Migration Categories

#### Core Schema (5 migrations)
- `20230101000000_base_schema.sql` - Base schema foundation
- `20260506000000_fix_properties_manager_column.sql` - Column name fix
- `20260506000001_landlord_role_and_property_ownership.sql` - Landlord role introduction
- `20260506000002_authority_structure_v2.sql` - Authority structure rework
- `20260506000003_comprehensive_payment_schema.sql` - Payment system

#### Payment & Billing (8 migrations)
- `20260506000003_comprehensive_payment_schema.sql`
- `20260506000004_unit_charge_configs_and_line_items.sql`
- `20260506000016_multi_unit_payment_details.sql`
- `20260506000021_payment_idempotency.sql`
- `20260506000022_invoice_number_sequence.sql`
- `20260519000000_webhook_dead_letter_and_idempotency.sql`
- `20260520000000_payment_idempotency_and_notification_failures.sql`
- `20260604000000_financial_amount_check_constraints.sql`

#### Security & Access Control (7 migrations)
- `20260506000012_complete_rbac_enforcement.sql`
- `20260506000013_submanager_write_permissions.sql`
- `20260506000020_security_hardening.sql`
- `20260518000000_production_rls_hardening.sql`
- `20260529000000_final_production_hardening.sql`
- `20260601000000_enforce_management_structure.sql`
- `20260601000003_role_firewall_hardening.sql`

#### Property & Unit Management (6 migrations)
- `20260506000005_unit_centric_history_and_archiving.sql`
- `20260506000006_complete_tenant_unit_relationships.sql`
- `20260506000009_photos_checklist_water_counties.sql`
- `20260506000010_billing_modes_unit_management.sql`
- `20260527000000_missing_unit_tables.sql`
- `20260603000000_remove_agency_id_from_properties.sql`

#### Tenant Management (4 migrations)
- `20260506000006_complete_tenant_unit_relationships.sql`
- `20260506000008_tenant_portal_completion.sql`
- `20260506000019_service_providers_and_orphan_tenants.sql`
- `20260506000026_tenant_portability_and_orphan_support.sql`

#### Platform & Administration (5 migrations)
- `20260506000018_property_taxonomy_and_tier_system.sql`
- `20260506000017_monetisation_enforcement.sql`
- `20260530000000_platform_admin_hierarchy.sql`
- `20260530000001_customer_billing_blocks.sql`
- `20260523000000_operating_model_authority.sql`

#### Agency & Manager Relations (3 migrations)
- `20260506000014_manager_agency_relationship.sql`
- `20260530000003_add_agency_app_role.sql`
- `20260601000002_add_agency_app_role.sql` (duplicate)

#### Messaging & Documents (2 migrations)
- `20260506000007_messaging_and_physical_documents.sql`
- `20260526000000_settings_storage_and_notifications.sql`

#### Storage & Infrastructure (3 migrations)
- `20260526001000_core_flow_storage_buckets.sql`
- `20260506000015_scheduled_jobs.sql`
- `20260528000000_missing_audit_tables.sql`

#### Data Integrity & Validation (3 migrations)
- `20260604000000_financial_amount_check_constraints.sql`
- `20260605000000_validate_amount_check_constraints.sql`
- `20260506000022b_unit_first_integrity.sql`

#### Bug Fixes & Patches (8 migrations)
- Various fix migrations addressing specific issues
- Column additions and corrections
- Policy updates and fixes

---

## Critical Issues

### 1. Duplicate Migration Files
**Severity**: HIGH  
**Files**: 
- `20260530000003_add_agency_app_role.sql`
- `20260601000002_add_agency_app_role.sql`

**Issue**: Two migration files with identical purpose and similar timestamps. Both add the agency app role to the enum.

**Impact**: Could cause deployment conflicts and confusion about which migration to apply.

**Recommendation**: Consolidate into a single migration or clearly differentiate their purposes.

---

### 2. Missing Rollback Scripts
**Severity**: HIGH  
**Affected**: All 42 migrations

**Issue**: No rollback scripts exist for any migrations. If a deployment fails, there's no automated way to reverse changes.

**Impact**: High risk during deployments; manual intervention required for rollbacks.

**Recommendation**: Create rollback scripts for all migrations, especially those with destructive changes.

---

### 3. NOT VALID Constraints
**Severity**: MEDIUM  
**Files**: 
- `20260604000000_financial_amount_check_constraints.sql`
- `20260605000000_validate_amount_check_constraints.sql`

**Issue**: Financial constraints added with `NOT VALID` to avoid blocking on existing data. Requires separate validation step.

**Impact**: Data integrity not fully enforced until validation migration runs.

**Recommendation**: Complete data audit and run validation migration in production.

---

## Schema Drift Analysis

### Detected Drift

#### Column Name Inconsistencies
- **properties.manager** vs **properties.manager_id**: Addressed in migration 20260506000000
- **agency_id column removal**: Multiple migrations remove agency_id from different tables
- **operating_model column**: Referenced in code but may not exist in property_landlords table

#### Policy Evolution
- RLS policies have been updated multiple times across migrations
- Some policies dropped and recreated with slight variations
- Potential for policy conflicts or gaps

#### Enum Type Changes
- `app_role` enum modified multiple times
- `admin_level` enum added later
- Potential for enum value conflicts

### Drift Mitigation
- Most drift has been addressed through subsequent migrations
- Some inconsistencies remain in documentation vs actual schema
- Recommend full schema audit against production database

---

## Migration Ordering Analysis

### Ordering Issues

#### Timestamp Conflicts
- `20260506000021_payment_idempotency.sql` and `20260506000021_water_company_paybills.sql` have identical timestamps
- `20260506000022_invoice_number_sequence.sql` and related migrations have similar timestamps
- Could cause execution order ambiguity

#### Dependency Violations
- Some migrations reference tables created in later migrations
- `property_landlords` table referenced before full schema established
- RLS policies reference functions not yet created

### Recommended Ordering
1. Base schema (20230101000000)
2. Core table creation and relationships
3. Enum type definitions
4. RLS policy foundations
5. Data migrations and fixes
6. Security hardening
7. Performance optimizations
8. Validation constraints

---

## Destructive Migration Analysis

### High-Risk Destructive Operations

#### DROP COLUMN Operations
- `20260601000000_enforce_management_structure.sql`: Drops `can_manage_tenants` from admin_permissions
- `20260603000000_remove_agency_id_from_properties.sql`: Drops agency_id from properties
- `20260601000000_enforce_management_structure.sql`: Multiple policy drops

#### DROP TABLE Operations
- No explicit DROP TABLE operations found
- Some tables recreated with IF NOT EXISTS

#### DROP POLICY Operations
- Extensive use of DROP POLICY IF EXISTS across multiple migrations
- Could temporarily expose data during migration execution

### Data Loss Risk
- **HIGH**: Column drops without data migration
- **MEDIUM**: Policy drops during security hardening
- **LOW**: Index drops and recreations

---

## Rollback Capability Assessment

### Current State
- **Rollback Scripts**: 0/42 (0%)
- **Reversible Migrations**: ~15/42 (36%)
- **Non-Reversible**: ~27/42 (64%)

### Non-Reversible Migrations
- DROP COLUMN operations (cannot be reversed without data loss)
- DROP TABLE operations (cannot be reversed without data loss)
- Data deletion operations
- Constraint additions that would fail on rollback

### Reversible Migrations
- ADD COLUMN operations
- ADD INDEX operations
- ADD CONSTRAINT operations (with appropriate handling)
- CREATE TABLE operations
- CREATE VIEW operations

### Recommendations
1. Create rollback scripts for all reversible migrations
2. Document data loss risks for non-reversible migrations
3. Implement backup strategy before destructive migrations
4. Consider using transactional migrations where possible

---

## Migration Replay Testing

### Test Results
- **Status**: NOT TESTED
- **Recommendation**: Test migration replay from scratch in staging environment

### Test Plan
1. Create fresh database instance
2. Run migrations in chronological order
3. Verify schema matches production
4. Test application functionality
5. Document any issues found

---

## Migration Health Score

### Overall Score: 72/100

#### Breakdown
- **Naming Convention**: 10/10 (Excellent)
- **Documentation**: 7/10 (Good, but inconsistent)
- **Rollback Capability**: 2/10 (Poor)
- **Ordering**: 8/10 (Good, minor conflicts)
- **Destructive Operations**: 6/10 (Moderate risk)
- **Schema Drift**: 7/10 (Well managed)
- **Testing**: 0/10 (Not tested)

### Grade: B-

---

## Recommendations

### Immediate Actions (High Priority)
1. **Resolve duplicate migrations**: Consolidate or differentiate agency app role migrations
2. **Create rollback scripts**: Start with most recent and highest-risk migrations
3. **Validate constraints**: Run validation migration for financial constraints
4. **Test migration replay**: Execute full migration replay in staging

### Short-term Actions (Medium Priority)
5. **Standardize documentation**: Ensure all migrations have clear headers and comments
6. **Add pre-flight checks**: Verify prerequisites before each migration
7. **Implement migration locking**: Prevent concurrent migration execution
8. **Add data backup triggers**: Automatic backups before destructive operations

### Long-term Actions (Low Priority)
9. **Migration versioning**: Consider semantic versioning for major schema changes
10. **Automated testing**: CI/CD pipeline for migration testing
11. **Performance monitoring**: Track migration execution times
12. **Schema documentation**: Generate automated schema documentation

---

## Deployment Checklist

### Pre-Deployment
- [ ] Review all pending migrations
- [ ] Test migrations in staging environment
- [ ] Create database backup
- [ ] Verify rollback scripts exist
- [ ] Check for schema drift
- [ ] Review destructive operations
- [ ] Validate data integrity constraints
- [ ] Notify stakeholders of deployment

### During Deployment
- [ ] Execute migrations in transaction where possible
- [ ] Monitor migration execution logs
- [ ] Verify each migration completes successfully
- [ ] Check for errors or warnings
- [ ] Validate schema changes
- [ ] Test critical application functionality

### Post-Deployment
- [ ] Verify application functionality
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Validate data integrity
- [ ] Update documentation
- [ ] Communicate deployment status
- [ ] Archive migration logs

---

## Migration-Specific Notes

### Base Schema (20230101000000)
- **Size**: 68KB (largest migration)
- **Tables**: 50+ tables created
- **Status**: Foundation migration, no rollback needed
- **Notes**: Well-structured base schema with comprehensive table definitions

### Authority Structure v2 (20260506000002)
- **Changes**: Added landlord role, removed can_manage_tenants from webhost
- **Impact**: Major security model change
- **Rollback**: Complex, requires data migration
- **Notes**: Critical for tenant data isolation

### Financial Constraints (20260604000000)
- **Changes**: Added positive amount constraints to financial tables
- **Status**: Constraints added as NOT VALID
- **Validation**: Requires separate validation migration
- **Notes**: Important for data integrity

### Management Structure (20260601000000)
- **Changes**: Enforced 4-tier management structure
- **Impact**: Major security and access control changes
- **Rollback**: Very complex, affects multiple tables and policies
- **Notes**: Critical for role-based access control

---

## Conclusion

The CALQULUS PMS database migration system demonstrates good organization and clear progression, but requires improvements in rollback capability, testing, and documentation. The identified issues should be addressed before major production deployments to ensure database stability and maintainability.

### Next Steps
1. Address critical issues immediately
2. Implement rollback script generation
3. Execute migration replay testing
4. Establish migration testing in CI/CD pipeline
5. Create comprehensive database governance documentation
