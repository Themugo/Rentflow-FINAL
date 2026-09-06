# WebHost Master Control Room — 2026-09-06

## Objective
Make the WebHost portal the master control room for the CALQULUS platform for every non-tenant user and platform-wide concern. Tenant records remain outside the primary user/operations registry; only the restricted unattached-account exception is exposed.

## Control domains
- **Master control:** dashboard, organizations and the non-tenant user registry.
- **Platform operations:** applications, deployments, runtime operations, properties and system landlords.
- **Commercial control:** subscriptions, tiers, billing rules, negotiated/custom pricing and contracts.
- **Access & public experience:** public site, brand studio, security, audit and issues.
- **Exceptions:** restricted unattached-tenant queue only.
- **Account:** platform administration settings.

## End-to-end access hardening
The WebHost navigation permission union now includes `can_manage_platform_settings`, and permission-bearing navigation targets are aligned with their route guards.

Platform applications, deployments, operations, brand, public site and settings now require `can_manage_platform_settings` in addition to any minimum admin level. The non-tenant Users registry requires `can_manage_managers`. Commercial screens remain protected by `can_manage_billing`; property/landlord controls retain their dedicated permissions; security/audit/issues retain `can_view_activity_logs`.

## Tenant boundary
`AdminUsers` explicitly documents and implements the non-tenant registry contract. The dashboard continues to exclude tenant records from its user and activity slices. Tenant-specific settings remain isolated from the master control navigation.

## UI identity
WebHost retains its teal control-plane identity and the Admin surface retains its indigo identity. Existing local property/office/commercial imagery remains the shell background source; no remote image dependency was introduced.

## Verification
- Changed TS/TSX files passed TypeScript transpilation/syntax diagnostics in the package environment.
- Static navigation/route guard alignment checked.
- Full Vitest/typecheck/build could not be run in the packaged environment because `node_modules` is absent. Final verification must run in the user's Windows workspace before commit/push.
- No production Supabase migration was applied by this initiative.
