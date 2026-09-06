# CALQULUS Portal Navigation & Route Convergence — Phase 4 Audit

## Scope

Phase 4 converges portal navigation definitions and removes repeated route-table definitions without changing authentication, RBAC, business workflows, or portal ownership.

Audited surfaces:

- Manager / Submanager
- Landlord
- Agency
- Tenant
- WebHost / Platform Admin
- Public, auth-only, and fallback route sets

## Changes

### 1. Canonical portal navigation registry

Added `src/shared/navigation/portalNavigation.ts` as the single source for:

- Agency navigation groups
- Landlord navigation groups
- Tenant desktop navigation
- Tenant mobile navigation
- WebHost navigation groups and permission keys
- Agency active-route semantics
- Tenant active-route semantics

The four role-specific portal layouts now consume these shared definitions instead of declaring their own navigation arrays.

### 2. Route-table convergence

`designPreviewPublicRoutes` is now reused by:

- `publicRoutes`
- `authOnlyRoutes`
- `fallbackRoutes`

This removes three repeated seven-route design-preview declarations while retaining the same paths and components.

### 3. Regression hardening

Added `src/test/portalNavigationPhase4.test.ts` covering:

- Canonical navigation target lists
- Duplicate navigation target detection
- Agency special active-route behavior
- Tenant lease alias active-route behavior
- Exact duplicate route detection within each role route table
- Navigation-to-owning-role route coverage
- Canonical design-preview route-set size
- Tenant mobile navigation scope

### 4. Type/import cleanup

`PortalDeskShell.tsx` now explicitly imports `ComponentType` as a React type, matching the existing `PortalDeskNavItem.icon` contract.

The four portal layouts no longer carry redundant icon imports or local navigation declarations.

## Static audit results

| Check | Result |
|---|---|
| Agency local `NAV_GROUPS` removed | PASS |
| Landlord local `NAV_GROUPS` removed | PASS |
| Tenant local desktop/mobile nav removed | PASS |
| WebHost local `NAV_GROUPS` removed | PASS |
| Exact duplicate paths in role tables | PASS — none found |
| Primary nav targets represented by owning role route table | PASS |
| Design-preview route duplication | PASS — centralized |
| Portal-specific active matching preserved | PASS |
| WebHost permission metadata preserved | PASS |
| Manager/Submanager route table changed | NO |

## Runtime verification

The repository currently has no usable installed dependency tree in the verification workspace.

`npm ci --ignore-scripts --offline` was attempted and is blocked because `zod-validation-error@4.0.2` is not available in the local npm cache. Node also reports engine warnings for the installed lockfile requirements (`jsdom@30.0.1`, `undici@8.10.0`) against Node `22.16.0`.

Consequently:

- `npm run lint` — BLOCKED (`eslint` unavailable)
- `npm run typecheck` — BLOCKED by missing project dependencies (`react`, `react-router-dom`, etc.)
- targeted Vitest run — BLOCKED (`vitest` unavailable)
- `npm run build` — BLOCKED (`vite` unavailable)

No runtime/build/test pass is claimed.

## Phase boundary

This phase intentionally does **not**:

- change route guards
- change allowed roles
- change Supabase/RLS behavior
- change payment or billing workflows
- rename public URLs
- remove valid role routes merely because they are not in primary navigation
- merge Manager's operational sidebar into the white-label portal shell

Phase 5 can therefore proceed from a stable navigation architecture with the existing route/security model intact.
