# CALQULUS PMS — Independent Property Manager Operating Model

Date: 2026-09-06

## Purpose

This initiative builds the Property Manager model **on top of the existing CALQULUS PMS architecture**. It does not replace or fork the Agency, Landlord, Tenant, billing, maintenance, reporting or property systems.

A Property Manager is an operator engaged by an owner. The manager can run the wellbeing of the property, occupants and external providers while the owner may retain collections, financial oversight and distributions. A different mandate can delegate some or all financial authority to the manager.

The same manager can therefore operate properties for unrelated owners, companies, institutions or staff-quarter portfolios without becoming an Agency.

## Existing foundations reused

- `properties.manager_id` remains the manager's operational portfolio scope.
- `property_landlords` remains the manager ↔ owner ↔ property relationship.
- Existing tenants, units and leases remain the occupancy source of truth.
- Existing maintenance/vendor/work-order flows remain the operating source of truth.
- Existing billing, payment, ledger, statements and payout systems remain the financial source of truth.
- Existing landlord portal remains the owner-facing portal.
- Existing manager/submanager permissions remain the workforce delegation model.
- Existing reports and controlled reporting remain the reporting engine.

## New manager-specific layer

### `manager_owner_profiles`

Classifies the client relationship without creating an Agency client hierarchy. Supported client types include individual, family, company, institution, staff quarters, nonprofit and other.

### `manager_management_mandates`

Per-property authority contract containing:

- management status
- management fee model/value
- owner collection authority
- owner financial authority
- owner distribution authority
- manager collection authority
- manager financial approval authority
- manager distribution authority
- tenant/lease authority
- maintenance/provider authority
- tenant communication authority
- operational spend authority and limit
- owner approval threshold
- owner portal enablement
- owner visibility matrix
- reporting frequency
- reporting delivery
- report sections
- effective dates and notes

### Atomic authority functions

- `save_manager_owner_profile_atomic`
- `save_manager_management_mandate_atomic`
- `manager_property_authority`

Direct table mutations for mandate configuration are revoked for authenticated users. Configuration goes through the server-side RPC boundary.

## Manager portal

Added a dedicated `ManagerLayout` using the shared `PortalDeskShell` so the manager experience is a first-class portal rather than an Agency clone.

Added `/management-control` for per-property owner/client mandate configuration.

Manager navigation now exposes **Management control**. Submanagers do not receive this control surface.

## Manager dashboard

The existing manager dashboard remains the operational dashboard and now includes a compact Management Mandate control surface showing:

- owner-controlled finance count
- manager collection delegation count
- maintenance/operational authority coverage
- owner reporting configuration

The existing dashboard intelligence and financial systems remain intact; no parallel KPI or accounting source was created.

## Owner relationship

The manager configuration controls the existing Landlord portal visibility rather than creating a second owner portal.

Visibility can be assigned for:

- property
- units
- occupancy
- tenants
- maintenance
- vendors
- documents
- contracts
- leases
- collections
- financials
- distributions

Reporting can be configured as none, exception-only, weekly, monthly or quarterly, delivered through portal, email or both, with selected report sections.

## Tenant relationship

The manager remains the operational contact for tenant wellbeing, maintenance, lease administration and communications where the mandate allows it. The tenant remains on the existing tenant portal and tenant data model.

## Institution / staff-quarter scenario

An institution can be represented by an owner account and classified as `institution` or `staff_quarters` in the manager client profile. The manager can operate the physical units, occupants, maintenance and providers while the institution retains its selected financial responsibilities.

## Deliberate non-goals

- No second property hierarchy.
- No second tenant database.
- No second billing engine.
- No Agency client table copied into the manager portal.
- No replacement of `property_landlords`.
- No replacement of the existing Landlord portal.
- No automatic assumption that every manager controls owner money.

## Verification status

Static source verification was performed for the changed routes, navigation, new manager components, migration and regression test. The repository environment does not contain `node_modules`, so a full TypeScript/Vitest/build execution could not be honestly certified here. Run `npm ci` followed by the targeted test, typecheck and build locally before pushing.
