# Phase 51 — Service Provider Mutation Hardening

## Scope

Converge provider-owned profile and rate-card mutations onto SECURITY DEFINER RPC boundaries.

## Changes

- Added `save_service_provider_profile_atomic(jsonb)` for provider self-profile create/update and availability changes.
- Added `save_provider_service_atomic(uuid,jsonb)` for provider rate-card create/update/upsert.
- Added `delete_provider_service_atomic(uuid)` for provider-owned service removal.
- Enforced `auth.uid()` ownership inside every provider mutation RPC.
- Added validation for business name, service radius, response window, category, rate type and non-negative/range-consistent rates.
- Revoked authenticated direct `INSERT/UPDATE/DELETE` on `service_providers` and `provider_services`.
- Refactored `ServiceProviderProfile.tsx` to use only the RPC mutation boundary.

## Verification

- `npm run audit:prod`: PASS.
- Phase 51 structural RPC/direct-mutation scan: PASS.
- TypeScript: BLOCKED by the existing workspace dependency gap (`react`, React Query, router, Capacitor and related type packages are unavailable).
- Vitest: BLOCKED because `vitest` is unavailable in the workspace.
- Live Supabase execution: NOT RUN; no connected database was available.

## Security note

The existing public SELECT policies remain unchanged; this phase only converges authenticated provider-owned mutations. Provider identity and authorization are derived from the authenticated session inside the RPC rather than trusted client-supplied `user_id`/`added_by` fields.
