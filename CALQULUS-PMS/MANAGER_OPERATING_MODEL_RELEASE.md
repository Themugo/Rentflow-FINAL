# Property Manager Operating Model — Release Update

This release is based directly on the supplied CALQULUS PMS master repository snapshot. It does **not** replace the Agency implementation or create a parallel PMS.

## Manager model

A Property Manager is an independent operator who may manage properties for many unrelated owners/clients. The manager's primary responsibility is the wellbeing of:

- properties and units
- occupants and tenants
- maintenance and service delivery
- external providers/vendors
- operational communication
- compliance and property records

The owner may retain:

- rent collections
- financial oversight
- approval of financial commitments
- distributions

or explicitly delegate selected financial authority to the manager.

## Delivered

- First-class Property Manager portal shell using the existing shared portal framework.
- Manager dashboard operating-model summary.
- Per-property Management Control workspace.
- Independent client classification: individual, family, company, institution, staff quarters, nonprofit, other.
- Per-property management fee configuration.
- Per-property financial authority boundary.
- Per-property tenant/lease/maintenance/vendor/communication authority.
- Operational spend limit and owner approval threshold.
- Owner portal enable/disable.
- Owner visibility matrix for the existing Landlord portal.
- Owner reporting cadence and delivery configuration.
- Configurable report sections.
- Atomic server-side save functions and direct-write revocation.
- Manager-only Management Control navigation; submanagers do not receive the control surface.

## Existing architecture intentionally preserved

- `property_landlords` remains the owner/property relationship.
- `properties.manager_id` remains manager portfolio scope.
- Existing tenant, unit and lease systems remain authoritative.
- Existing maintenance/vendor systems remain authoritative.
- Existing billing/payment/ledger systems remain authoritative.
- Existing Landlord portal remains the owner portal.
- Existing reporting engine remains authoritative.
- Agency remains a separate operating model.

## Important implementation boundary

The mandate layer is the manager's authority/configuration source. Existing financial and operational RPCs are not duplicated or rewritten wholesale in this release. The new `manager_property_authority()` function is the central server-side authority primitive for subsequent lifecycle guards, allowing those existing RPCs to be hardened without creating a second financial engine.

## Verification

Static repository verification completed for the new migration, manager portal shell, navigation, dashboard integration, Management Control UI, route ownership and regression test. Full npm verification requires installing the repository dependencies locally.
