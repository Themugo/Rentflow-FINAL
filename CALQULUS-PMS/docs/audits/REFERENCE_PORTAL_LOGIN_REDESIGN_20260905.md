# CALQULUS PMS — Reference Portal Login Redesign

## Scope

Redesigned the four customer-facing authentication entry points to match the supplied four-column reference design as a shared code system:

- Property Manager
- Landlord
- Tenant
- Agency

The redesign is presentation-only around the existing authentication flows. Existing sign-in, role checks, redirects, password recovery, biometric login, manager signup, invitation flows, and Supabase auth remain owned by the existing page components.

## Visual contract

Each portal now uses the same structural composition:

1. Full-height 50/50 desktop split.
2. Left identity panel with a local bundled background image.
3. CALQULUS logo at the upper-left of the identity panel.
4. Portal title + `Portal` hierarchy.
5. Portal-specific accent colour.
6. Circular role icon and concise portal description.
7. Right-side neutral background.
8. Centered rounded white login card.
9. `Welcome Back!` heading and portal-specific subtitle.
10. Icon-led email/password fields.
11. Remember-me + forgot-password row.
12. Portal-coloured Login button.
13. Google sign-in control.
14. `Secure • Encrypted • Protected` reassurance.
15. Compact Privacy / Terms footer.

Mobile collapses to the same hierarchy vertically without changing authentication behaviour.

## Local media

No login background depends on a remote URL. Four distinct local assets are used:

- Manager: `property-residential.webp`
- Landlord: `landlord-living-room.svg`
- Tenant: `tenant-living-room.svg`
- Agency: `property-office.webp`

The two SVG interiors are intentionally bundled assets so the login experience remains deterministic and works without third-party image hosting.

## Architecture

`ReferencePortalLoginShell.tsx` is the single presentation shell. The existing `ManagerPortalChrome`, `LandlordPortalChrome`, `TenantPortalChrome`, and `AgencyPortalChrome` modules remain as compatibility boundaries and delegate their shell rendering to the shared component. Their existing preview exports are retained for non-login consumers/tests.

No second authentication architecture, router, session store, or Supabase client was introduced.

## Behaviour preserved

- Existing email/password sign-in.
- Existing role enforcement and wrong-portal redirects.
- Existing password recovery dialogs.
- Existing manager signup flow.
- Existing tenant invitation paths.
- Existing biometric login where supported.
- New lightweight remember-email behaviour is scoped per portal in local storage.
- Google sign-in is wired through the existing Supabase client and redirects back to the originating portal route.

## Verification status

Static source review was completed after the redesign. Full `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` execution was attempted but could not complete in the isolated build environment because dependencies were not available; `npm install` timed out before a usable toolchain was installed. No test or build pass is claimed from that environment.
