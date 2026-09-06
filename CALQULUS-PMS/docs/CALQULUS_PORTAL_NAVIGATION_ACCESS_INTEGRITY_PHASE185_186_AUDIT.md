# CALQULUS PMS — Portal Navigation & Access Integrity — Phases 185–186

**Date:** 2026-09-04  
**Initiative:** Portal Navigation & Access Integrity

## Objective

Make Manager, Landlord, Agency, Tenant and Platform Admin navigation reflect the routes and permissions that actually govern each portal, while preserving one shared design-system shell.

## Implemented

### Phase 185 — Canonical portal navigation
- Added `MANAGER_NAV_GROUPS` to the existing canonical `src/shared/navigation/portalNavigation.ts`.
- Removed the duplicated role navigation definitions from `src/shared/components/layout/Sidebar.tsx`.
- The legacy sidebar now adapts the same canonical navigation definitions already used by the portal desk shells.
- Preserved the existing permission metadata so Manager/Submanager navigation remains permission-aware.
- Centralized permission filtering in `PortalDeskShell`, including mobile navigation.
- Added landlord property-detail active-state handling so Portfolio remains selected on `/landlord/properties/:id`.

### Phase 186 — Access and route integrity
- Added explicit cross-portal redirects for authenticated roles instead of allowing another portal's URLs to fall through to a generic 404.
- Added `RouteDef.requirePermission` for WebHost routes.
- Bound permission-bearing WebHost navigation items to the same route-level permission guard.
- Preserved super-admin bypass behavior through `ProtectedRoute`.
- Added regression coverage for canonical navigation, route ownership, permission-to-route binding, duplicate navigation targets, and wrong-portal boundaries.

## Portal boundaries

| Role | Canonical home | Foreign portal URLs redirect to home |
|---|---|---|
| Manager | `/` | Agency, Landlord, WebHost |
| Submanager | `/` | Agency, Landlord, Tenant, WebHost |
| Agency | `/agency` | Manager, Landlord, Tenant, WebHost |
| Landlord | `/landlord/dashboard` | Manager, Agency, Tenant, WebHost |
| Tenant | `/portal` | Manager, Agency, Landlord, WebHost |
| Platform Admin | `/webhost` | Manager, Agency, Landlord, Tenant |

## Verification

Static structural verification completed against the packaged source:
- Role route tables contain no exact duplicate paths.
- Every primary navigation target is represented by its owning role route table.
- Permission-bearing WebHost nav items have matching route-level `requirePermission` metadata.
- Canonical navigation targets are unique within each portal.
- Legacy Sidebar no longer contains independent Manager/Agency navigation arrays.

### Automated test limitation

The source package contains the project's Vitest/TypeScript configuration, but the working environment did not have `vitest`, `tsc`, or `eslint` binaries available. An `npm ci --ignore-scripts` attempt timed out before dependencies became usable. Therefore automated Vitest/typecheck/lint execution is **not claimed as passed** in this package.

The relevant test command to run in a fully provisioned checkout is:

```cmd
npm test -- --run src/test/portalNavigationAccessIntegrity.test.ts src/test/portalNavigationPhase4.test.ts src/test/navigationRoleIaPhase7.test.ts
```

For the full project gate:

```cmd
npm run verify
```

## Changed files

- `src/shared/navigation/portalNavigation.ts`
- `src/shared/components/layout/Sidebar.tsx`
- `src/shared/components/layout/PortalDeskShell.tsx`
- `src/features/landlord/components/LandlordLayout.tsx`
- `src/app/routes.ts`
- `src/App.tsx`
- `src/test/portalNavigationAccessIntegrity.test.ts`
- `docs/CALQULUS_PORTAL_NAVIGATION_ACCESS_INTEGRITY_PHASE185_186_AUDIT.md`

## Release posture

This initiative changes navigation composition and route enforcement only. Existing page components, data fetching, mutations and backend contracts were preserved.
