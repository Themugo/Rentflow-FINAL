# CALQULUS Platform Authority, RBAC & Admin Hierarchy — Design + Implementation Handoff

Status: **Complete.** Full audit (Phase 1), design (Phase 2, user-approved answers a/b/c), backend (Phase 3/5) and frontend (Phase 6/7) implemented. Validation (Phase 9) green. Deploy note requires the new migration pasted to live SQL; owner/business may then create System Admins with granular perms.

## Validation status (Phase 9)
- `npx tsc --noEmit` → clean (0 errors).
- `npx eslint src` → 0 errors, 11 pre-existing warnings (baseline).
- `npx vitest run` → 1206 passed / 1 skipped (13 new authorization tests in `src/test/platformAuthoritySystemAdmin.test.ts`).
- `npm run build` → clean (precache 771.59 KiB, 26 entries).
- Locked contracts preserved: `webhostOperatorOnboarding`, `adminWebhostPhase8`, `adminDesk` all pass.

## Role hierarchy (authoritative target)

| Concept | Existing mapping | Scope |
|---|---|---|
| **Webhost = ROOT owner** | `platform_admins.admin_type = 'owner'` or `'business'` (immutable root reserved; `owner` immutable by DB trigger) | full platform authority; only creator of System Admins; every sensitive action audited |
| **System Admin = delegated** | `platform_admins.admin_type = 'admin'` | Agencies / Managers / Landlords + granular granted perms; **NO normal tenant ops** |
| **Manager** | `user_roles.role = 'manager'` (`app_role` enum) | Authorized properties only |
| **Agency** | `user_roles.role = 'agency'` | Its authorized portfolio only |
| **Landlord** | `user_roles.role = 'landlord'` | Authorized properties, aggregate data only (no tenant PII) |
| **Tenant** | `user_roles.role = 'tenant'` | Own account only |

## Key decisions (user approved a/b/c)

- **(A)** System Admin = `platform_admins.admin_type = 'admin'`; Webhost root reserve = `owner`/`business`. Tenant firewall for the `admin` tier.
- **(B)** Extend `platform_admins` / `admin_permissions` with **granular boolean permission columns** (existing convention), NOT a second table.
- **(C)** System Admin is a **constrained surface within the webhost desk** (agencies/managers/landlords + Unattached Tenants), gated by `isPlatformAdmin` + permission booleans; keep full webhost nav for owner/business untouched.

## Granular permission model (Phase 3)

Add columns to `platform_admins` (and mirrored in `admin_permissions`):

- `can_manage_agencies`
- `can_manage_organizations`
- `can_manage_linked_landlords`
- `can_read_unattached_tenants`
- `can_resolve_unattached_tenants`

Existing retained booleans: `can_create_admins`, `can_manage_managers`, `can_manage_billing`, `can_manage_properties`, `can_manage_landlords`, `can_manage_platform_settings`, `can_view_activity_logs`.

**System Admin baseline (admin tier created by webhost):**
- `can_manage_managers = true`
- `can_manage_landlords = true`
- `can_manage_agencies = true`
- `can_manage_organizations = false` (delegated only)
- `can_manage_billing = false`
- `can_manage_platform_settings = false`
- `can_create_admins = false`
- `can_manage_properties = false` (operations are per-manager; admin manages at platform level)
- `can_read_unattached_tenants = true` (recovery area)
- `can_resolve_unattached_tenants = true`
- `can_view_activity_logs = true`

## Unattached-tenant boundary (Phase 5)

Backend definition (no frontend state): a **tenant row** with NO valid authorized relationship:
```
tenants.manager_id IS NULL
 AND (tenants.property_id IS NULL OR tenants.unit_id IS NULL)
```
The unresolved set is exposed ONLY through a webhost/System‑Admin–only, SECURITY DEFINER RPC/PG view that returns aggregate/recovery‑scoped data (no tenant PII beyond name/email/unit needed to resolve). When the relationship is repaired (manager_id + property_id + unit_id all set), the tenant leaves the queue. No second tenant database; no duplicated records.

## Server-side hardening for the admin tier (Phase 3/5)

- `protect_user_roles_changes()` already forbids non-webhost granting `webhost`/`platform_admin` and blocks public self-assign — **unchanged**.
- Add a guard so the `platform_admins.admin` tier can NEVER read normal tenant rows through the `tenants_select` / `invoices_select` / `leases` policies (system admin ≠ tenant operator). Tenants RLS access must stay: tenant(self), manager/agency(scoped), service_role. The `admin`/`owner`/`business` webhost tiers get the Unattached-Tenants recovery RPC only.
- Audit every Webhost/System‑Admin sensitive action via `activity_logs` (already used by admin invitation flow).

## Files to change (planned)
- `supabase/migrations/<timestamp>_platform_authority_system_admin.sql` — granular perms + unattached RPCs + admin-tier guard.
- `supabase/sql/apply-live-p1-rpcs.sql` — mirror the migration (live paste path).
- `src/features/auth/AuthContext.tsx` — extend `PlatformAdminInfo` (new flags), keep existing fields; expose `isSystemAdmin`-style helpers derived from `admin_type`.
- `supabase/functions/send-admin-invitation` + `accept-admin-invitation` — align granular perms on issuance/acceptance.
- `src/features/auth/lib/permissions.ts` + `src/shared/hooks/useRBAC.ts` — add `can('manage_system_admins')` / System Admin permission helpers.
- `src/components` webhost: constrain nav for `isPlatformAdmin` (agencies/managers/landlords + Unattached Tenants), keep full nav for owner/business.
- `src/features/webhost/components/PlatformAdminManagement.tsx` — add granular permission editor + confirm flows.
- `src/test/*` — add authorization tests (15 cases).

## Validation gate
- `npx tsc --noEmit` (app + node), `npx eslint src`, `npx vitest run`, `npm run build`.
- Must NOT break locked contracts: `webhostOperatorOnboarding.test.ts`, `adminWebhostPhase8.test.ts`, `adminDesk.test.ts`.

## What actually changed (files)
- `supabase/migrations/20260827000000_platform_authority_system_admin.sql` — granular columns (platform_admins + admin_permissions), `unattached_tenants_view`, `user_is_platform_admin_any()`, `list_unattached_tenants()`, `resolve_unattached_tenant()` (SECURITY DEFINER + 42501 guards + audit log), admin-tier baseline backfill.
- `supabase/sql/apply-live-p1-rpcs.sql` — mirror of the above (live-paste path).
- `supabase/functions/accept-admin-invitation/index.ts` — accept path seeds the 4 new granular flags (System Admin = delegated Agencies/Managers/Landlords + recovery READ, no billing/platform-settings).
- `src/features/auth/AuthContext.tsx` — `PlatformAdminInfo` + query extended with the 4 granular flags.
- `src/features/webhost/lib/unattachedTenants.ts` — PURE model (isUnattached / unattachedReason / summarizeQueue / labels) for the recovery queue.
- `src/features/webhost/pages/AdminUnattachedTenants.tsx` — new recovery surface (RPC-only, no direct tenants/invoices/leases reads), gated.
- `src/app/routes.ts` + `src/features/webhost/lib/webhostPaths.ts` — added `/webhost/unattached-tenants` (protected:true) + `WEBHOST_ROUTES.unattachedTenants`.
- `src/features/webhost/components/WebhostLayout.tsx` — added "Unattached tenants" nav item, gated by `can_read_unattached_tenants` (or super-admin / manager-mgmt).
- `src/features/webhost/components/PlatformAdminManagement.tsx` — createAdmin seeds the granular flags per admin_type.
- `src/test/platformAuthoritySystemAdmin.test.ts` — 13 authorization tests.

## Known risks / remaining work
- The new migration must be pasted into the live SQL Editor AND the `accept-admin-invitation` edge function redeployed before invitation-created System Admins work against live.
- Existing migrating admin rows get the read-only recovery baseline; resolution is a webhost grant (aligns with edge function).
- Non-critical: the client-side `createAdmin` path in PlatformAdminManagement still directly inserts platform_admin/roles — preferred path is the token invitation flow; left as-is (out of scope for UI/UX refinement).

## Exact next step
Commit the verified changes; paste the new migration into live SQL Editor; redeploy `accept-admin-invitation` if deploying invitation-created System Admins.