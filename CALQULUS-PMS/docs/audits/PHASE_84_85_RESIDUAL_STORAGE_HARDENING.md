# CALQULUS PMS — Phases 84–85 Audit

## Phase 84 — Residual Mutation Convergence
- Added atomic insurance-claim creation.
- Existing insurance-claim lifecycle RPC is now the browser mutation path.
- Tenant water-meter submission notification is server-authorized and atomic.
- Utility-meter active/inactive transitions are RPC-only.
- Profile photo metadata changes use an authenticated RPC.
- Direct authenticated/anonymous DML was removed from the affected mutation surfaces.

## Phase 85 — Storage Path Hardening
- Tenant maintenance uploads now use `maintenance/<auth-user-id>/...` paths.
- Maintenance INSERT policy validates tenant-owned paths and manager/submanager unit scope for inspection/water-meter paths.
- Maintenance UPDATE/DELETE are owner-only.
- Existing private bucket configuration is preserved; no public exposure was introduced.

## Verification limitations
- Static SQL/source verification is performed in the package environment.
- No live Supabase database was available for applying migrations.
- TypeScript/Vitest/build verification depends on project dependencies being installed.
