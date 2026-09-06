# CALQULUS Mobile App Experience — 2026-09-06

## Objective
Make every authenticated CALQULUS portal feel like a focused mobile application on phones rather than a desktop website squeezed into a viewport.

## Implemented
- Shared `PortalDeskShell` now switches to an app-style phone shell whenever a portal supplies mobile navigation.
- Desktop `PageHeader` is hidden on phones so the compact sticky app bar becomes the primary page chrome.
- All authenticated portals now have thumb-first bottom navigation: Manager, Agency, Landlord, Tenant and WebHost.
- Bottom navigation exposes four high-value destinations plus a `More` action that opens the complete permission-filtered navigation drawer. No important route is lost on mobile.
- Safe-area bottom spacing is reserved so controls are not hidden by gesture areas/home indicators.
- Phone content uses `100dvh`, tighter mobile padding and a dedicated bottom-nav clearance.
- Touch targets remain at least 44px and tap-highlight/overscroll behavior is controlled for a more native interaction model.
- Mobile form controls use a 16px floor to avoid iOS zoom-on-focus behavior.
- Existing role-specific portal identities, permissions and route guards are reused; this is a presentation/navigation convergence, not a second application.

## Mobile information architecture
- Manager: Home / Properties / Tenants / Money / More
- Agency: Home / Clients / Portfolio / Money / More
- Landlord: Home / Portfolio / Money / Repairs / More
- Tenant: Home / Bills / Fix / Docs / Me
- WebHost: Home / Users / Ops / Money / More

The `More` drawer retains the full role-specific navigation and permission filtering, including WebHost master-control domains.

## App identity
A new CALQULUS app icon source is included at `public/calqulus-app-icon.svg`, with regenerated 512px, 192px and Apple 180px raster assets plus favicon. The icon combines a clean property silhouette with a continuous CALQULUS orbit/C mark and uses the platform navy/blue identity.

## Verification
- Changed TypeScript/TSX files passed static non-empty/syntax-source checks in the package workspace.
- New regression test added: `src/test/mobileAppExperience.test.ts`.
- PWA icon raster dimensions and file formats verified.
- Full Vitest/typecheck/build must still be run from the Windows development workspace because this packaged audit environment does not contain `node_modules`.
- No production database changes are part of this initiative.
