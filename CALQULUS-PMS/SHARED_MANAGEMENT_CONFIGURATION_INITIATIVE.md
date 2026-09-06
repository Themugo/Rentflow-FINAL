# CALQULUS — Shared Management Configuration Initiative

This initiative establishes one configuration hierarchy for Agency-managed landlords, independent property managers, and independent landlords without creating duplicate billing, tenant, amenity, maintenance or financial engines.

## Authority model

- Agency: configures the client/landlord contract and applicable service/payment rules.
- Property Manager: configures rules only within the manager's own mandate and property scope.
- Independent Landlord: has full autonomy over their own property configuration.
- Managed Landlord: sees effective rules but cannot override Agency or Manager-controlled configuration.
- Tenant: receives the effective property/unit behaviour; tenant-facing material changes remain communicated through the existing communication hub.
- Webhost/System Admin: governs the platform, not the commercial rules of an Agency, Manager or Landlord.

## Reuse rule

The Agency operations center remains the reference for the vocabulary of management, financial, payment, billing, amenity, maintenance, vendor, document, communication and security controls. Manager and independent-landlord controls use a shared configuration store and resolver rather than copied engines or separate rule tables for every portal.

## Precedence

For a manager or independent landlord, the effective configuration can be account/property/unit scoped. For a managed landlord, the controlling Agency client contract or Property Manager mandate takes precedence. Historical configuration is never intended to rewrite past financial records.
