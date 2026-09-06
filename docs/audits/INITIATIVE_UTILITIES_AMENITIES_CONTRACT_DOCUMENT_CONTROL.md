# CALQULUS PMS — Utilities, Amenities & Contract Document Control

## Scope
This is a complete repository update built on the supplied CALQULUS PMS main repository snapshot. It does **not** create a patch archive.

### Implemented
- Canonical utility integration registry and external sync ledger.
- Meter/reading provenance fields on the existing `unit_utility_meters` and `water_meter_readings` tables.
- Water reading verification with approve/reject/adjust semantics and a canonical invoice-line payload.
- Chargeable amenity/service catalogue without replacing the existing `unit_amenities` facts model.
- Immutable signed-contract guard.
- Contract document versions with SHA-256 hashes.
- Contract amendment workflow foundation for executed contracts.
- RLS/read boundaries and RPC-only mutation boundaries for new financial/operational records.
- Static regression coverage for duplicate-table prevention and security boundaries.

## Integration rule
Existing application primitives remain the source of truth. No second water-reading table, duplicate amenity fact table, or parallel contract store is introduced.

## Verification
Run from the repository root:

```cmd
npm ci
npm run test -- src/test/utilitiesAmenitiesContractsInitiative.test.ts
npm run typecheck
npm run build
```

Then apply/validate the Supabase migration in the normal project deployment workflow before using the new database capabilities in production.
