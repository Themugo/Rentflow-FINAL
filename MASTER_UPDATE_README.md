# CALQULUS PMS — Agency Landlord-First Operations Centre

## Foundation

Built from the committed CALQULUS `main` foundation:

`f2da729454017e3c6f95615ca3e6585c19c70ba0`

This is a full repository snapshot with the Agency landlord-first operations update layered into the existing architecture. It is **not a patch package**.

## Added in this update

- Agency-created landlord accounts for landlords who should not have to self-invite.
- One landlord identity can be attached to multiple properties.
- Property selection supports different locations/towns while retaining property-level rules.
- Dynamic Agency sidebar landlord book.
- Landlord workspace hierarchy: landlord → property → occupants/operations.
- Property cards expose location, units, tenants and occupancy.
- Agency dashboard command tabs and color-coded operational pulse cards.
- Existing live Agency portfolio, billing, maintenance and service-model systems remain the source of truth.
- Secure activation links are generated without exposing temporary passwords.
- Server-side authorization revalidates agency/property relationships before account linkage.

## Validation

Static repository checks were run. Full npm test/typecheck/build was not run in this packaged environment because dependencies are not installed in the snapshot.

After extraction into the local repository, run:

```cmd
npm ci
npm run test -- src/test/agencyLandlordAccountWorkspace.test.ts
npm run typecheck
npm run build
```

Then commit/push the resulting repository state to `main` so this becomes the next canonical foundation.
