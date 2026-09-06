# Phases 78–79 — Webhost Administration & Role Boundary Hardening

## Phase 78
- Added transactional webhost/admin permission RPCs for bootstrap, provisioning, permission changes, super-admin transfer and removal.
- Server derives caller authority and prevents self-demotion / duplicate super-admin states.
- Revoked authenticated/anon direct writes to `admin_permissions` and `user_roles`.
- Webhost management UI now uses RPCs for privileged mutations.

## Phase 79
- Added server-authoritative manager-role assignment/removal RPCs.
- Manager role administration now crosses an explicit webhost authorization boundary.
- Existing manager-facing role UI no longer performs direct `user_roles` writes.
- Scoped submanager administration remains the supported manager delegation workflow.

## Verification
- SQL dollar-quote/function structural checks performed.
- Targeted source scan must show no direct INSERT/UPDATE/DELETE on `admin_permissions` or `user_roles` in application UI/hooks.
- No live Supabase database was available; migrations are structurally reviewed only.
- Full TypeScript/test/build verification remains environment-blocked where project dependencies are unavailable.
