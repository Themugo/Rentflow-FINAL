# CALQULUS PMS — Landlord Operating Model Initiative

## Scope
Complete the landlord-facing operating model by reusing the existing property, landlord, manager mandate, agency service, tenant, billing and settlement architecture.

## Applied principles
- Landlord is the asset owner and owner-side decision maker.
- Agency remains an agency operating model; manager remains a property operator; landlord is not converted into either.
- Financial authority is explicit and relationship-scoped.
- Tenant operational data remains behind the existing tenant/manager security boundaries.
- Owner control changes are requests when they would alter an active management relationship; they are not silent client-side mutations.
- No second property, tenant, invoice, payment or reporting engine is introduced.

## Landlord workspace
- Dashboard: portfolio health and financial overview.
- Portfolio: property/unit performance.
- Financials: privacy-safe financial performance.
- Statements: owner statements and settlement transparency.
- Maintenance: property operations without tenant PII.
- Documents: owner-visible documents with signed URLs.
- Management: operator, money authority, owner portal visibility and reporting configuration.
- Settings: bank details, notifications, team and owner-manager messaging.

## Agency rules reused where applicable
- Atomic lifecycle operations.
- Explicit operating/payment destination.
- Financial evidence and settlement transparency.
- Owner-visible reporting controls.
- Role-scoped RLS and RPC-only sensitive mutations.

Agency-only service mandates, agency contracts and agency-specific collection policy remain agency-owned and are not copied into the landlord portal.

## Deliberate non-overlap
- Agency client/service contracts stay in `agency_*` structures.
- Manager mandates stay in `manager_management_mandates` and control delegated operator authority.
- Landlord management requests are owner-originated workflow records only; they do not duplicate or mutate manager mandates from the client.
- Tenant portal remains tenant-scoped; landlord views are privacy-safe aggregates/documents already exposed by the landlord security layer.
