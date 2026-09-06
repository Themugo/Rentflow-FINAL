# CALQULUS Phase 3 — Portal Shell & Layout Convergence Audit

## Scope

Converged the authenticated customer/platform portal chrome for Agency, Landlord, Tenant, and WebHost/Admin around a single shared `PortalDeskShell` implementation. The Manager portal remains on the richer canonical `Layout` + `Sidebar` + `Header` composition because it owns global command palette, help, keyboard navigation, context panel, favorites, view-only notices, and manager navigation behavior.

## Consolidation

### New canonical shared shell

- `src/shared/components/layout/PortalDeskShell.tsx`
  - shared desktop sidebar
  - mobile sidebar overlay/open/close behavior
  - brand header
  - grouped navigation
  - active-route state
  - authenticated user footer
  - sign-out control
  - top header and breadcrumb context
  - shared page header
  - skip-link/accessibility target
  - compact footer
  - optional mobile bottom navigation
  - optional header-right content
  - portal-specific sidebar width/content max-width

### Consumers

- `src/features/agency/components/AgencyLayout.tsx`
- `src/features/landlord/components/LandlordLayout.tsx`
- `src/features/tenant-portal/components/TenantLayout.tsx`
- `src/features/webhost/components/WebhostLayout.tsx`

Each consumer retains its own authentication gate, route namespace, portal navigation, and portal-specific logic. WebHost permission filtering and surface accent behavior remain local to WebHost.

## Preserved behavior

- Existing portal authentication redirects remain unchanged.
- Existing `isDevAccessEnabled()` behavior remains unchanged.
- Existing WebHost permission checks remain unchanged.
- Existing Agency `DeskEmbedProvider` remains unchanged.
- Existing Tenant mobile navigation and notification bell remain available.
- Existing Landlord route set remains unchanged.
- Existing route-specific active-state rules remain unchanged where they differed from generic prefix matching.
- Manager `Layout` and its operational global tooling were not flattened into the customer portal shell.

## Redundancy audit

Before convergence, Agency, Landlord, Tenant, and WebHost each contained their own copies of:

- fixed desktop sidebar markup
- mobile menu overlay
- sidebar close control
- brand header
- grouped navigation rendering
- sign-out footer
- sticky top header
- breadcrumb/title context
- page header placement
- main content frame
- footer placement

After convergence, those structural elements exist once in `PortalDeskShell.tsx` and are configured by each portal.

The search for the previous duplicated shell signatures no longer returns those four feature layouts.

## Intentionally retained separate implementations

- `src/shared/components/layout/Layout.tsx` — Manager's richer workspace shell.
- `src/features/auth/components/*PortalChrome.tsx` — public/auth entry experiences, not authenticated desk shells.
- `src/features/tenant-portal/components/MobileBottomNav.tsx` and `MobilePageHeader.tsx` — audited as tenant-specific supporting UI; not blindly deleted because their usage/ownership differs from the authenticated desk shell.

## Verification

### Static checks

- Shared shell exists exactly once.
- Agency/Landlord/Tenant/WebHost layouts import and consume the shared shell.
- Previous duplicated sidebar/header structural signatures are absent from those four layouts.
- Manager's existing global workspace shell remains intact.
- Portal-specific route constants remain referenced by their corresponding layout.
- WebHost permission filtering remains present.

### Runtime checks

`npm ci --ignore-scripts --offline` was attempted but is blocked by the local npm cache: `zod-validation-error@4.0.2` is not cached. The environment also reports Node engine warnings for the repository's current `jsdom` and `undici` versions.

Because dependencies could not be installed, the following project-level gates could not be honestly executed:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

These are **BLOCKED**, not passed.

## Phase 3 result

**Source consolidation: PASS**

**Duplicate shell removal: PASS**

**RBAC/workflow preservation: PASS by static audit**

**Project runtime verification: BLOCKED by dependency cache/environment**
