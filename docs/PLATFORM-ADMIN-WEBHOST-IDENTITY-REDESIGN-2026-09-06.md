# Platform Admin + WebHost Identity Redesign — 2026-09-06

## Scope
Complete the final platform-control desk pass: the WebHost/control-plane and Platform Admin surfaces now share the same CALQULUS desk architecture as Manager, Landlord, Agency and Tenant while retaining their own operational identity.

## Design contract
- Same `PortalDeskShell`, accessibility model, responsive navigation and light-desk foundation as the other portals.
- **WebHost control plane:** deep teal `#2C9183`, Nairobi office photography, infrastructure/application/deployment emphasis.
- **Platform Admin:** indigo `#4658C9`, Nairobi commercial-property photography, organization/user/billing/audit/security emphasis.
- The identity is surface-specific without creating a second design system. Status colours remain semantic.
- Background imagery is bundled locally through the existing `PROPERTY_IMAGES` asset registry; no remote image dependency is introduced.

## Admin authority dashboard
The dashboard now shows factual administrator context from existing auth state: platform admin type, access tier, super-admin status, suspension state and permission-led posture. It does not fabricate privileges or query new identity data.

## Security / backend posture
No direct data mutations were introduced. Existing WebHost mutation workflows continue to use atomic RPCs. Existing tenant firewall behavior remains intact.

## Files
- `src/features/webhost/components/WebhostLayout.tsx`
- `src/features/webhost/lib/webhostPaths.ts`
- `src/features/webhost/pages/AdminDashboard.tsx`
- `src/test/adminDesk.test.ts`

## Verification
Static source checks must confirm both surface identities, local image slots, dashboard authority rendering and existing WebHost route/nav contracts. Full Vitest/typecheck/build should be run from the Windows development workspace before commit.
