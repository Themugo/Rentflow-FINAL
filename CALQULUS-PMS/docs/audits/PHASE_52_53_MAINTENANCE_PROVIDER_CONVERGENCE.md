# CALQULUS PMS — Phase 52–53 Hardening Audit

## Scope
- Phase 52: maintenance financial fields, property-scoped expenditure writes, maintenance expenditure recording.
- Phase 53: provider review integrity and rating provenance.

## Changes
- Added `save_property_expenditure_atomic` for property-scoped expenditure upsert.
- Added `save_maintenance_financials_atomic` for quote/agreed amount/provider notes.
- Added `record_maintenance_expenditure_atomic` with completion gating and one-time recording per maintenance request.
- Added provider/reviewer uniqueness and `create_provider_review_atomic`.
- Authenticated direct INSERT/UPDATE/DELETE revoked on `expenditures`, `maintenance_requests`, and `provider_reviews`.
- Existing lifecycle RPCs were reused rather than duplicated.

## Verification
- `npm run audit:prod` should be run from a fully installed project environment.
- Static checks performed by the phase packaging workflow include RPC/grant presence, protected direct-mutation scans, SQL delimiter balance and ZIP integrity.
- `npm test`, `npm run typecheck`, and `npm run build` remain environment-dependent when dependencies are absent from the supplied source package.
- Supabase migrations are structurally reviewed but not claimed as live-applied without a connected database.
