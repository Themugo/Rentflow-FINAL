# Agency Landlord-First Operations Centre — 2026-09-06

## Baseline

Built on the committed CALQULUS `main` foundation at `f2da729454017e3c6f95615ca3e6585c19c70ba0`.

## Product decision

Agency users should not be forced to rely on landlord self-service invitations. The agency can create a landlord account itself, attach multiple properties, and then operate from a landlord-first hierarchy.

A landlord may therefore have:

- one CALQULUS landlord identity;
- many properties;
- properties in different towns/locations;
- different property-level operating/payment rules;
- property-specific occupants and operational records.

The landlord identity is the relationship root; the property remains the operational root for tenants, billing and maintenance.

## UX hierarchy

`Agency dashboard → Landlord book → Landlord workspace → Property → Tenants / operations`

The Agency sidebar exposes a dynamic **Landlord book** using the same canonical navigation shell. The landlord workspace groups properties with location, units, tenants and occupancy. Tenant management remains property-scoped so agency users do not get a mixed tenant list detached from the building context.

## Account creation

The agency can create a landlord account directly. The server creates the Auth user and landlord role, generates a secure activation token, and atomically links the selected properties after revalidating that every selected property belongs to the agency.

No password is displayed or transmitted to the agency user. The resulting activation link can be copied and handed to a landlord who is less comfortable with technology.

## Security boundaries

- Auth user creation occurs only inside the `create-agency-landlord-account` edge function.
- The edge function authenticates the caller and requires an approved agency role.
- Selected properties are revalidated against the authenticated agency before relationship creation.
- Relationship provisioning uses a service-role-only RPC.
- The RPC independently revalidates the agency role, landlord role and property ownership.
- Existing property-level rules remain intact; this change does not flatten configuration into the landlord level.

## Dashboard refinement

The Agency dashboard is now presented as an operations centre with:

- command tabs for Overview, Landlords, Properties, Collections, Operations and Controls;
- color-coded operational pulse cards;
- existing live KPI cards;
- collection/arrears trend graph;
- attention queue;
- landlord portfolio panel;
- property performance panel;
- service-model panel;
- recent activity timeline.

The existing live data hook and canonical routes are reused; no parallel Agency dashboard system is introduced.
