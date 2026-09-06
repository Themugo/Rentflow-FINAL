# ADR-006: Multi-Tenant Data Isolation Strategy

**Status**: Accepted  
**Date**: 2024-03-15  
**Deciders**: Platform Team, Security Team

## Context

CALQULUS RMS serves multiple property managers (tenants) on a shared infrastructure. Each tenant must be completely isolated from others to ensure:

1. **Data Privacy**: Tenant A cannot see Tenant B's tenants, payments, or properties
2. **Financial Integrity**: Payments cannot be mixed between tenants
3. **Security**: A breach in one tenant's data cannot affect others

## Decision

We implement **database-level isolation** using PostgreSQL Row-Level Security (RLS):

### Isolation Layers

1. **Row-Level Security (RLS)**: Primary isolation mechanism
2. **Application-Level Authorization**: Supplementary checks in edge functions
3. **Manager ID Scoping**: All queries scoped by `manager_id`

### RLS Policy Examples

```sql
-- Properties: Managers only see their own
CREATE POLICY "properties_manager_isolation" ON properties
  FOR ALL USING (
    auth.uid() = manager_id 
    OR 
    -- Submanagers see assigned properties
    EXISTS (
      SELECT 1 FROM submanager_property_assignments spa
      WHERE spa.submanager_user_id = auth.uid()
      AND spa.property_id = properties.id
    )
  );

-- Tenants: Never accessible by webhosts
CREATE POLICY "tenants_no_webhost_access" ON tenants
  FOR ALL USING (
    -- Tenant can see own record
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'tenant'
      AND ur.tenant_id = tenants.id
    )
    OR
    -- Manager can see tenants in their properties
    EXISTS (
      SELECT 1 FROM units u
      JOIN properties p ON p.id = u.property_id
      WHERE u.id = tenants.unit_id
      AND p.manager_id = auth.uid()
    )
  );
```

### Tenant Isolation Rules

| Role | Can See Own Data | Can See Other Tenants | Can See Platform |
|------|-----------------|----------------------|------------------|
| Webhost | N/A | No (platform only) | Yes |
| Manager | All own tenants | N/A | No |
| Submanager | Assigned only | No | No |
| Landlord | Own properties | No | No |
| Tenant | Own profile | No | No |

### Landlord Revenue-Only View

Landlords must see aggregate revenue without tenant PII:

```sql
-- Property cards show occupancy, NOT tenant names
CREATE VIEW landlord_property_summary AS
SELECT 
  p.id,
  p.address,
  COUNT(DISTINCT u.id) as total_units,
  COUNT(DISTINCT CASE WHEN t.status = 'active' THEN t.id END) as occupied_units,
  SUM(u.monthly_rent) as total_monthly_rent,
  -- NO tenant names, emails, or PII
FROM properties p
JOIN units u ON u.property_id = p.id
LEFT JOIN tenants t ON t.unit_id = u.id
JOIN property_landlords pl ON pl.property_id = p.id
WHERE pl.landlord_user_id = auth.uid()
GROUP BY p.id;
```

## Consequences

### Benefits

- **Strong Isolation**: Database-level enforcement prevents data leakage
- **Defense in Depth**: RLS + application checks = robust security
- **No Schema Multi-tenancy**: Single database simplifies operations
- **Performance**: Shared infrastructure is more cost-effective

### Drawbacks

- **RLS Complexity**: Complex policies are harder to audit
- **Query Performance**: RLS adds slight overhead
- **Testing**: Must test isolation for every new table

## References

- [Database Security Audit Report](../../DATABASE_SECURITY_AUDIT_REPORT.md)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Tenant Isolation Tests](../../src/test/isolation/tenant-separation.test.ts)
