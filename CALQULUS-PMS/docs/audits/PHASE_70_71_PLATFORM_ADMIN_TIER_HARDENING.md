# Phase 70–71 Platform Administration & Tier Hardening

## Phase 70
Platform-admin provisioning, suspension and removal now converge through SECURITY DEFINER RPCs. Direct authenticated/anonymous writes to `platform_admins`, `admin_permissions`, and `user_roles` are revoked. Server-side rules enforce owner/business authority, immutable owners, suspension reasons, and synchronized admin permission levels.

## Phase 71
Subscription tier pricing/limits and category billing controls now use atomic server-authorized RPCs. Direct authenticated/anonymous writes to `subscription_tiers`, `property_tier_limits`, and `property_categories` are revoked. Tier deletion is disabled in the UI to preserve subscription history; tiers can be deactivated instead.

## Verification
- `npm run audit:prod`: PASS
- Targeted direct-mutation scan: PASS (0 violations in hardened surfaces)
- SQL dollar-quote/function checks: PASS
- `npm test`: blocked because `vitest` is unavailable in the supplied environment
- `npm run typecheck`: blocked by missing project dependencies (React/React Query/router/etc.)
- No live Supabase database was available; migration execution was not claimed.
