# ADR-002: Three-Role Architecture (Manager/Agency/Landlord)

**Status**: Accepted  
**Date**: 2024-03-20  
**Deciders**: Platform Team, Product Team

## Context

We needed to design the platform's role hierarchy to support different user types with distinct needs:

- **Webhost**: Platform owner selling subscriptions
- **Manager**: Property management companies managing units
- **Agency**: Blended agents managing properties for landlords (commission model)
- **Landlord**: Property owners wanting revenue visibility without tenant access
- **Submanager**: Restricted staff under managers
- **Tenant**: Renters accessing their portal

The challenge was designing an architecture that:
1. Supports multiple business models (self-managed, agency-managed, manager-operated)
2. Enforces strict tenant PII protection for landlords
3. Allows flexible property ownership configurations
4. Supports the Kenyan market's specific payment flows (M-Pesa)

## Decision

We implemented a **three-tier role architecture** with distinct portals:

### Tier 1: Platform Ownership (Webhost)
- Platform administrators managing the system
- No direct access to tenant data
- Manages subscription tiers and billing

### Tier 2: Property Management (Three Portal Types)
1. **Manager Portal** (`/`)
   - Full property operations
   - Direct tenant management
   - Payment collection to landlord or own accounts

2. **Agency Portal** (`/agency`)
   - Manages properties on behalf of landlords
   - Commission-based model
   - Can collect rent to agency accounts

3. **Landlord Portal** (`/landlord/dashboard`)
   - Revenue-only view
   - Zero tenant PII access
   - Property cards with occupancy/revenue bars

### Tier 3: Tenants
- Own portal only (`/portal`)
- No cross-tenant data access
- Self-service payments and maintenance

## Data Model

```sql
-- User roles junction table
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('webhost', 'manager', 'submanager', 'landlord', 'tenant', 'agency')),
  tenant_id UUID,
  manager_id UUID,
  approval_status TEXT DEFAULT 'pending'
);

-- Property ownership configuration
CREATE TABLE property_landlords (
  property_id UUID REFERENCES properties,
  landlord_user_id UUID REFERENCES auth.users,
  manager_id UUID REFERENCES auth.users,
  revenue_share_pct DECIMAL(5,2),
  operating_model TEXT CHECK (operating_model IN ('manager_operates', 'agency_collects')),
  payment_destination TEXT CHECK (payment_destination IN ('landlord', 'manager'))
);
```

## Access Control Matrix

| Resource | Webhost | Manager | Agency | Submanager | Landlord | Tenant |
|----------|---------|---------|--------|------------|----------|--------|
| Platform Settings | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| All Properties | Read-only | Full | Full | Assigned | Own | ✗ |
| Tenant PII | ✗ | ✓ | ✓ | ✓ (restricted) | ✗ | Own only |
| Payment Data | ✗ | ✓ | ✓ | ✓ (restricted) | Revenue only | Own only |
| Landlord PII | ✗ | ✓ | ✓ | ✗ | Own only | ✗ |

## Consequences

### Benefits

- **Clear Separation**: Each role has a distinct portal with appropriate access
- **Tenant Protection**: Landlords cannot see tenant PII by design
- **Flexible Business Models**: Supports manager-operated, agency, and self-managed properties
- **Audit Trail**: Role changes tracked in user_roles table

### Drawbacks

- **Complexity**: Three portals increase development and maintenance effort
- **Submanager Permissions**: Complex permission model requires careful RLS policies
- **Agency/Landlord Distinction**: Can be confusing when agencies also have landlord accounts

## References

- [Role Architecture Overview](../docs/ARCHITECTURE_OVERVIEW.md)
- [Landlord PII Protection](./adr-006-multi-tenant-isolation.md)
- [Manager User Manual](../docs/MANAGER_USER_MANUAL.md)
