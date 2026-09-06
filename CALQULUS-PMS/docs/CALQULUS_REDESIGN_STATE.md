# CALQULUS Redesign ŌĆö Persistent State

## CURRENT PHASE

Manager Portal Entry ŌĆö Premium Final Refinement (2026-08-26) - /auth refined per the master prompt: shared portal chrome extracted, two-line headline, light-blue portal badge, widened 55/45 composition at max-w-1140, blurred architectural background, current-portal marking in the switcher, axe contrast fix in the preview. Status: completed. Auth logic, routes, validation, error handling, loading states, biometric, registration approval wording and invitation link all preserved verbatim; no backend change.

## MANAGER PORTAL ENTRY REFINEMENT (2026-08-26)

Scope: /auth only (manager sign-in + create-account). Frontend design refinement per master prompt; no new features, no route/auth/backend changes.

Files: NEW `src/features/auth/components/PortalChrome.tsx` (shared portal shell parts: PortalHeader, PortalBadge, PortalSwitcher with aria-current marking, PortalFooter) + NEW `src/features/auth/lib/portals.ts` (PORTALS registry: manager/landlord/agency/tenant with href + accent dot - moved out of the component file to satisfy react-refresh lint). Reworked `ManagerPortalChrome.tsx` on the shared parts. `managerAuthShell.test.tsx` updated (two-line headline contract + current-portal switcher test; 6 tests). Auth.tsx presentation untouched.

Refinements vs previous chrome: background photo now readable-but-quiet (opacity 30%, 3px blur, scale-105, navy veil 90/80/92); header tightened to py-4; MANAGER PORTAL badge moved to light-blue surface (bg-primary/12, border-primary/25); headline split into a deliberate two-line composition ("Run your properties" / "from one desk.") at 2rem/2.4rem leading 1.12; capability strip tightened (gap-x-5, same five small-icon labels); container widened max-w-5xl -> max-w-[1140px] with lg columns 1.2fr/1fr (~55/45) so the auth card visually dominates; preview card rounded-2xl with medium elevation (stats row 48 Units / 92% Occupied / KES 1.24M Collected / 4 Overdue, 7-period collection trend, exactly two lower panels - Maintenance activity + Property with the Kilimani Court photo raised to h-16); other-portals switcher now lists all four portals with the current one (Manager) marked via a filled chip + aria-current instead of a link; footer tightened.

Accessibility fix: preview "Open" maintenance chips used text-warning-foreground (white) on bg-warning/15 - axe serious contrast failure. Now bg-warning/15 text-warning per repo convention (0 axe violations, wcag2a/aa).

Responsive work: 0px horizontal overflow at 1440/1280/1024/768/430/414/390/375 (playwright-core + system chromium); mobile DOM order unchanged (identity -> auth card -> preview -> switcher -> legal), sign-in card precedes the preview. Sign-in tab, Create account tab (approval wording preserved), Forgot password dialog and Landlord switcher navigation all exercised manually in browser.

Gates: lint 0 errors (11 pre-existing warnings); tsc clean; unit 1172 passed / 1 skipped; build clean (precache 765.65 KiB); axe 0 violations. Console shows only the observability logger's INFO "Application initialized" line (emitted via console.error in preview mode - pre-existing, unrelated).

Known issues: none new. The observability INFO-via-console.error noise is pre-existing; ENTERPRISE_DESIGN_SYSTEM.md palette section remains stale (documented in earlier phase).

Next recommended step: adopt the shared PortalChrome parts in the Landlord/Agency/Tenant entry chromes so all four portals share one shell (each currently ships its own internal switcher/footer copies), then repeat this refinement pass per portal.

## TENANT PORTAL ENTRY REDESIGN (Phase 4: Tenant, 2026-08-26)

Scope: /tenant/login only. Sign-in handlers, biometric login, ensureSignedInRole redirect, Forgot-password dialog, and both invitation paths (/tenant/invitation accept + /tenant/signup invite code) preserved verbatim. No backend change. TenantAuth.tsx (invitation acceptance) and TenantSelfRegister.tsx untouched.

Files: NEW `src/features/auth/components/TenantPortalChrome.tsx` (TenantPortalShell + TenantHomePreview + internal PortalSwitcher/CompactPortalFooter); `TenantLogin.tsx` now renders TenantPortalShell (only presentation changed - all logic, toasts, validation identical; "Open invitation" relabelled "Accept invitation", same route); `TenantDeskPreview.tsx` deleted (replaced); dead generic `PortalAuthShell`/`OtherPortalsGrid`/`AuthLegalFooterLinks` removed from `AuthHeroChrome.tsx` (kept `AuthLoadingScreen` + `PortalAuthFeature`/`PortalSwitchLink` types used by RegisterExperience); `agencyTenantAuthShell.test.tsx` removed; NEW `tenantAuthShell.test.tsx` (7 tests). `index.css` gained `btn-tenant` utility (#0284C7, hover #0369A1) beside btn-brand. Stale e2e assertions updated: `app.spec.ts` hero heading now /your home, connected/i, `a11y.spec.ts` tenant heading now /welcome home/i (manager/landlord/agency e2e heading checks still reference pre-redesign copy - separate phases' debt, not in scope).

Layout: navy-deep base + residential property photo (The Alma, Nairobi - same asset as manager entry) at 20% opacity under 85-92% navy veil; header (BrandMark inverse + TENANT + Back to CALQULUS); left identity (TENANT PORTAL eyebrow with home icon + "Your home, connected." + "Rent, payments, maintenance and lease information - all in one secure place." + 5-item capability strip: Rent / Payments / Maintenance / Lease / Property services with small cyan icons, no icon blocks); right white auth card (TENANT chip + "Welcome home." + "Sign in to manage your home and property services." + form + invitation paths + "Both paths need a manager invitation" note). TenantHomePreview labelled ILLUSTRATIVE TENANT VIEW, hierarchy home -> rent -> maintenance -> lease: Kilimani Court photo identity row (Apartment 3B, Tenant since 2025, Lease active chip), cyan-tinted NEXT RENT row (KES 35,000, Due 01 Sep, UPCOMING chip), Maintenance/Lease pair (1 open request - Leaking tap in progress with amber dot; Active - Expires 31 Dec 2026), "Need something fixed?" service line, "Secure tenant access - your account only shows information associated with your tenancy" reassurance. Portal switcher shows all four identities (Manager #2F6FED, Landlord #0F8A6A, Agency #0F766E dots) with Tenant visibly selected (cyan-tinted chip, aria-current="page", not a link). Compact footer (Privacy/Terms + copyright). Mobile DOM order: identity -> auth card -> preview -> switcher -> legal. Card budget kept: 1 auth card + 1 preview card.

Accent: cyan #0284C7 for tenant identity (eyebrow icon, capability icons, badge/chip borders+tints, switcher selection, submit button, input focus rings, biometric tint). Secondary cyan #0369A1 for small text on light surfaces (TENANT chip label, badge, UPCOMING chip, Forgot password link) after axe flagged #0284C7 at 4.09:1 (<4.5) - #0369A1 reaches ~5.9:1. No purple, no orange, no gradients; navy + white dominant; money stays navy (never green); status colour is chip-size only (emerald lease chip, amber maintenance dot, cyan upcoming chip).

QA note: sandbox dev server must run with VITE_ENABLE_DEV_ACCESS=false or /tenant/login renders the manager dashboard; with DISABLE_HMR=true the vite file watcher is off and transforms go stale - restart the server after edits (that combination caused the only QA confusion this phase).

Gates: lint 0 errors (11 pre-existing warnings); tsc clean; unit 1171 passed / 1 skipped (tenantAuthShell: 7 new, agencyTenantAuthShell removed); build clean (precache 764.53 KiB; TenantLogin chunk 4.57 KB gz). audit:prod only fails the pre-existing adminDesk.test.ts hardcoded-URL check documented on clean main. axe (wcag2a/aa): 0 violations. Responsive QA: 0px horizontal overflow at 1440/1280/1024/768/430/390/375; zero page errors or failed requests; keyboard path email -> forgot -> password -> toggle -> Sign in verified; all links route correctly (Accept invitation, Enter invite code, Manager/Landlord/Agency portals, Back to CALQULUS, Privacy/Terms); password visibility toggle verified. Desktop 1440px + mobile 390px + tablet 768px screenshots verified.

Remaining visual issues: none known.

## AGENCY PORTAL ENTRY REDESIGN (Phase 4, 2026-08-26)

Scope: /agency/login only. Sign-in handlers, role redirect, Forgot dialog, provisioning-only rule preserved verbatim. No backend change.

Files: NEW `src/features/auth/components/AgencyPortalChrome.tsx` (AgencyPortalShell + AgencyPortfolioPreview + internal PortalSwitcher/CompactPortalFooter); `AgencyAuth.tsx` now renders AgencyPortalShell with compact provisioning line inside the card; `AgencyDeskPreview.tsx` deleted (replaced). `agencyTenantAuthShell.test.tsx` trimmed to tenant-only; new `agencyAuthShell.test.tsx` (6 tests). Generic `PortalAuthShell` kept for tenant.

Layout: navy base + office property photo at 20% opacity under 85-92% navy veil; header (BrandMark inverse + AGENCY + Back to CALQULUS); left identity (AGENCY PORTAL eyebrow + "Run your client portfolio with control." + 2-line description + 4-item capability line: Client properties / Landlords / Collections / Revenue share, each with teal icons); right white auth card (AGENCY chip + Welcome back + "Sign in to manage your client portfolio." + form + compact provisioning line). AgencyPortfolioPreview labeled ILLUSTRATIVE AGENCY VIEW: teal "Collected KES 2.1M" hero row on top, 4-stat row (Collected 2.1M / Your split 8% / Properties 6 / Landlords 4), 7-period collection trend (final bar teal, others navy-mid/25), client portfolio rows (Kilimani Court "Managed for 2 landlords" photo, Westlands House and Parklands Plaza "Managed for 1 landlord" icons). Portal switcher + compact footer below. Mobile DOM order: identity -> auth card -> preview -> switcher -> legal.

Accent: teal #0F766E for agency chip, capability icons, collected figure, final trend bar, AGENCY VIEW badge; navy/white stay dominant. Other portals switcher uses manager blue / landlord emerald / tenant cyan dots.

QA clarification: first responsive sweep rendered the agency dashboard because VITE_ENABLE_DEV_ACCESS defaulted to true in dev; re-ran with VITE_ENABLE_DEV_ACCESS=false to inspect the actual login page.

Gates: lint 0 errors (11 pre-existing warnings); tsc clean; unit 1165 passed / 1 skipped (agencyAuthShell: 6 new, agencyTenantAuthShell: 1 remaining); build clean (precache 763.34 KiB). Responsive QA: 0px horizontal overflow at 1440/1280/1024/768/430/390/375; zero page errors or failed requests.

Remaining visual issues: none known.

## LANDLORD PORTAL ENTRY REDESIGN (Phase 3, 2026-08-26)

Scope: /landlord/login only. Sign-in handlers, role redirect, Forgot dialog, invitation-only rule preserved verbatim. No backend change.

Files: NEW `src/features/auth/components/LandlordPortalChrome.tsx` (LandlordPortalShell + LandlordPerformancePreview + internal PortalSwitcher/CompactPortalFooter); `LandlordPortalAuth.tsx` now renders LandlordPortalShell with compact invitation line inside the card; `LandlordDeskPreview.tsx` deleted (replaced); `landlordAuthShell.test.tsx` rewritten (6 tests). Generic `PortalAuthShell` kept for agency/tenant.

Layout: navy base + commercial property photo at 20% opacity under 85-92% navy veil; header (BrandMark inverse + LANDLORD + Back to CALQULUS); left identity (LANDLORD PORTAL eyebrow + "See how your properties are performing." + 2-line description + 5-item capability line: Properties / Occupancy / Your share / Statements / Privacy protected, each with emerald icons); right white auth card (LANDLORD chip + Welcome back + "Sign in to view your property performance." + form + compact invitation line). LandlordPerformancePreview labeled ILLUSTRATIVE LANDLORD VIEW: emerald "Net to you KES 784K" hero row on top, 4-stat row (Collected 980K / Occupancy 84% / Properties 2 / Net 784K), 6-month net-vs-collected trend (navy vs emerald bars), property rows (Kilimani Court 92%/80% with photo thumb, Westlands House 75%/80% with building icon), compact privacy line with shield. Portal switcher + compact footer below. Mobile DOM order: identity -> auth card -> preview -> switcher -> legal.

Accent: emerald #0F8A6A for landlord chip, capability icons, net figure, net trend bars, ILLUSTRATIVE LANDLORD VIEW badge; navy/white stay dominant. Other portals switcher uses manager blue / agency teal / tenant cyan dots (no orange, no purple).

Gates: lint 0 errors (11 pre-existing warnings); tsc clean; unit 1160 passed / 1 skipped (landlordAuthShell: 6 new); build clean (precache 763.34 KiB). Responsive QA: 0px horizontal overflow at 1440/1280/1024/768/430/390/375; zero page errors or failed requests.

Remaining visual issues: none known.

## MANAGER PORTAL ENTRY REDESIGN (Phase 2, 2026-08-26)

Scope: manager /auth page only. Auth/proxy logic untouched (handlers, biometric, validation, role-gate, toasts, tabs, forgot-password, invited-tenant link preserved verbatim).

Files: NEW `src/features/auth/components/ManagerPortalChrome.tsx` (ManagerPortalShell + ManagerOperationalPreview + internal PortalSwitcher/CompactPortalFooter); `Auth.tsx` now renders ManagerPortalShell with formTitle = Welcome back / Create your manager account; `ManagerDeskPreview.tsx` deleted (replaced); `managerAuthShell.test.tsx` rewritten to lock the new chrome (5 tests). Old generic `PortalAuthShell` in AuthHeroChrome preserved for landlord/agency/tenant portals.

Layout: navy-deep base + residential property photo at 22% opacity under an 85-92% navy veil; header (BrandMark inverse + MANAGER subtitle + Back to CALQULUS); left column eyebrow MANAGER PORTAL + headline "Run your properties from one desk." + 2-line description + inline capability line (Properties/Tenants/Billing/Payments/Maintenance, small icons); right column white auth card (MANAGER chip + formTitle + children); preview card labeled ILLUSTRATIVE DATA with 4 stats (48 Units, 92% Occupied, KES 1.24M Collected, 4 Overdue), 7-week collection trend (last bar solid primary, 93% pill), 3-row maintenance activity with Open/Done pills, and Kilimani Court property summary with photo thumb + 92% pill; OTHER CALQULUS PORTALS switcher (landlord #0F8A6A, agency #0F766E, tenant #0284C7 dots); compact footer (Privacy/Terms + copyright). Mobile DOM order: identity -> auth card -> preview -> switcher -> legal.

Background asset: PROPERTY_IMAGES.residential (960x640, ~64 KB WebP, locally bundled); preview thumb: PROPERTY_THUMBS.residential (480x320, 23 KB, eager-safe).

Gates: lint 0 errors (11 pre-existing warnings); tsc clean (app+node); unit 1155 passed / 1 skipped; build clean (precache 763.34 KiB). Responsive QA: 0px horizontal overflow at 1440/1280/1024/768/430/390/375; zero page errors or failed requests; signup tab renders "Create your manager account".

Remaining visual issues: none known. Navy token (#254B73 computed, the system "navy-deep") retained for design-bible consistency with the certified homepage/footer - the spec hex #081A2E treated as the family reference, tokens kept.

## HOMEPAGE REDESIGN STATE
Visual polish pass (2026-08-26, enhanced per master prompt) - audit confirmed structure; no sections added/removed, no features/messaging added. CompactCta inner padding tightened (py-10/12 -> py-8/9); everything else re-verified as compliant (header, hero, chips, roles, lifecycle, trust, footer). Navy share measured at ~20%; accent colours stay chip-size. 57 inline SVG icons - all single-stroke lucide (one family), none beside prose sentences. FUTURE IDEA (not implemented): swapping property-commercial.webp into the hero Property-summary thumb would only be a crop change - skipped per "use imagery selectively". Responsive: zero horizontal overflow at 1440/834/390; mobile menu opens; mobile stack matches spec. Links: 0 broken links; mobile menu works; zero page errors in Playwright (one app info log only). Gate re-run: lint 0 errors (11 pre-existing warnings), typecheck clean, 1151 passed / 1 skipped, build clean (precache 760.46 KiB).

Completed: compact executive landing page with 8 bands (hero > capability strip > property types > role strip > lifecycle > trust > final CTA > footer).

Components created: none - reused the existing marketing set.
Components reused: ExecutiveHero, PlatformOverview, PropertyTypeSlider, PortalExperiences, OperationalWorkflow, TrustSection, CompactCta, PublicHeader, PublicFooter, PublicShell.
Components removed: none; PropertyTypeSlider no longer uses slider buttons/scroll (static 3-panel grid).
Structural changes: hero padding reduced; section vertical padding flattened (py-12/16 -> py-8/10 across sections); capability strip converted from 2x4 cards to a wrapped chip row; property types became 3 equal static panels with small icons; role copy shortened to one line each; lifecycle supporting copy shortened.
Copy changes: One platform. Every property.; Built for the way property is managed.; All under control. (lifecycle heading); Ready to run your portfolio with more control? + Get started/Sign in final CTA (spec re-approved the two-button CTA).
Responsive status: zero horizontal overflow at 1440/834/390; mobile stacks headline > copy > CTA > preview > capabilities > types > roles > workflow > CTA.
Remaining issues: none in scope; 11 pre-existing eslint warnings untouched; e2e full suite environmentally blocked in sandbox.

Verification: lint 0 errors, typecheck clean, 1151 passed / 1 skipped, build clean (precache 760.46 KiB).

Onboarding Findings Remediation (phase 13, 2026-08-24) — all four Phase 11–12 findings fixed; no auth logic/routes/schema changed. U1: new ResendVerificationButton (supabase.auth.resend, 60s cooldown, enumeration-safe copy) mounted in manager/agency/landlord verification steps. U2: new useOnboardingDraft hook (sessionStorage, per-user keys, cleared on submit) wired into manager (org name, team email), agency (agency name, client name, team email), landlord (profile name). U3: all raw error.message toasts replaced with errorToast across 9 onboarding mutations + AdminInviteAccept + ActivateAccount + TenantAuth signup fallback (sanitizeAuthError). F4: dead LandlordAuth.tsx deleted; scripts/audit-production.mjs repointed to LandlordPortalAuth (role-redirect guard check). Verification green: tsc 0, eslint 0 (1 pre-existing warning), 1072 tests passed/1 skipped (+9 new), build OK. audit:prod failure on adminDesk.test.ts hardcoded Supabase URL is pre-existing on clean main. Full detail in docs/CALQULUS_ONBOARDING_AUDIT.md Phase 13.

## HISTORY
Final Product Experience Review (phase 12, 2026-08-24) — review only, no auth logic/routes/schema modified. First-time-customer review of the entire journey from the CALQULUS homepage across Manager, Landlord, Agency, Tenant, plus Admin and WebHost invitation flows. Homepage routes every role to the correct labelled portal (no homepage dead ends). Evaluated 9 dimensions: Clarity/Trust/Speed/Security/Visual quality/Mobile UX/Accessibility/Error recovery/Commercial readiness — all Strong except Accessibility and Error recovery (Good, with the U3 raw-error caveat). Answered the 12 questions: a non-technical property manager CAN complete onboarding unaided; a landlord CAN understand what is needed (invite-only stated up front, purpose-named fields). No unauthorized role elevation (DB trigger is sole role writer, owner tier ungrantable via invite, server-side authorization). Verification green: tsc 0, eslint 0 (11 pre-existing warnings), 1063 tests passed/1 skipped, build OK. Carried forward: U1 resend-verification (HIGH), U2 unsaved-field loss (MEDIUM), U3 raw-error copy (MEDIUM), plus F4 LandlordAuth.tsx is dead code superseded by LandlordPortalAuth (LOW). Full review in docs/CALQULUS_ONBOARDING_AUDIT.md.

## HISTORY
Onboarding Edge Case + Failure Audit (phase 11, 2026-08-24) — audit only, no auth logic/routes/schema modified. All 24 edge/failure cases traced through real source across Manager/Agency/Landlord/Tenant/WebHost. Result: 16 HANDLED, 7 PARTIAL, 1 UNRESOLVED. Security boundaries verified (role-injection impossible, owner-tier ungrantable via invite, server-side authorization, webhost tenant firewall, no public admin registration, secrets hygiene, single-use time-limited invites, no user enumeration). Three unresolved issues documented with owning layer (no backend fixes invented): U1 no resend-verification control (HIGH, frontend), U2 unsaved onboarding field input lost on refresh/close (MEDIUM, frontend), U3 raw backend error.message reaches users on invitation-accept + onboarding-mutation paths (MEDIUM, frontend). Completed onboarding state is never lost (server-derived; Phase 10 completion reflects real state). Full matrix + recovery paths in docs/CALQULUS_ONBOARDING_AUDIT.md.

## HISTORY
WebHost Access (phase 9, 2026-08-23) — audit only, no public registration. Same invitation-controlled model as Admin Access: bootstrap-webhost (dev-only) for the first operator; PlatformAdminManagement creates subsequent operators server-side. ensureSignedInRole reads user_roles from the DB; role is never trusted from the client. Tested unauthorized access + wrong password + wrong-role redirect.

## HISTORY
Admin Access (phase 8, 2026-08-23) č audit only, no public registration. Invitation-controlled via PlatformAdminManagement (owner/business create admins); bootstrap-webhost for the first admin is dev-only. Server-side authorization enforced by ensureSignedInRole + RLS; MFA supported via user_mfa_secrets. Gaps documented in docs/CALQULUS_ADMIN_ACCESS_AUDIT.md.

## HISTORY
Tenant Invitation (phase 7, 2026-08-23) ŌĆö audit only, no parallel system. Existing email-link flow (validate_invitation_token RPC + create-tenant-account edge function) is secure: server-side validation, single-use, time-limited, email pre-associated, no client-trusted property IDs. Invalid-token falls through safely. Gaps documented in docs/CALQULUS_TENANT_INVITATION_AUDIT.md.

## HISTORY
Agency Onboarding (phase 6, 2026-08-23) ŌĆö portfolio-centric journey at /agency/onboarding: Account ŌåÆ Verification ŌåÆ Agency profile ŌåÆ First client ŌåÆ First property ŌåÆ Team invite ŌåÆ Complete. Amber accent via data-portal=agency; company_settings for profile + client note; existing auth signup for team invite.

## HISTORY
Landlord Onboarding (phase 5, 2026-08-23) ŌĆö investment-focused journey at /landlord/onboarding: Account ŌåÆ Verification ŌåÆ Profile ŌåÆ Portfolio types ŌåÆ First property ŌåÆ Financial setup (skip) ŌåÆ Complete. Emerald accent via data-portal=landlord; simple language; no plan selection.

## HISTORY
Manager Onboarding (phase 4, 2026-08-23) ŌĆö 7-step flow (/onboarding/manager) over existing APIs: Account ŌåÆ Verification ŌåÆ Organization ŌåÆ Portfolio types ŌåÆ First property ŌåÆ Team invite ŌåÆ Complete. Uses company_settings + existing auth signup (submanager invite), audit log, and property paths. Backend remains authoritative; no plan selection yet.

## HISTORY
Onboarding / Authentication audit (2026-08-23) ŌĆö see docs/CALQULUS_ONBOARDING_AUDIT.md. No auth logic modified.

## CURRENT TASK
Homepage + Webhost phases shipped. Next candidate per audit: Onboarding Phase 2 (unify portal auth shells).

## MASTER HOMEPAGE TRANSFORMATION (2026-08-22) The public homepage is now the premium dark-navy-hero SaaS page; Phase 0A (shell audit + preview) remains done.

## HISTORY
Homepage + Webhost shipped. Next candidate per audit: Onboarding Phase 2 (unify portal auth shells).

## MASTER HOMEPAGE TRANSFORMATION (2026-08-22)
- **Hero**: `ExecutiveHero` rebuilt as premium dark navy (`public-hero-surface` + `public-hero-title-dark` + `public-hero-grid-dark` utilities in `src/index.css`); transparent-over-hero `PublicHeader` that transitions to solid blurred white on scroll (scroll listener, threshold 24px); hero pulls under the sticky header via `-mt-[72px] pt-[72px]`. Carousel (residential/commercial/office ArchitecturalSurface treatments) kept.
- **New sections** (all content in `publicConfig.ts` single source of truth): `PlatformOverview` (#platform), `OperationalWorkflow` (#how-it-works, 8-step lifecycle), `ProductShowcase` (3 alternating rows reusing the SAME `ProductPreview` ŌĆö no new dashboard mockups), `TrustSection` (4 trust cards, only real capabilities: RBAC, RLS, activity logs, financial workflows ŌĆö no SOC2/ISO/PCI claims).
- **Reused unchanged**: `PublicShell`, `PublicPricing`+`usePublicTiers`, `ArchitecturalSurface`, `BrandMark`, `Button`, `PortalExperiences` (#solutions), `PropertyTypeSlider` (gained ┬¦12 value-proposition taglines; released #platform/#how-it-works anchors).
- **CompactCta**: ┬¦18 copy ("Ready to run your properties with clarity?"), Get started ŌåÆ signup, Explore the platform ŌåÆ #platform (fake "Contact us" mailto removed).
- **PublicFooter**: fake social links (LinkedIn/Facebook/Instagram/X pointing at #contact) removed per "no fake social URLs".
- **ProductPreview**: gained `captionClassName` + `elevated` props (dark-hero caption tone, stronger elevation); default rendering unchanged.
- **a11y fix**: portal-card description `text-muted-foreground` ŌåÆ `text-foreground/75` and "View portal" links darkened via `color-mix(accent 72%, navy-deep)` ŌĆö axe color-contrast (4.41/4.09 < 4.5) resolved.
- **SEO** (`index.html` + route titles): "CALQULUS | Property Operations, Connected" + description "Run properties, tenants, leases, billing, payments and maintenance in one focused property operations platform."
- **Tests**: `publicLanding.test.tsx` updated (11 tests: transparent-over-hero header, new sections, no-fabricated-certifications guard, final CTA); stale `homepage-executive.spec.ts` footer assertion fixed.
- **Verification**: 952 unit tests pass (80 files), homepage+a11y+app e2e 28 passed/5 skipped (credential-gated), axe clean, no horizontal overflow 360ŌĆō1440, screenshots verified 1440/768/390 + scrolled-header + mobile drawer. `npx tsc --noEmit` clean. eslint: 6 PRE-EXISTING parsing errors in untouched files (ServiceProviderProfile.tsx, TenantProfilePanel.tsx, PaymentPayersManager.tsx, etc.) ŌĆö `npm run build` fails on pristine HEAD for the same reason; NOT caused by homepage work. Dev server renders fine (those are lazy routes).

## PHASE 0A (COMPLETE 2026-08-21)
STATUS: audit complete, shell preview verified at all target viewports. Dashboards/portals NOT migrated ŌĆö see audit below.

## PHASE 0A AUDIT ŌĆö SHELL SHARING ACROSS PORTALS
The shell is NOT shared. There are five separate implementations:

- **Manager (+ Submanager role)** ŌĆö shared `src/shared/components/layout/Layout.tsx` (423-line `Sidebar.tsx` + 120-line `Header.tsx` + `PageHeader` + `Footer` + `CommandPalette` + `NotificationsDropdown` + `ProfileMenu` + `WorkspaceSwitcher` + `BreadcrumbSystem` + `ContextPanel` + keyboard shortcuts + help center). ~20 manager pages use it.
- **Landlord** ŌĆö own `LandlordLayout.tsx` (171 lines): hand-rolled sidebar + topbar, no breadcrumbs, no notifications, no user menu, no workspace switcher, no command palette.
- **Agency** ŌĆö own `AgencyLayout.tsx` (193 lines): same hand-rolled pattern as Landlord.
- **Tenant** ŌĆö own `TenantLayout.tsx` (190 lines): narrower sidebar (`w-56` vs `w-64`), shorter header (`h-14` vs `h-16`), mobile bottom tab bar inline (`MOBILE_NAV`) instead of a drawer; also a second, now-dead `MobileBottomNav.tsx` (never imported anywhere).
- **Admin + WebHost** ŌĆö share `WebhostLayout.tsx` (215 lines): own NAV list, own breadcrumb text, no notifications/user menu.

## PHASE 0A AUDIT ŌĆö DUPLICATION & INCONSISTENCIES
1. **Nav definitions duplicated 2ŌĆō3├Ś**: webhost NAV exists in both `WebhostLayout.tsx` and `Sidebar.tsx` (`webhostNavGroups`); agency in `AgencyLayout.tsx` + `agencyNavGroups`; tenant in `TenantLayout.tsx` (`DESK_NAV`/`MOBILE_NAV`) + `tenantNavGroups` + dead `MobileBottomNav.tsx`. They will drift.
2. **Drawer/scrim/sign-out/user-email block copy-pasted** across Landlord/Agency/Webhost layouts with near-identical markup.
3. **Loading spinner** (`h-8 w-8 animate-spin ŌĆ” border-primary`) duplicated in every portal layout.
4. **Active-nav styles differ**: manager `Sidebar` uses `sidebarNavClass` (`bg-primary/10`), portal layouts use `deskNavClass` (`border + bg-primary/10`). Accent tint comes from `--portal-accent` via `data-portal` in both, so the difference is structural, not colour.
5. **Chrome metrics differ per portal**: sidebar `w-64` (manager/landlord/agency/webhost) vs `w-56` (tenant); header `h-16` vs `h-14` (tenant); tenant mobile uses a bottom tab bar while every other portal uses a left drawer ŌĆö inconsistent mobile pattern.
6. **Breadcrumbs**: only the manager shell has `BreadcrumbSystem`; other portals hardcode "Portal / Title" text in the topbar (Tenant has none).
7. **Notifications/user menu/search**: exist only in the manager shell (`NotificationsDropdown`, `ProfileMenu`, command palette). Other portals sign out from the sidebar footer.
8. **`Layout.tsx` hardcodes `portalSurfaceProps("manager")`** for the shared shell ŌĆö fine today (only manager uses it) but a landmine if another portal adopts it.
9. **Dead code**: `src/features/tenant-portal/components/MobileBottomNav.tsx` is never imported.

## PHASE 0A AUDIT ŌĆö WHAT ALREADY MATCHES THE BRIEF
- Palette tokens in `src/index.css` exactly match the brief (`#081A2E/#0D2744/#173F67/#2F6FED/#FFFFFF/#F7F9FC/#E5EAF0/#102033/#637286`); portal accents via `[data-portal]` (manager blue `#2F6FED`, landlord emerald `#23856B`, agency amber `#9A5A16`, tenant violet `#5C4A8A`, platform_admin indigo `#3E4C94`).
- White sidebar + subtle border, white sticky topbar, light navy-tinted content background ŌĆö no black dashboard, no dark sidebar.
- Lucide icons everywhere, no emojis.
- Shared state components exist: `EmptyState`, `ErrorState`, `LoadingState` (`src/shared/components/ui/`), plus `PageHeader` (title/description/breadcrumbs/actions/status).

## FILES INSPECTED (Phase 0A)
- `src/shared/components/layout/{Layout,Sidebar,Header,PageHeader,BreadcrumbSystem,ProfileMenu,NotificationsDropdown,WorkspaceSwitcher,ContextPanel,Footer}.tsx`
- `src/features/landlord/components/LandlordLayout.tsx`
- `src/features/agency/components/AgencyLayout.tsx`
- `src/features/tenant-portal/components/{TenantLayout,MobileBottomNav}.tsx`
- `src/features/webhost/components/WebhostLayout.tsx`
- `src/core/design/{deskNav.ts,PortalAccentBar.tsx}`, `src/shared/theme/tokens.ts`, `src/index.css` (portal + sidebar tokens)
- `src/shared/components/ui/{empty-state,error-state,loading-state}.tsx`
- `src/features/design-preview/{pages/ShellPreviewPage.tsx,components/AuthenticatedShellPreview.tsx,shellPreviewConfig.ts}`
- `src/app/routes.ts` (preview routes are public)

## COMPONENTS TO REUSE (for the future unified shell)
- `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState`, `BrandMark`, `PortalAccentBar`, `portalSurfaceProps`, `deskNavClass`/`sidebarNavClass`
- `BreadcrumbSystem`, `NotificationsDropdown`, `ProfileMenu`, `WorkspaceSwitcher`, `CommandPalette`, `Footer`
- Preview chrome: `AuthenticatedShellPreview` + `SHELL_PREVIEW_PORTALS` (six identities incl. proposed WebHost teal `#17807A`)

## COMPONENTS TO CREATE (later phase ŌĆö NOT this one)
- One unified `AppShell` (sidebar + topbar + page header) driven by per-portal nav config, replacing the four hand-rolled portal layouts; single source of nav truth per portal; consistent mobile drawer (tenant bottom bar is a deliberate exception candidate ŌĆö decide explicitly).

## FILES CHANGED (this phase)
- `e2e/shell-preview.spec.ts` (new ŌĆö chrome render + overflow at all 7 viewports for all 6 portal identities, incl. mobile drawer)
- `docs/CALQULUS_REDESIGN_STATE.md`

## KNOWN ISSUES
- Five shell implementations (see audit); nav duplicated 2ŌĆō3├Ś; dead `MobileBottomNav.tsx`.
- Dev-only `DevPortalSwitcher` overlay intercepts pointer events in the preview when the dev server runs with `VITE_ENABLE_DEV_ACCESS` unset/true ŌĆö run preview/e2e with `VITE_ENABLE_DEV_ACCESS=false` (Playwright `webServer` env already does this when it spawns its own server).
- Live portals NOT migrated to any unified shell; preview is chrome-only with labelled canvas slots (loading/empty/error/ready), no live data.
- BrandMark logo image shows alt text ("CAI") in sandbox because the logo asset path doesn't resolve in this environment ŌĆö cosmetic, sandbox-only.
- `Layout.tsx` hardcodes the manager portal surface (audit item 8).

## TEST STATUS
- `npx vitest run src/test/shellPreview.test.tsx` ŌĆö 4/4 passed
- `npx eslint e2e/shell-preview.spec.ts` ŌĆö clean
- Playwright Chromium `e2e/shell-preview.spec.ts` ŌĆö **8 passed**: shared chrome for all 6 portal identities + loading/empty/error states; no horizontal overflow at 1440 / 1280 / 1024 / 768 / 480 / 390 / 360 (incl. open mobile drawer)

## BUILD STATUS
- Not re-run this phase (no production code changed; preview and test files only)

## NEXT STEP
STOP. Present the audit + preview for approval. Next phase (0B) would be building the unified `AppShell` and migrating portals one at a time, starting with Manager.

Preview URL: `/design-preview/shell` (public, no auth)

---

## Previous checkpoint (Phase 3 manager tenants)

Phase 3 ŌĆö Manager Tenants, Tenant Detail, and Leases.
STATUS: preview + live implementation complete. STOP after these three surfaces.

## COMPLETED
- Inspected live Tenants (`/tenants`) and Leases (`/leases`). Tenant detail is a sheet on the tenants page (no `/tenants/:id` route).
- Added layout preview at `/design-preview/manager-tenants` (Tenants / Tenant detail / Leases chrome ŌĆö labelled slots only, no invented balances or expiry)
- **Tenants:** header **Invite tenant** + **View leases**; searchable table in spec order (Tenant, Property / Unit, Lease, Rent, Balance, Status); row **View** opens detail; empty / loading / error kept; per-property **Add Tenant** and `InviteTenantDialog` / `MoveOutDialog` unchanged
- **Tenant detail:** header is tenant name, property, unit, status; primary **View statement**; sections Overview, Lease, Financial, Payments, Maintenance, Documents, Activity; extra existing tabs (Payers, Notices, Portal) remain; profile still uses nested identity / employment / emergency sections
- **Leases:** header **Create lease**; table Tenant, Property, Unit, Start date, Expiry, Rent, Status; Active / Expiring soon / Expired from stored status plus real `end_date` window; create form now shows inline field errors from existing `leaseSchema`; bulk deactivate confirmation kept
- No business-logic, API, or permission changes

## FILES INSPECTED
- `src/features/tenants/pages/Tenants.tsx`
- `src/features/tenants/components/{InviteTenantDialog,TenantProfilePanel,TenantLeaseTab,MoveOutDialog}.tsx`
- `src/features/leases/pages/Leases.tsx`
- `src/features/leases/components/LeaseCard.tsx`
- `src/shared/lib/{statusBadge,validations,dateFormat}.ts`

## COMPONENTS TO REUSE
- `InviteTenantDialog`, `MoveOutDialog`, `TenantProfilePanel`, `TenantLeaseTab`, `TenantPaymentsTab`, `TenantMaintenanceTab`, `TenantDocumentsTab`, `TenantStatement`
- `LeaseCard`, `leaseSchema`, `computeExpiringSoonIds`, `statusBadgeClass`
- `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState`

## COMPONENTS TO CREATE
- Preview: `ManagerTenantsPreview` + `ManagerTenantsPreviewPage`

## FILES CHANGED (this phase)
- `src/features/tenants/pages/Tenants.tsx`
- `src/features/leases/pages/Leases.tsx`
- `src/features/design-preview/pages/ManagerTenantsPreviewPage.tsx`
- `src/features/design-preview/components/ManagerTenantsPreview.tsx`
- `src/app/routes.ts`, `src/features/marketing/publicConfig.ts`
- `src/features/design-preview/pages/DesignPreview.tsx`
- Tests: `src/test/managerTenantsPreview.test.tsx`, `src/test/managerTenantsLayout.test.ts`, `e2e/manager-tenants-preview.spec.ts`
- `docs/CALQULUS_REDESIGN_STATE.md`

## KNOWN ISSUES
- Live Manager still uses `Layout` + `Header`/`Sidebar` (Phase 0A shell not migrated)
- Tenant detail remains a sheet on `/tenants` (existing pattern; no new `/tenants/:id` route)
- Lease "Expiring soon" overlay still uses the existing 30-day `end_date` window computed outside render
- Create-lease validation toasts were replaced with inline field errors; API error toasts unchanged
- Submanager scoping via `useManagerScope` is unchanged

## TEST STATUS
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- `npx eslint` on changed tenants / leases / preview files ŌĆö pass
- `npx vitest run` ŌĆö **904 passed**, 1 skipped
- Playwright Chromium: `/design-preview/manager-tenants` ŌĆö 8 passed at 1440 / 1280 / 1024 / 768 / 480 / 390 / 360 (no horizontal overflow)

## BUILD STATUS
- `npm run build` ŌĆö pass

## NEXT STEP
STOP. Do not continue to billing, other portals, or shell unification.

Preview URL: `/design-preview/manager-tenants`
Live URLs: `/tenants`, `/leases` (Manager session)

---

## Previous checkpoint (Phase 2 properties)

Phase 2 ŌĆö Manager Properties, Property Detail, and Units.
STATUS: preview + live implementation complete. Landed on `main` at `09faf96`.

- Properties table, property overview, and `/units` portfolio table
- Preview: `/design-preview/manager-properties`
- Tests: typecheck, eslint, 900 vitest passed + 1 skipped, Playwright Chromium overflow at 1440ŌĆō360, `npm run build` pass

---
- Inspected live Properties (`/properties`), Property Detail (`/properties/:id`), and unit CRUD (`UnitManagement` on the property record). There was no `/units` route; units lived on the property detail tab.
- Added layout preview at `/design-preview/manager-properties` (Properties / Property detail / Units chrome ŌĆö labelled slots only, no invented occupancy, rent, or balances)
- **Properties:** header **Add property** + **View units**; search, occupancy/sort filter, and row **View**; professional table from existing columns (Property, Category, Units, Occupancy, Tenants, Revenue); empty / loading / error kept; add / edit / deactivate dialogs unchanged
- **Property Detail:** header is property name, address, status, primary **Add tenant**; summary Units / Occupancy / Rent / Outstanding / Maintenance from live property, leases, unpaid invoices, and open maintenance; primary tabs Overview, Units, Tenants, Leases, Billing, Maintenance, Documents; extra existing tabs (Vacation, Water, Statement, Landlord, Settings, History) remain
- **Units:** new `/units` portfolio table ŌĆö Unit, Property, Tenant, Status, Rent, Lease, Balance from live `properties` + `units` + `tenants` + `leases` + unpaid `invoices`; semantic status badges; empty / loading / error
- Property-scoped unit CRUD (`UnitManagement`) preserved, including **Add House** / **Update House** forms
- Sidebar PORTFOLIO now includes Units between Properties and Landlords; webhost/landlord `/units` blocks and manager role paths updated

## FILES INSPECTED
- `src/features/properties/pages/Properties.tsx`
- `src/features/properties/pages/PropertyDetail.tsx`
- `src/features/properties/components/PropertyTableRow.tsx`
- `src/features/units/components/UnitManagement.tsx`
- `src/app/routes.ts`, `src/features/auth/lib/roleResolution.ts`, `src/shared/components/ProtectedRoute.tsx`
- `src/shared/components/layout/{Layout,PageHeader,Sidebar}.tsx`

## COMPONENTS TO REUSE
- Existing property CRUD dialogs, `PropertyTableRow`, `UnitManagement`, `AddTenantToPropertyDialog`, property detail tabs (`PropertyLeasesTab`, `PropertyBillingTab`, `PropertyMaintenanceTab`, `PropertyAgreementsTab`, ŌĆ”)
- `StatCard`, `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState`, `statusBadgeClass`

## COMPONENTS TO CREATE
- `src/features/units/pages/Units.tsx` ŌĆö portfolio units table
- `src/features/units/lib/portfolioUnits.ts` ŌĆö live join of properties / units / tenants / leases / invoices
- Preview: `ManagerPropertiesPreview` + `ManagerPropertiesPreviewPage`

## FILES CHANGED (this phase)
- `src/features/properties/pages/{Properties,PropertyDetail}.tsx`
- `src/features/properties/components/PropertyTableRow.tsx`
- `src/features/units/components/UnitManagement.tsx`
- `src/features/units/pages/Units.tsx`, `src/features/units/lib/portfolioUnits.ts`
- `src/features/design-preview/pages/ManagerPropertiesPreviewPage.tsx`
- `src/features/design-preview/components/ManagerPropertiesPreview.tsx`
- `src/shared/components/layout/{Layout,Sidebar,CommandPalette}.tsx`
- `src/app/routes.ts`, `src/features/marketing/publicConfig.ts`, `src/features/auth/lib/roleResolution.ts`
- `src/shared/components/ProtectedRoute.tsx`, `src/shared/hooks/useNavHistory.ts`
- Tests: `src/test/managerPropertiesPreview.test.tsx`, `src/test/managerPropertiesLayout.test.ts`, `e2e/manager-properties-preview.spec.ts`
- `docs/CALQULUS_REDESIGN_STATE.md`

## KNOWN ISSUES
- Live Manager still uses `Layout` + `Header`/`Sidebar` (Phase 0A shell not migrated)
- Property-detail extra tabs remain (Vacation, Water, Statement, Landlord, Settings, History) because they are existing workflows, not invented chrome
- Property-scoped unit forms still say **Add House** / **Update House** (existing product language)
- Submanager property scoping via `useManagerScope` is unchanged
- New `/units` page reads existing tables in memory (no new RPC / migration)

## TEST STATUS
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- `npx eslint` on changed properties / units / preview files ŌĆö pass
- `npx vitest run` ŌĆö **900 passed**, 1 skipped
- Playwright Chromium: `/design-preview/manager-properties` ŌĆö 8 passed at 1440 / 1280 / 1024 / 768 / 480 / 390 / 360 (no horizontal overflow)

## BUILD STATUS
- `npm run build` ŌĆö pass

## NEXT STEP
STOP. Do not continue to tenants, billing, leases, other portals, or shell unification.

Preview URL: `/design-preview/manager-properties`
Live URLs: `/properties`, `/properties/:id`, `/units` (Manager session)

---

## Previous checkpoint (Phase 1 dashboard)

Phase 1 ŌĆö Manager portal executive operations dashboard.
STATUS: preview + live implementation complete.

- Live dashboard header is **Dashboard** / *Portfolio overview and today's operational priorities.*
- Primary **Add property**, secondary **View reports**; attention strip from `buildAttentionItems`
- Four KPIs: Properties, Units, Occupancy, Collections; collections-first hierarchy
- Preview: `/design-preview/manager-dashboard`
- Tests: typecheck, eslint, 894 vitest passed + 1 skipped, Playwright Chromium overflow at 1440ŌĆō360, `npm run build` pass

---

## Previous checkpoint (Phase 0A shell)

Phase 0A ŌĆö Authenticated application shell audit + preview.
STATUS: preview complete. Live portal layouts were not migrated.

### COMPLETED (shell)
- Audited Manager, Landlord, Agency, Tenant, Admin/WebHost chrome
- Added preview-only route `/design-preview/shell`
- Preview shows white sidebar, 68px white top bar, portal-accent active nav, mobile drawer, page header, user menu, notifications, workspace selector, loading/empty/error canvases

### FILES INSPECTED (shell)
- `src/shared/components/layout/Layout.tsx`, `Sidebar.tsx`, `Header.tsx`, `PageHeader.tsx`, `BreadcrumbSystem.tsx`, `ProfileMenu.tsx`, `NotificationsDropdown.tsx`, `WorkspaceSwitcher.tsx`
- `src/features/landlord/components/LandlordLayout.tsx`
- `src/features/agency/components/AgencyLayout.tsx`
- `src/features/tenant-portal/components/TenantLayout.tsx`
- `src/features/webhost/components/WebhostLayout.tsx`
- `src/app/routes.ts`, `src/App.tsx`
- `src/core/design/deskNav.ts`, `PortalAccentBar.tsx`, `src/shared/theme/tokens.ts`
- `src/features/design-preview/pages/DesignPreview.tsx`, `PortalPreviewCanvas.tsx`

### COMPONENTS TO REUSE (shell)
- `BrandMark`, `PageHeader`, `PortalAccentBar`, `portalSurfaceProps`
- `Button`, `EmptyState`, `ErrorState`, `LoadingState`
- `CALQULUS_PORTAL_ACCENT` + `[data-portal]` CSS variables
- Lucide icons (already the only shell icon library)

### COMPONENTS TO CREATE (shell)
- Unified `DeskShell` / `AppSidebar` / `AppHeader` (not implemented in live routes)
- Shared nav config module to replace duplicated `NAV` arrays
- Optional: wire or delete orphans `TenantNotificationBell`, `MobilePageHeader`

### FILES CHANGED (shell)
- `src/features/design-preview/pages/ShellPreviewPage.tsx`
- `src/features/design-preview/components/AuthenticatedShellPreview.tsx`
- `src/features/design-preview/shellPreviewConfig.ts`
- `src/features/design-preview/pages/DesignPreview.tsx` (header link)
- `src/app/routes.ts`, `src/App.tsx`, `src/features/marketing/publicConfig.ts`
- `src/test/shellPreview.test.tsx` and related contract tests
- `docs/CALQULUS_REDESIGN_STATE.md`

### KNOWN ISSUES (shell)
- Live product has **three shells**, not one:
  - Manager: `Layout` + rich `Header`/`Sidebar` (command palette, notifications, profile, workspace switcher)
  - Landlord / Agency / Webhost: copy-pasted `*Layout.tsx` with minimal header
  - Tenant: unique `h-14` header + **bottom tab bar** on mobile
- Live selected nav uses **interactive blue wash** (`deskNavClass` / `sidebarNavClass`), not portal accent. Preview uses portal accent tint as specified for this phase.
- Live WebHost and Admin share `platform_admin` indigo. Preview splits WebHost as proposed teal `#17807A` (not a production token yet).
- Sidebar configs for non-manager roles in `Sidebar.tsx` are unused dead duplication.
- Tenant notification bell exists but is not wired into `TenantLayout`.
- No organization multi-select in portal layouts; Manager has `WorkspaceSwitcher` (portal jumper, not multi-org).

Preview URL: `/design-preview/shell`

---

## Previous checkpoint (Executive homepage on main)

Executive public homepage redesign landed on GitHub `main` (`d886882`, PR #66).
Public `/` is six sections only. Do not restart the homepage.

## COMPLETED (homepage)
- Public `/` reduced to six sections: Header, Hero, Property Type Slider, Portal Experiences, Compact CTA, Footer
- No photographs / no stock URLs; CSS navy architectural surfaces + optional `imageSrc` slot
- Illustrative manager dashboard labelled as sample figures (not live data)
- Existing portal/auth/legal routes preserved; newsletter is visual + `mailto:` only
- SEO title/description/OG updated in `index.html`

## FILES CHANGED
- `index.html`
- `src/index.css`
- `src/features/marketing/publicConfig.ts`
- `src/features/marketing/PublicLandingPage.tsx`
- `src/features/marketing/components/PublicHeader.tsx`
- `src/features/marketing/components/PublicFooter.tsx`
- `src/features/marketing/components/ProductPreview.tsx`
- `src/test/publicLanding.test.tsx`
- `src/test/publicConfig.test.ts`
- `docs/CALQULUS_REDESIGN_STATE.md`

## COMPONENTS CREATED
- `ArchitecturalSurface.tsx`
- `ExecutiveHero.tsx`
- `PropertyTypeSlider.tsx`
- `PortalExperiences.tsx`
- `CompactCta.tsx`

## COMPONENTS MODIFIED
- `PublicHeader.tsx` ŌĆö 72px white header, Resources dropdown, existing Sheet mobile menu
- `PublicFooter.tsx` ŌĆö deep navy `#081A2E`, valid routes/mailto only
- `ProductPreview.tsx` ŌĆö KPI row, CSS bars, maintenance + Kilimani Court, illustrative caption
- `PublicLandingPage.tsx` ŌĆö compact HomeView only (pricing route unchanged)

## KNOWN ISSUES
- Property photography not yet inserted (intentional this phase; `data-image-slot` ready)
- Company footer links (About/Careers/Partners/News) hash to `#contact` ŌĆö no standalone pages exist
- Cookie policy uses existing `/legal?tab=privacy` (legal surface has privacy + terms only)
- Social icons hash to `#contact` ŌĆö no official social URLs in repo
- Operator-owned: live Edge Function deploy + `20260820000000_tenants_select_role_in.sql` (unchanged)

## TEST STATUS
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- `npx eslint` on homepage marketing files ŌĆö pass
- `npx vitest run src/test/publicLanding.test.tsx src/test/publicConfig.test.ts` ŌĆö 13 passed
- `npx vitest run` ŌĆö **886 passed**, 1 skipped
- Playwright visual pass at 1440 / 1280 / 1024 / 768 / 480 / 390 / 360: no horizontal overflow
- Header ~73px; desktop hero ~561ŌĆō581px two-column from 1024px; mobile stacks text then dashboard

## BUILD STATUS
- `npm run build` ŌĆö pass

## NEXT TASK
STOP. Do not redesign other portals yet.
After merge: on Windows `git checkout main && git pull origin main`.

---

## Previous checkpoint (Phase 13 remaining-gap on main)

Phase 13 remaining in-git gaps landed on GitHub `main`.
Do not restart the redesign. Visual direction, RLS, auth contracts, and
routes are unchanged.

### COMPLETED TASKS
- Phase 13 audit (`a6f1adc`) + CRITICAL/HIGH (`2bb9f70`) on `main` (`f650a5a`)
- Continuation leftover HIGH/MEDIUM on `main` (`51538fc` / `851ae2b`)
- Remaining-gap pass (`2c31c08`) pushed to GitHub `main`
  - JWT `managerId` / payment ownership scoped after the caller check
    (`scopedActorId`, landlord-statement manager link, commission 403,
    auto-receipt invoice filtered by `manager_id`)
  - Upcoming payments no longer clear the list on query error
  - Live-desk amber/yellow class leftovers mapped to `warning` tokens
  - Email chrome defaults `#2F6FED` / status fills `#23856B` `#B7791F`
    `#C84B4B` instead of Tailwind green/amber hex
  - `LazyImage.tsx` `@ts-nocheck` removed (74 remaining, cap 75)

### Operator-owned (cannot finish from git)
1. Deploy Edge Functions (`health-check` still 404 live).
2. Apply `20260820000000_tenants_select_role_in.sql`.

Code remaining: large ops pages still `@ts-nocheck`; demo/lab suites
still in tree; E2E still credential-gated; some gated functions still
use the service role after a scoped caller check (by design for cron).

### Known issues (platform, unchanged by homepage)
- Live `health-check` 404 until function deploy (not claimed fixed)
- Live tenants RLS / `get_manager_dashboard_stats` unproven until SQL
  is applied (prior gate 2026-08-19: tenants `42P17`, RPC 404)
- `@ts-nocheck` still on large ops pages (74 files, cap 75)
- Demo/lab suites remain in tree, unrouted
- E2E portal tests still credential-gated

### Test status (Phase 13 checkpoint)
- `npx vitest run` ŌĆö **887 passed**, 1 skipped
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- Live `health-check` / RLS not re-probed this session

### Next exact action (after homepage merge)
On the Windows machine (`C:\Users\hp\Desktop\CALQULUS-PMS`):
`git checkout main && git pull origin main`.
Then operator deploys Edge Functions and applies
`20260820000000_tenants_select_role_in.sql`.
Do not restart the redesign.


### Phase 13 continuation (already on main) ŌĆö files changed
Frontend queries: `TenantBalanceSummary.tsx`, `TenantNotificationBell.tsx`,
`TenantPaymentSchedule.tsx`, `TenantPortableHistory.tsx`,
`UnitHistoryPanel.tsx`, `UnmatchedBankTransactions.tsx`.
Nav: `Sidebar.tsx`.
Tokens: `VacationNotices.tsx`, `PropertyVacationNoticesTab.tsx`,
`RecentActivity.tsx`, `PropertyBillingTab.tsx`, `ExpendituresTab.tsx`,
`PasswordChange.tsx`, `ContractEditor.tsx`, `TemplateManager.tsx`,
`InvoiceTable.tsx`.
Shared: `supabase/functions/_shared/assertCaller.ts`
(`rejectUnlessUserServiceOrCron`).
Edge Functions gated this branch: `generate-cashflow`, `generate-pnl`,
`generate-landlord-statement`, `process-commission`,
`send-payment-push-notification`, `send-invoice-due-push-notification`,
`send-manager-approval-notification`, `auto-send-receipt`,
`auto-send-rent-report`, `notify-manager-tenant-signup`,
`process-due-invoice-notifications`, `reconcile-bank`, `seed-maintenance`,
`send-deposit-refund-notification`, `send-maintenance-notification`,
`send-manager-contract-notification`, `send-manager-invoice-notification`,
`send-manager-receipt-email`, `send-monthly-report`,
`send-overdue-maintenance-notifications`, `send-payment-confirmation`,
`send-payment-reminders`, `send-property-assignment-notification`,
`send-receipt-email`, `send-receipt-status-notification`,
`send-overdue-notifications`.
Tests: `src/test/phase13Remediation.test.ts`.
Docs: this file.

Public-by-design left ungated: `activate-account` (token+password),
webhooks (`mpesa-callback`, `stripe-webhook`, `bank-webhook`),
`health-check`, invite/signup (`accept-tenant-invite`,
`self-register-tenant`, `claim-tenant`). `bootstrap-webhost` /
`seed-demo-data` keep their own service/env gates.

### Phase 13 remediations (already on main)
- `log-audit` requires a user JWT; actor is `ctx.user.id`, not the body.
- `notify-new-manager-signup` requires a user session, HTML-escapes names,
  upserts the role server-side (`ignoreDuplicates`), and uses navy chrome.
- `create-tenant-account` / `backfill-tenant-accounts` refuse `webhost`.
- `check-feature` requires auth, defaults to **starter**, and is self-scoped.
- `FeatureGate` wraps water billing, contracts, vacation notices, advanced
  analytics, and broadcast SMS. Premium features fail closed.
- SMS send/bulk: manager/agency/submanager only; bulk also checks `bulk_sms`.
- Middleware skips role rows for service-role callers; `checkRoleAccess`
  uses `limit` instead of `maybeSingle`.
- Submanager URLs carry `permission`; `can()` is false for landlords.
- Client no longer upserts `user_roles` on manager/agency/landlord signup.
- Query helpers throw instead of `return []` on inbox, payment history,
  deposit refunds, collection summary.
- Tenant inbox uses `VirtualizedList`. Agency and webhost ops are on the
  primary nav. PWA precache excludes chart/PDF vendors.
- Migration `20260820000000_tenants_select_role_in.sql` rewrites
  `tenants_select` via `role_in()` (must still be applied live).
- `health-check` remains in repo with `verify_jwt = false`; live deploy is
  still required for the 404 to clear.

### Phase 13 findings (audit ŌĆö original)
Full report: `docs/audits/PHASE_13_FINAL_PRE_CLAUDE_CURSOR_AUDIT.md`.

Live this session: `https://www.calqulus.site` HTTP 200; Edge `health-check`
404 NOT_FOUND. Repo: 92 functions, 78 migrations, ~75 `@ts-nocheck` files.

**CRITICAL**
- `log-audit` ŌĆö no JWT; service role inserts `activity_logs` (forgeable audit).
- `notify-new-manager-signup` ŌĆö no auth; mails every webhost via Resend.
- `create-tenant-account` / `backfill-tenant-accounts` allow `webhost` (tenant
  firewall contradiction).
- Live `health-check` not deployed (404).
- Plan paywalls unused: `FeatureGate` has zero importers; `useFeatureAccess`
  fails open (`enabled ?? true`, default plan `'pro'`).

**HIGH**
- SMS functions auth any JWT, no role gate; bulk SMS up to 500 recipients.
- Most of 92 Edge Functions do not use shared middleware.
- Core ops pages `@ts-nocheck` (Leases, Tenants, Properties, Billing, ŌĆ”).
- Query errors often `return []` (empty book instead of failure).
- Live schema vs 78 git migrations unverified; prior gate: `tenants` 42P17,
  `get_manager_dashboard_stats` 404 (2026-08-19, not re-proved this session).
- Submanager `viewOnly` wrapper does not mark submanagers view-only;
  `can()` treats landlords as fully permitted; direct URLs not permission-gated.
- Client `user_roles` upsert on signup.
- A11y/responsive certs cover public/login, not authenticated desks.
- `VirtualizedList` unused by features.
- Agency portal is layout wrappers over manager pages; ops routes off-nav.

**MEDIUM**
- Manager nav still has Portfolio (Properties, Landlords); docs/AGENTS.md stale.
- Webhost ops routes off primary nav; shared webhost sidebar is a stub.
- Amber Tailwind ~130 files; white-label cannot recolor them.
- Demo/lab suites still in tree; `/design-preview` public.
- PWA precache ~5.5MB; tests mock Supabase; E2E credential-gated.

**LOW**
- FeatureGate CTA is a raw `<a>`; email templates off-brand; conflicting
  ŌĆ£certificationŌĆØ filenames/scores.

**What is strong (do not undo)**
- Feature folders + lazy role routing; webhost frontend tenant hard-block;
  landlord feature tree has no tenant PII strings; Brand Studio does not
  overwrite `--primary` or status tokens; desk chrome (tokens, 44px, skip
  links); `devAccess` off in production; published price catalog.

**Honest bottom line (after remediations)**
Code now gates premium features, authenticates audit/signup notify, and
blocks webhost tenant-create. Live `health-check` 404 and unapplied
migrations remain until operators deploy functions and paste SQL.
`@ts-nocheck` on large ops pages is capped, not eliminated. Closest prior
independent live score remains **55/100** until schema/RPC/health-check
are proven on the linked project.

### Phase 13 implementation
See remediations list above. Application + Edge Function + migration +
test changes on `cursor/phase-13-gap-remediation-1e5d`.

### Phase 13 verification
- `npx vitest run src/test/phase13Remediation.test.ts` and full unit suite
- `npx tsc --noEmit -p tsconfig.app.json`
- Live health-check still 404 until function deploy

## CHECKPOINT
Phase 13 gap remediations merged to `main` (`2bb9f70`). PRs #62 (audit) and
#63 (fixes). Live health-check still needs function deploy; tenants RLS
migration still needs to be applied on the linked project.

## PREVIOUS PHASE
Phase 12 ŌĆö Accessibility certification. Audit keyboard navigation, focus,
contrast, ARIA, semantic HTML, form labels, error messaging, screen readers,
touch targets, colour-only states, tables, and dialogs. Fix issues. Do not
change business logic.

## PREVIOUS TASK
Phase 12 certification: shared primitives first (button, checkbox, radio,
select, table, badge, alert, dialog, sheet, chart, toast, skip links), then
portal nav `aria-current`, keyboard-activatable cards, labelled forms and
errors, warning text contrast, then tests. No new features. No auth/RLS/API
changes.

### Phase 12 findings (before any changes)
- Default buttons were 36px (`h-9`); icon buttons 36px; checkboxes and radios
  16px (below WCAG 2.5.8 24px). Auth password toggles were 28px.
- Lease filter cards and tenant inbox cards were mouse-only `onClick` cards.
- Manager, landlord, agency, and admin nav lacked `aria-current="page"`.
- `Badge` rendered a `<div>`; `AlertTitle` used `<h5>` (heading-order skip).
- `TableHead` had no `scope="col"`. Charts had no `role="img"` / label.
- Signup email errors were a `<p>` without `role="alert"` or `aria-invalid`.
- Landlord statement period and bulk unit fields lacked `htmlFor` / `id`.
- Design preview had `#main-content` but no skip link.
- Warning fill `#B7791F` on white is 3.64:1 (large-text AA only). Small
  `text-warning` failed 4.5:1.
- Occupancy bars already showed a percentage; they lacked a progressbar name.

### Phase 12 implementation
- Shared: default/icon buttons `min-h-11` (44px); checkbox/radio `h-6`;
  select/input `min-h-11` and `focus-visible`; table `scope="col"`; badge
  `<span>`; alert title `<p>`; dialog/sheet close `focus-visible`; chart
  `role="img"`; toast dismiss labelled; loader `aria-hidden`.
- Nav: `aria-current="page"` on Manager, Landlord, Agency, Admin, Tenant.
  Skip link on design preview; public `main` is focusable.
- Keyboard: lease status cards and tenant inbox cards use `role="button"`,
  `tabIndex={0}`, and `onActivateKey`.
- Forms: signup `aria-invalid` / `aria-describedby` / `role="alert"`;
  landlord period and bulk unit labels; trial hex text field labelled.
- Contrast: fill tokens stay locked (`#2F6FED`, `#23856B`, `#B7791F`,
  `#C84B4B`). Small text uses on-surface companions (`--primary-text`
  `#2459D6`, `--success-text` `#1B6B56`, `--warning-text` `#9A5A16`,
  `--destructive-text` `#A33A3A`). Footer headings on navy use white.
  Occupancy bars named via `role="progressbar"`; status still has visible
  text.
- Reduced motion already present; certification test asserts it.

### Phase 12 verification
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- ESLint on touched files ŌĆö 0 errors
- `npx vitest run` ŌĆö 877 passed; 1 skipped
- Playwright Chromium `e2e/a11y.spec.ts` ŌĆö 10 passed (axe WCAG 2A/2AA
  critical+serious on design preview, homepage, all five login portals;
  skip link; labelled dialog; table `scope="col"`)
- Playwright Chromium (`responsive-certification`, `design-preview`,
  `app`, `homepage-executive`) ŌĆö 46 passed, 5 skipped (credential-gated)
- `npm run build` ŌĆö pass
- Merged to `main` as `2f505ce`. PR #61.

## PREVIOUS PHASE
Phase 11 ŌĆö Responsive certification. Merged to `main` (`a1e23d1`). PR #60.
Audit at 1440, 1280, 1024, 768, 480, 390, and 360. Do not hide information.
Tenant received highest mobile priority.

Phase 10 ŌĆö Product-wide polish. James issued a refinement-only brief: audit
spacing, typography, colour, buttons, cards, tables, forms, icons, charts,
navigation, headers, footers, modals, badges, empty states, loading, errors,
and success. Merged to `main` (`7b69d54`). PR #59.

### Phase 10 findings (before any changes)
- Selected nav on Manager (`Sidebar`) and Landlord still filled with
  `--portal-accent-muted`. Agency, Tenant, and Platform Admin already use
  `bg-primary/10`. Design preview already shows the correct selected wash.
- App desks rendered the full five-column `Footer` (portal marketing links,
  fake compact ŌĆ£OperationalŌĆØ pulse). Compact footer existed but was unused
  except as a variant name.
- `MarketingWebsite.tsx` is unrouted leftover chrome: black canvas,
  emerald/teal/sky classes. It is the `noDefaultPalette` fail. Live homepage
  is `PublicLandingPage`.
- Tenant auth screens used `from-accent/20` gradients and amber links.
  Landlord/tenant forgot-password dialog used `#0F1E36`.
- Shared `DialogTitle` was `text-lg` instead of `type-subtitle`. Empty/error
  icon wells used `rounded-full`. LazyImage placeholders were slate-800/900.
- Leftover Tailwind greens/ambers/oranges on live badges and deactivate
  buttons. Gold/amber gradient wells on dashboard overview widgets and
  property detail. Occupancy bars used `to-teal` gradients.

### Phase 10 implementation
- Shared `deskNavClass` / `sidebarNavClass`: selected item is `bg-primary/10`.
  Portal colour stays the 2px `PortalAccentBar`. Manager and Landlord rails
  no longer fill with `--portal-accent-muted`.
- Authenticated desks use the compact footer. Removed the fake ŌĆ£OperationalŌĆØ
  pulse and the Sparkles ŌĆ£contactŌĆØ icon.
- `DialogTitle` uses `type-subtitle`. Empty/error wells use `rounded-md` and
  type tokens. LazyImage placeholders are muted, not slate-900.
- Unrouted `MarketingWebsite` re-exports `PublicLandingPage` (kills the black
  emerald canvas). Tenant/landlord auth lost accent gradients and `#0F1E36`.
- Leftover green/amber/orange/red utility classes on live badges and buttons
  mapped to success/warning/destructive/primary. Deactivate actions use warning.
  Occupancy bars are solid primary, not teal gradients.

### Phase 10 verification
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- ESLint on touched files ŌĆö 0 errors; 2 pre-existing-style warnings
  (`PendingApproval` hook deps; `MarketingWebsite` re-export)
- `npx vitest run` ŌĆö 857 passed; 1 skipped
  (`noDefaultPalette` now passes; the black/emerald marketing canvas is gone)
- Playwright Chromium (`design-preview`, `a11y`, `app`, `homepage-executive`)
  ŌĆö 32 passed, 5 skipped (credential-gated auth)
- `npm run build` ŌĆö pass
- Merged to `main` as `7b69d54`.

## PREVIOUS TASK
Phase 10 polish complete and merged to `main`.

## PREVIOUS PHASE
Phase 9 ŌĆö White-label Brand Studio. James issued the Brand Studio brief:
Identity, Colours, Portal themes, Communications, Documents, Domain, live
preview. Configuration-driven. No CSS injection. Merged to `main` (`ba1ee05`).

## PREVIOUS TASK
Phase 9 Brand Studio complete and merged to `main`. Live editor is Settings ŌåÆ
Brand Studio. Platform Admin `/webhost/brand` stays CALQULUS preview.

### Phase 9 findings (before any changes)
- Live branding already lives on `company_settings` (name, logo, contact,
  `brand_primary_hex`, `white_label_enabled`, `brand_config` jsonb).
- `BrandConfig` is the named contract. `composeBrandConfig` / `parseOrgBrandRecord`
  / `compactBrandOverlay` already merge platform defaults with the org overlay.
- `WhiteLabelProvider` applies at most `--brand-primary*` after
  `deriveBrandPalette` contrast checks. It never writes `--primary` or status
  tokens. Webhost / login stay CALQULUS (`get_org_brand()` returns null).
- Settings ŌåÆ Branding was a dense form inside `CompanySettings`. Secondary,
  accent, portal accents, statements, reports, and a draft preview were
  missing. Saving Organization also rewrote `brand_config` from stale state.
- `MultiBrandStudio` / `CustomDomainConfig` / `BrandAssetManager` are
  structural previews with fabricated DNS ŌĆ£verifiedŌĆØ state. Not used for save.
- Custom domain is stored on `brand_config.domains.customDomain`. DNS/TLS are
  not provisioned from the app. RLS: owner or webhost; UI still denies webhost
  org edits (platform chrome stays CALQULUS).

### Phase 9 implementation
- `OrgBrandStudio` is the live editor at Settings ŌåÆ Branding (nav label Brand
  Studio). Draft preview, then Save. Named sections match the brief.
- Colours and portal accents go through `deriveBrandPalette`. Unapproved
  primary cannot enable white-label. Status green/amber/red stay read-only.
- Inputs are sanitized (plain text, https/relative URLs, host-only domain).
  No CSS or script payloads in `brand_config`.
- Organization save writes contact/address only. Branding columns and jsonb
  are written only from Brand Studio.
- `/design-preview` Brand Studio shows the named sections and live frames.
- Platform Admin Brand Studio remains a CALQULUS structural preview.

### Phase 9 verification
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- ESLint on touched files ŌĆö 0 errors; 1 pre-existing warning
  (`CompanySettings` `useEffect` missing `user` dep)
- `npx vitest run` ŌĆö 853 passed; 1 skipped; 1 pre-existing fail
  (`noDefaultPalette` on `MarketingWebsite.tsx`, not this phase)
- Playwright Chromium (`design-preview`, `a11y`, `app`, `homepage-executive`)
  ŌĆö 32 passed, 5 skipped (credential-gated auth)
  Brand Studio preview: Identity, Colours, Portal themes, Communications,
  Documents, Domain, and live frames (Login / Header / Sidebar / Dashboard /
  Buttons / Document) ŌĆö pass
- `npm run build` ŌĆö pass
- Merged to `main` as `39422fb`.

## PREVIOUS PHASE
Phase 8 ŌĆö Platform Admin. James issued the control-tower brief: white / navy /
indigo accent. Dashboard: Organizations, Users, Active sessions, Revenue,
Transactions. System health: Database, API, Payments, Notifications, Storage
where a live probe exists ŌĆö never invented. Security: Authentication events,
Failed logins, Permission events, Alerts. Business: Organizations,
Subscriptions, Usage. Named pages: Dashboard, Organizations, Organization
Detail, Users, Subscriptions, Audit Log, Security, Settings, Brand Studio.
Merged to `main` (`7f4d5ed`).

## PREVIOUS TASK
Phase 8 platform admin desk complete and merged to `main`. Preview on
`/design-preview`, then production pages. Auth prefix `/webhost` unchanged.

### Phase 8 findings (before any changes)
- The webhost desk was one tabbed page (`WebhostDashboard`) with Overview,
  Accounts, Subscriptions, Security, Issues, plus a secondary strip
  (Properties, Landlords, Tiers, Billing Rules, Custom Pricing, Contracts).
- Overview was a KPI/chart desk, not a control tower.
- Live health: `checkHealth()` probes Supabase `profiles` + localStorage.
  Edge `health-check` reports database, auth, storage, edgeFunctions. It
  does **not** probe payments or notifications.
- `user_sessions` RLS is own-rows only. There is no platform-wide session
  count to show honestly.
- Failed logins have no dedicated table; they can only be derived from
  `activity_logs`.
- Organizations = manager + agency `user_roles`. Users = non-tenant role
  counts. Subscriptions = existing `ManagerBilling`. Brand Studio =
  `MultiBrandStudio`.

### Phase 8 implementation
- One `WebhostLayout`: white desk, navy chrome, 2px indigo accent. Rail with
  the nine named pages. Selected item is `bg-primary/10`, not an indigo fill.
  Permission-gated nav kept (`can_manage_managers`, `can_manage_billing`,
  `can_view_activity_logs`). Super-admin permission bootstrap kept.
- Dashboard is a control tower: platform stats, probed health only,
  audit-derived security, business usage as property count. Sessions labelled
  ŌĆ£Your sessions onlyŌĆØ / ŌĆ£Not availableŌĆØ. Payments and Notifications always
  ŌĆ£Not probedŌĆØ.
- Organizations wrap `ManagerManagement` with an Open link to
  `/webhost/organizations/:userId`. Detail shows status, tier, properties,
  units ŌĆö no tenant PII. Users = role head-counts + `WebhostManagement`.
  Subscriptions = `ManagerBilling`. Audit = `SecurityAuditLogs` + `ActivityLog`
  with tenant entity rows hidden. Security = account access + auth/failed/
  permission lists from the audit log. Settings = platform admins + payment
  accounts. Brand Studio = `MultiBrandStudio`.
- Extra existing screens stay reachable off-nav (properties, landlords,
  tiers, billing-rules, custom-pricing, contracts, issues).
- `/design-preview` Platform Admin tab shows the named pages and control-tower
  layout. Health tiles say Not probed / Probed live ŌĆö no fake Healthy payments.

### Phase 8 verification
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- ESLint on touched files ŌĆö pass
- `npx vitest run` ŌĆö 848 passed; 1 pre-existing fail
  (`noDefaultPalette` on `MarketingWebsite.tsx`, not this phase)
- Playwright Chromium (`design-preview`, `a11y`, `app`, `homepage-executive`)
  ŌĆö 32 passed, 5 skipped (credential-gated auth)
  Platform Admin preview overflow checks at 360 / 390 / 480 / 768 / 1280 ŌĆö pass
- `npm run build` ŌĆö pass
- Merged to `main` as `7f4d5ed`.

## PREVIOUS PHASE
Phase 7 ŌĆö Tenant experience. James issued the tenant brief: white / navy /
violet accent, simple and mobile-first. Dashboard: Good morning, Your home
(property / unit), Rent due (amount, due date, Pay rent), then Lease,
Maintenance, Receipts, Documents, then recent activity. No large KPI
dashboards, complex analytics, enterprise navigation, or excessive cards.
Named pages: Dashboard, Payments, Lease, Maintenance, Receipts, Documents,
Profile (already present). Merged to `main` (`dd8fded`).

## PREVIOUS TASK
Phase 7 tenant portal complete and merged to `main`. Preview on
`/design-preview` (mobile and desktop), then production pages. Auth prefix
`/portal` unchanged. Pay dialogs, invoices, receipts, contracts, and
maintenance backends reused.

### Phase 7 findings (before any changes)
- Home was two different UIs (mobile hero vs desktop six-card KPI grid plus
  bills hub, receipts, balance, invoices table). Teal filled the Pay button.
- Each sub-page rebuilt its own header and bottom nav. Bottom nav had six
  cramped items including Inbox.
- Receipts lived on the dashboard. Lease was labelled Contracts.
- Payments was history plus three KPI cards, not a clear ŌĆ£what you oweŌĆØ.

### Phase 7 implementation
- One `TenantLayout`: white desk, navy chrome, 2px violet accent. Mobile
  bottom nav (Home, Pay, Fix, Docs, Me). Desktop rail with the seven named
  pages. Selected item is `bg-primary/10`, not a violet fill.
- Dashboard is `TenantHome`: greeting, home, rent due, Pay rent, four
  shortcuts, recent activity. PAY RENT still opens existing STK / pay dialogs.
- Payments reuses `TenantBillsHub` + history list (KPI cards removed).
- Receipts is a page wrapping existing `ReceiptUpload` / `ReceiptHistory`.
- Lease is `/portal/contracts` (`/portal/lease` redirects). Maintenance is a
  single Report a problem control plus the existing request list/dialogs.
- Extra routes (inbox, vacation notices, services) stay reachable off-nav.

### Phase 7 verification
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- ESLint on touched files ŌĆö pass
- `npx vitest run` ŌĆö 840 passed; 1 pre-existing fail
  (`noDefaultPalette` on `MarketingWebsite.tsx`, not this phase)
- Playwright Chromium (`design-preview`, `a11y`, `app`, `homepage-executive`)
  ŌĆö 27 passed, 5 skipped (credential-gated auth)
  Tenant preview overflow checks at 360 / 390 / 480 / 768 / 1280 ŌĆö pass
- `npm run build` ŌĆö pass
- Merged to `main` as `dd8fded`.

## PREVIOUS PHASE
Phase 6 ŌĆö Agency portal. James issued the agency desk brief: white / navy /
amber-orange accent, core question ŌĆ£How are our clients and portfolios
performing?ŌĆØ, named pages Dashboard, Clients, Portfolio, Property Detail,
Tenants, Billing, Reports, Settings. Agency must feel portfolio-oriented,
client-oriented, and operational ŌĆö not Manager with an orange colour.

## PREVIOUS TASK
Phase 6 agency portal complete and merged to `main` (PR #55). Preview on
`/design-preview`, then production pages. Auth prefix `/agency` unchanged.
Existing landlord-link, property, tenant, billing, and report backends reused.
Nested Manager chrome is skipped via `DeskEmbedProvider`. Property links stay
on `/agency/properties/:id`.


### Phase 6 findings (before any changes)
- Agency already had a dedicated layout and `/agency/*` routes, but every
  operations page wrapped a Manager screen (`Properties`, `Tenants`,
  `Billing`, `Reports`, `Settings`, `ManagerLandlords`) inside **and** that
  screenŌĆÖs own `Layout`. Result: Manager chrome with an amber stripe.
- Nav was a 13-item clone of Manager (Properties, Leases, Water Billing,
  Invites, Statements, Maintenance, Landlords, Vacation Notices).
- Dashboard already queried properties/invoices/leases as `manager_id =
  auth.uid()`, plus occupancy and a six-month collections series. It did
  **not** count clients (`property_landlords`) or show client rollups.
- Opening a building from the wrapped Properties page went to
  `/properties/:id` (manager route). Agency-only users would leave the desk.
- `useRBAC().can()` treated managers as full-ops but not agency, even though
  the product rule is that agency has the same tenant/billing operations
  in its own book.

### Phase 6 implementation
- Nav trimmed to the eight named pages. Extra existing routes stay reachable
  (leases, maintenance, water billing, invites, statements, vacation notices,
  building CRUD at `/agency/properties`). `/agency/landlords` redirects to
  Clients.
- Dashboard answers the client/portfolio question with Clients, Properties,
  Units, Occupancy, Collections, attention, client performance, and the
  existing six-month activity series. Data from properties +
  `property_landlords` + invoices + expiring leases.
- Clients = landlord rollup (occupancy/collections) plus the existing
  link/invite UI. Portfolio = per-building client, occupancy, collections.
  Property detail = existing `PropertyDetail` at `/agency/properties/:id`.
  Building CRUD and property cards stay on that prefix via `deskPropertyPath`.
- Agency layout: white desk, navy chrome, 2px amber accent. Selected nav is
  `bg-primary/10`, not an orange-filled item. `DeskEmbedProvider` stops
  nested Manager `Layout` chrome. `can()` grants agency the manager-scope
  operations permissions already documented.

### Phase 6 verification
- `npx tsc --noEmit -p tsconfig.app.json` ŌĆö pass
- ESLint on touched files ŌĆö pass
- `npx vitest run` ŌĆö 834 passed; 1 pre-existing fail
  (`noDefaultPalette` on `MarketingWebsite.tsx`, not this phase)
- Playwright Chromium (`design-preview`, `a11y`, `app`, `homepage-executive`)
  ŌĆö 22 passed, 5 skipped (credential-gated auth)
- `npm run build` ŌĆö pass
- Merged to `main` as PR #55.

## PREVIOUS PHASE
Phase 4E ŌĆö Manager operations. James issued the manager operations brief:
redesign Maintenance, Reports, and Settings. Maintenance lanes: New,
Assigned, In Progress, Awaiting, Completed. Reports filters: Period,
Property, Report type ŌĆö existing reports only, charts only where useful.
Settings groups: Organization, Users, Roles, Notifications, Billing,
Integrations, Security, Branding. Do not invent functionality.

## PREVIOUS TASK
Phase 4E manager operations. Preview first on
`/design-preview`, then production pages. Auth, RLS, APIs, and existing
settings/report/maintenance backends unchanged.

### Phase 4E findings (before any changes)
- **Maintenance** (`/maintenance`): tabs were All / Open / In Progress /
  Done plus four decorative KPI cards. Live statuses are
  `open | pending | in_progress | completed | cancelled`. Assign already
  existed, but `assignRequest()` also wrote `status: "in_progress"`, which
  would empty an Assigned lane. PDF export already treated open+unassigned
  as Assign and open+assigned as Start work.
- **Reports** (`/reports`): Period select (3/6/12 months) already existed.
  Default tab was Executive Analytics / catalog with hardcoded
  `lastGenerated` dates. Real reports: revenue trend, occupancy, arrears
  aging, revenue by property, collection summary. Arrears used a decorative
  pie alongside the same summary list.
- **Settings** (`/settings`): thirteen flat tabs (Profile, Password,
  Notifications, Payment Settings, Bank Integration, Currency, Company,
  Receipts, Payment Reminders, Date & Time, Submanagers, User Roles,
  Cache). Company already mixed org identity and white-label branding.
  Platform billing already lives at `/platform-billing`. Selected nav used
  leftover `bg-amber-400`. `?tab=` query param already worked.

### Phase 4E implementation
- Maintenance lanes derived from existing columns (no new status). Assign
  now only sets `assigned_to` / `assigned_provider_id`. Cancelled rows sit
  on Completed with the real cancelled badge. Quiet 5-cell count strip.
- Reports control bar: Period + Property + Report type. Default report is
  Revenue trend. Existing catalog/builder/alerts/executive remain as types,
  not the landing view. Occupancy and revenue keep bar charts; arrears is
  the aging list only.
- Settings nav regrouped into the eight named groups. Branding is the
  existing Company white-label fields (`CompanySettings section="branding"`).
  Platform billing is a link to `/platform-billing`. Legacy `?tab=` ids kept.
- Preview: `/design-preview` ŌåÆ Maintenance, Reports, Settings.

## PREVIOUS PHASE
Phase 5 ŌĆö Landlord portal. James issued the landlord desk brief: redesign the
entire landlord experience around ŌĆ£How is my property portfolio performing?ŌĆØ
with white / navy / emerald accent, dedicated pages (Dashboard, Portfolio,
Property Detail, Financial Performance, Statements, Maintenance, Documents,
Settings), and an explicit ban on copying the Manager operations desk.

## PREVIOUS TASK
Phase 5 landlord portal. Split the previous
single-tab `/landlord/dashboard` into a real landlord desk. Auth, RPCs, and
tenant-PII firewall unchanged.

### Phase 5 findings (before any changes)
- Landlord had **one authenticated route**: `/landlord/dashboard`. Portfolio,
  statements, documents, payouts, messages, and settings were tabs inside
  `LandlordDashboard.tsx`. Sidebar only listed ŌĆ£PortfolioŌĆØ.
- Data was already landlord-safe: `get_landlord_portfolio_stats`,
  `get_landlord_revenue`, `get_landlord_property_ops` (no tenant names).
  `payment_transactions` RLS still blocks landlords ŌĆö recent transactions on
  the dashboard are payout requests plus property-level collected totals,
  not a tenant payment ledger.
- Dual-role users were only forced onto the landlord role for
  `/landlord/dashboard`. New desk paths like `/landlord/portfolio` would have
  matched manager `MANAGER_PATHS` `/landlord`. Fixed via `isLandlordDeskPath`
  (`/landlord/ŌĆ”` except login/invitation; never `/landlords`).

### Phase 5 implementation
- New layout (`LandlordLayout`) with emerald 2px accent, white desk, navy
  chrome. Nav: Dashboard, Portfolio, Financials, Statements, Maintenance,
  Documents, Settings.
- Extracted `useLandlordPortfolio` / `useLandlordPayouts` / income-trend and
  maintenance aggregation from existing RPCs. No new endpoints.
- Dashboard answers the portfolio question with six real numbers, attention,
  income trend, property performance table, recent payouts.
- Property detail is `/landlord/properties/:id` wrapping the existing
  `LandlordPropertyDetail` (units/status only).
- Financials vs Statements split the existing `LandlordFinancialStatement`
  (`mode="performance" | "statement"`). Payouts live on Statements.
- Preview: `/design-preview` ŌåÆ Landlord lists every named page.
- Tests: `src/test/landlordDesk.test.ts` plus roleResolution coverage and
  design-preview E2E.

## PREVIOUS PHASE
James issued "CALQULUS PHASE 4D ŌĆö MANAGER FINANCE" right after Phase 4C -
redesign Billing and Payments. See historical notes below.



### Phase 4D findings (before any changes)
Read this file first, then mapped the two named surfaces to actual routes:
`/billing` -> `Billing.tsx` (no `@ts-nocheck`, already refactored into
`BillingStatsBar`/`InvoiceTable`/`ExpendituresTab`/`ReceiptsTab` plus a
`useBillingData` React Query hook), `/payments` -> `ManagerPaymentHistory.tsx`
(pre-existing `@ts-nocheck`, 1385 lines, five tabs: Payment History, Pending,
Analytics, Bank Reconciliation, Notifications).
- **A real schema-drift bug, not a hypothetical one**: the generated
  `src/integrations/supabase/types.ts` still describes `invoices` without
  `original_amount`/`paid_amount`/`balance_due` and `invoice_status` as only
  `paid | pending | overdue | cancelled` - but migration
  `20260506000003_comprehensive_payment_schema.sql` added those three
  numeric columns (for partial/instalment payments) and the wider status
  set (`partially_paid`, `failed`, `refunded`) is already live and already
  used elsewhere (tenant portal, Reports, PropertyCollectionStatement,
  `InvoiceTable.tsx`'s own local `InvoiceStatus` override, `shared/lib/
  money.ts`'s `PayableInvoice`/`invoiceOwedMinor`). The **manager-facing**
  `BillingStatsBar.tsx` and `InvoiceTable.tsx` were the one place that hadn't
  caught up - `InvoiceTable.tsx` had a comment stating outright "the
  invoices table has no balance_due/partial-payment columns yet," which is
  simply incorrect. Fixed by extending `BillingInvoice` (useBillingData.ts)
  with the three real columns and the real 7-value status union (still no
  query change needed - `fetchInvoices()` already selects `"*"`), and by
  widening `shared/lib/money.ts`'s `PayableInvoice` fields from `?: number`
  to `?: number | null` to match what `invoiceOwedMinor()`'s own runtime
  checks already assumed.
- **Billing stat bar** (`BillingStatsBar.tsx`): renamed "Total billed" ->
  "Billed", "Pending" -> "Outstanding" per the brief's exact field names,
  and fixed the underlying math to use the real columns instead of
  bucketing by status alone - Billed = sum of `original_amount ?? amount`
  across non-cancelled/non-refunded invoices, Collected = sum of
  `paid_amount` (falling back to full `amount` only for legacy `paid` rows
  with no `paid_amount` recorded), Outstanding = sum of `invoiceOwedMinor()`
  (shared/lib/money.ts - the exact same balance-owed calculation the
  payment-allocation engine uses) across every unpaid, non-cancelled
  invoice, Overdue = the same calculation restricted to `status ===
  "overdue"`. This means a partially-paid invoice now contributes its
  billed amount once and its real remaining balance to Outstanding,
  instead of the old logic which only summed `pending`-status invoices at
  full face value and had no concept of partial payment at all.
  Semantic color per brief: Billed neutral, Collected `text-success`,
  Outstanding `text-warning`, Overdue `text-destructive`.
- **`InvoiceTable.tsx`** Amount column now shows the real remaining balance
  (via `invoiceOwedMinor`) with an "of X - partial" sub-line when an
  invoice is `partially_paid` and the balance differs from the original
  amount - the same convention `ManagerPaymentHistory.tsx`'s Pending tab
  already used, just now available on the main Invoices table too.
- **Payments page** (`ManagerPaymentHistory.tsx`, "Payment History" tab -
  this is the brief's "Payments" surface): the existing table already had
  Date/Tenant/Property/Invoice/Amount/"Payment Method"/Status - 6 of the 7
  named columns - but two real problems: (1) it sourced rows from
  `invoices` where `status = "paid"`, which has no method/reference
  columns at all, so "Payment Method" was **inferred** from whether the
  tenant had a phone number on file (`p.tenants?.phone ? "M-Pesa" :
  "Card/Other"`) rather than reading anything real, and Reference didn't
  exist as a column anywhere in the page; (2) Status was a hardcoded
  "Paid" badge, not read from anything. Traced how a payment actually gets
  written: `record-payment` (manual entry) forwards to `process-payment`,
  which inserts into `payment_transactions` with real `payment_method`,
  `bank_reference` (the actual reference), and `status: "completed"`;
  `mpesa-callback` (STK completions) updates the same row with
  `mpesa_receipt_number` and `status: "completed"`. Rebuilt `fetchPayments`
  to query `payment_transactions` (`status = "completed"`, joined to
  `invoices(invoice_number, leases(property,unit))` and `tenants(...)`)
  instead of `invoices`, mapped into the same downstream shape so every
  other calculation in the file (monthly trend, tenant breakdown, CSV/PDF
  export) kept working unchanged, and added the real fields: `payment_method`
  (falls back to the legacy `payment_type` column for any pre-migration
  row), `reference` (`bank_reference ?? mpesa_receipt_number ??
  checkout_request_id`), `tx_status`. Added the missing **Reference**
  column to the table and CSV export. Status badge now reads
  `invoiceStatusTone`/`invoiceStatusLabel` (shared/lib/statusBadge.ts,
  extended with a `"completed"` case) against the real per-row status
  instead of a hardcoded "Paid". The phone-based M-Pesa/Card heuristic was
  replaced everywhere it appeared (page `stats`, monthly trend split, CSV
  method column) with a real check (`isMpesaMethod()`, new in
  statusBadge.ts) against the real `payment_method` column.
- **"Do not turn finance into a colourful dashboard"**: the Payment
  History tab had its own full KPI-cards + Monthly-Revenue-bar-chart +
  Payment-Method-pie-chart block inlined directly above the table -
  100% duplicated by the dedicated "Analytics" tab's `PaymentAnalytics`
  component (same KPIs, same monthly trend, same method pie, plus a
  collection-rate figure and top-tenants list the inline block didn't
  even have). Removed the duplicate block entirely - nothing is lost,
  the identical functionality is still one tab away under Analytics,
  untouched. What the inline block had that Analytics didn't - the "Top
  Properties by Revenue" ranking - was kept, but re-rendered as a plain
  ranked list with a single-color progress bar instead of a Recharts bar
  chart with an indexed rainbow palette. Replaced the 4 decorative KPI
  cards with a 3-cell plain summary strip (Total Collected in
  `text-success`, Transactions and This Month in plain `text-foreground` -
  no colored icon chips). Also neutralized amber-specific decorative
  accents (avatar fallback colors, selected-card border/background) in
  the "Tenant Payment Details" section to `text-primary`/`border-primary`,
  since amber there was decorative rather than semantic (no warning/danger
  meaning attached to a tenant being selected). Left `PaymentAnalytics.tsx`
  itself untouched - it's the dedicated Analytics tab, not the "Payments"
  surface the brief names, and touching its charts wasn't asked for.
  Removed now-dead imports afterward: the whole `recharts` import block,
  `BRAND_CHART_COLORS`, `TrendingUp`, and the `paymentMethodData` memo
  (all were only referenced by the deleted block).
- Reused rather than reinvented: `invoiceOwedMinor`/`fromMinorUnits`
  (shared/lib/money.ts) for every "how much is actually owed" calculation
  on both surfaces, and added `paymentMethodLabel()`/`isMpesaMethod()` to
  `shared/lib/statusBadge.ts` as the one shared place both
  `ManagerPaymentHistory.tsx` and (going forward) `PaymentAnalytics.tsx`
  can read real payment-method labels from, rather than each file keeping
  its own copy of the method-label dictionary.

### Phase 4C findings (before any changes)
Read this file first, then mapped the three named surfaces to actual code:
- **No standalone Tenant Detail route exists** - confirmed via grep of
  `src/app/routes.ts` (only `/tenants` and `/leases`, no `/tenants/:id`).
  "Tenant Detail" is a slide-out `Sheet` opened from the Tenants table, with
  six existing tabs: Profile, Payers, Deposit, Notices, History, Portal.
  The brief's named list is Overview/Lease/Financial/Payments/Maintenance/
  Documents/Activity (7). Relabelled rather than rebuilt where the mapping
  was direct: Profile -> Overview, Deposit -> Financial (kept
  `DepositAccountabilityStatement`'s real content), History -> Activity
  (kept the same tenant_history timeline). **Lease, Payments, Maintenance,
  and Documents did not exist as tabs at all** - genuine gaps, not
  relabelling opportunities. Kept Payers/Notices/Portal as extra tabs after
  the brief's 7, same "preserve real, working, non-conflicting extras"
  approach used for Property Detail in Phase 4B.
- The **Tenants** table (`src/features/tenants/pages/Tenants.tsx`, also
  pre-existing `@ts-nocheck`) had Status/Tenant/Property+Unit (combined)/
  Rent/Move-in/Contact/Actions - no Lease column, no Balance column, despite
  neither `leases` nor `invoices` being fetched anywhere in this file at
  all (confirmed via grep). Added both, split Property/Unit into separate
  columns to match the brief and the pattern already set for Units/
  Properties in Phase 4B.
- **New real-data tabs built for the Tenant Detail sheet:**
  - Lease (`TenantLeaseTab.tsx`, new) - reads the same `leases` rows
    already fetched for the table's new Lease column, filtered to this
    tenant; no separate query.
  - Payments (`TenantPaymentsTab.tsx`, new) - fetches this tenant's
    `invoices` fresh (invoice number, due date, amount, status).
  - Maintenance (`TenantMaintenanceTab.tsx`, new) - `maintenance_requests`
    has no `tenant_id` column (confirmed against
    `src/integrations/supabase/types.ts`), only `tenant_email` and
    `unit_id` - so this genuinely has to join on `tenant_email`, the same
    real column the table already uses to record requests, not an invented
    relationship.
  - Documents (`TenantDocumentsTab.tsx`, new) - reads the real `contracts`
    table filtered by `tenant_id` (title, status, valid_from/until,
    signature state, download link if `uploaded_contract_url` is set).
    Deliberately did NOT reuse the tenant-portal's existing
    `useTenantContracts` hook / `TenantContractsSection.tsx` component -
    that hook is self-referential to the logged-in tenant (no tenantId
    param), so reusing it from the manager side would have meant changing
    a hook the live self-service tenant portal depends on. Built a
    separate, smaller, manager-scoped query instead - real same table, no
    shared-hook risk.
- **Leases** (`src/features/leases/pages/Leases.tsx`, also pre-existing
  `@ts-nocheck`) already had Status/Tenant/Property+Unit (combined)/Rent/
  Expiry/Action - missing a Start column, and Property/Unit needed
  splitting, same as Tenants and the Units tab.
- **Expiring Soon**: the `leases` table already has a manually-set
  `status = "expiring"` value with an explicit "Mark Expiring" button
  (`Leases.tsx`) - real, but requires a human to remember to click it. A
  lease five days from `end_date` still shows "active" until someone flags
  it. Added a *computed* Expiring Soon indicator instead: `status ===
  "active"` and `end_date` within 30 days of today (the same 30-day window
  `dashboardStats.ts`'s `expiringCutoff` already uses elsewhere in this
  app) - a badge that overrides the plain status badge in both the Leases
  table row, the mobile `LeaseCard.tsx`, the Tenants table's new Lease
  column, and the Tenant Detail sheet's new Lease tab. Real `end_date`
  data only; the 30-day window is the only non-database-literal part, and
  it's borrowed from an existing convention rather than invented fresh.
- **A real lint catch worth recording**: the first draft computed
  "expiring soon" inline during render with `Date.now()` (once directly,
  once inside `useMemo`) - `eslint`'s `react-hooks/purity` rule correctly
  flagged both as impure-during-render, even the `useMemo` version. Fixed
  by moving the date math into the plain data-fetch functions
  (`fetchLeasesAndBalances` in Tenants.tsx, `fetchLeases` in Leases.tsx -
  neither runs during render) and passing the *result* (a `Set` of
  already-expiring lease IDs, or a plain `expiringSoon: boolean` field)
  down as ordinary data. Matches the pattern `dashboardStats.ts` already
  uses for its own `expiringCutoff` - Date math belongs in data-fetch code,
  never in render.

### Phase 4B findings (before any changes)
Read this file first, then mapped the three named surfaces to actual code
before touching anything:
- **Properties** (`src/features/properties/pages/Properties.tsx`, carries
  a pre-existing `@ts-nocheck` from before this redesign effort) already had
  real search, a filters dropdown (sort + occupancy filter), an "Add
  Property" dialog with tier-limit enforcement, edit/deactivate dialogs, and
  pagination - all real, all working. **The one literal gap: it rendered as
  a card grid (`PropertyCard.tsx`), not a table**, despite the brief
  explicitly asking for "table." Converted the list rendering to a table;
  every other control (search/filter/sort/pagination/dialogs) is the exact
  same state and handlers, untouched.
- While touching the file, found two dead imports that predate this session
  - `handleQuickAssignTenant`/`handleUnassignTenant` are fully-written
    functions with no call site anywhere in the render (confirmed via
    grep) - looks like a "quick assign" UI that was never wired up. Left
    both functions in place rather than deleting them (not part of this
    phase's scope, and deleting working-but-orphaned logic felt riskier
    than leaving it for a future pass); flagged here instead.
  - About a dozen icon imports (`MapPin`, `Users`, `User`, `UserPlus`,
    `DollarSign`, `Building`, `Pencil`, `Trash2`, `ChevronDown`, `Phone`,
    `Mail`, `CheckSquare`, `Square`, `X`, `Eye`, `Layers`) and a `Checkbox`
    import were referenced only in the import line, never in the actual
    JSX - true dead imports. Since the import line was being rewritten
    anyway for the table conversion, cleaned these out rather than leaving
    them.
- **Property Detail** (`src/features/properties/pages/PropertyDetail.tsx`)
  already had a rich always-visible summary block above the tabs (photo,
  name, address, category/amenity badges, a 4-up stat grid, an occupancy
  snapshot card) plus 12 tabs: Houses(units)/Tenants/Leases/Billing as a
  "golden path" row, then Agreements/Maintenance/Vacation/Water/Statement/
  Landlord/Settings/History as a second row. The brief's named list is
  overview/units/tenants/leases/billing/maintenance/documents (7). Treated
  the existing always-visible summary block as satisfying "overview" -
  it's already the equivalent, and demoting it into a click-to-view tab
  would hide key numbers behind a click, a worse outcome than the brief
  likely intends - added an explicit "Overview" section-title above it so
  it reads as a named section rather than an unlabelled header. Renamed the
  "Agreements" tab's visible label to "Documents" (its actual function -
  create/sign/preview/download contract PDFs - matches "documents" well)
  while deliberately keeping the tab's `value="agreements"` unchanged,
  since nothing deep-links to it and there was no reason to touch the URL
  contract. Left "Houses" as the Units tab's visible label rather than
  renaming to "Units" - it's established product terminology used
  throughout this codebase (`house_number`, `house_label_prefix` fields,
  the "Manage Houses" link from Properties) for the same underlying units
  concept the brief calls "units"; the tab's `value` is already literally
  `"units"`. Did not delete or merge Vacation/Water/Statement/Landlord/
  Settings/History - all real, working, currently-used functionality with
  no equivalent in the brief's 7-item list, so removing any would violate
  "preserve all current functionality."
- Replaced five emoji-prefixed amenity badges (­¤øĪ Gated, ­¤øŚ Lift, ŌÜĪ
  Generator, ­¤Æ¦ Borehole, ­¤¬æ Furnished) with lucide icons (ShieldCheck/
  MoveVertical/Zap/Droplets/Sofa) - emojis in production chrome read as
  inconsistent with the master brief's "premium typography... no
  unnecessary decoration" standard the rest of this redesign has followed.
  Also swapped several ad hoc `text-xl`/`text-lg`/`text-2xl font-bold`
  headings and stat values in the overview block for the established
  `.section-title`/`.card-title-exec`/`.type-subtitle`/`.metric-value`
  classes from Phase 1, for consistency with every other redesigned page.
- **Units** - there is no standalone `/units` route anywhere in
  `src/app/routes.ts`; confirmed via grep that `UnitManagement.tsx` (the
  component rendered in Property Detail's Units tab) takes a required
  `propertyId` prop and is the only place unit tables render. So "Units" as
  a named surface, per this app's actual architecture, is this
  per-property tab - not a separate global page. The brief's column list
  (unit/property/tenant/status/rent/lease/balance) mostly already existed
  (unit number, tenant, status, rent), but **Lease and Balance were
  missing**, and a redundant "Property" column would repeat the same value
  on every row (the page header already shows which property you're in) -
  omitted deliberately rather than added for literal compliance. Added
  real Lease (status + end date, from the `leases` table already fetched
  by the parent) and Balance (sum of each tenant's `pending`/`overdue`
  invoices, a new but minimal query added to `PropertyDetail.tsx`'s
  existing fetch, following the exact same real-data pattern
  `ArrearsHeatMap.tsx` already uses for the dashboard) columns. Moved the
  old "Next action" nudge button (Assign tenant / Create lease / Invoice -
  collect) from its own column into the row's existing actions dropdown as
  its first item, so the column count stays at 7 instead of 8 while
  keeping that real, working nudge functionality intact.

### Phase 4A findings (before any changes)
Read this file first, then audited `src/features/dashboard/pages/Dashboard.tsx`
and every component/hook it touches before changing anything:
- The dashboard already had strong real-data plumbing: `dashboardStats.ts`
  computes `totalProperties`, `totalUnits`, `occupiedUnits`, `vacantUnits`,
  `occupancyRate`, `collectedRent`, `revenueChange`, `openMaintenanceCount`,
  `urgentMaintenanceCount`, `overdueInvoices`, `arrearsTotal`,
  `expiringLeases`, `pendingDepositRefundsCount` - every number this phase's
  brief needed already existed, live, from Supabase. Nothing fabricated.
- `attentionItems.ts` already built exactly the "actual overdue payments /
  maintenance requiring attention / expiring leases" list the brief asked
  for (plus deposit refunds and vacant units as bonus real signals) - this
  section needed no functional changes, only a small heading tweak
  ("Needs your attention" -> "Attention", matching the brief's exact label).
- **The KPI row was the wrong four numbers.** The brief specifies
  Properties / Units / Occupancy / Collections; the live dashboard showed
  Occupancy / Collected this month / Collection rate / Open maintenance -
  no raw Properties count or Units count card existed as a KPI, even though
  both numbers were already sitting in `stats.totalProperties` /
  `stats.totalUnits` and were already used in the page subtitle. Rebuilt
  the KPI row to the brief's exact four cards using `StatCard` (existing
  component, unchanged) - no new data source needed.
- **No "Recent activity" section existed at all** - `RecentActivity.tsx`
  (a fully-built component reading live `tenant_history` rows via Supabase,
  with realtime subscription) existed in the codebase but was never
  imported or rendered anywhere - confirmed via a repo-wide grep. This was
  the biggest literal gap against the brief's five-level hierarchy (Activity
  was simply missing). Wired it in as the last section, lazy-loaded and
  code-split like the other charts (own ~6.5KB chunk, not bundled into the
  main Dashboard chunk).
- A second, unused, more complex `ManagerActivityLog.tsx` also exists
  (search/filter, full activity log, `@ts-nocheck`) - left untouched. It
  looks built for a dedicated full-log page/route rather than a compact
  dashboard widget, and standing up that route is out of scope for this
  phase - flagged as a possible future page if James wants a "view all
  activity" destination.
- The old page had six-plus stacked sections (Attention, Portfolio+KPI+
  occupancy chart combined, Collections trend, Outstanding balances, 
  Maintenance, "What to do next" with a setup-progress card AND a 6-tile
  generic shortcuts grid) - more sections/cards than the brief's five-level
  hierarchy implies, and the brief explicitly says "do not create excessive
  cards".

### Changes made
- KPI row rebuilt to Properties (count, new) / Units (count, new,
  occupied-vs-vacant as the sub-line) / Occupancy (%, unchanged) /
  Collections (amount, unchanged) - dropped "Collection rate" as a
  standalone KPI since it isn't in the brief's four; the same underlying
  number is still visible in the Collections chart section immediately
  below.
- Split the old combined "Portfolio" section into two named blocks matching
  the brief's "Main" list literally: **Occupancy** (just the occupancy
  chart, its own heading) and **Collections** (the revenue/collections
  trend chart plus the arrears/outstanding-balances heat map, side by side
  under one heading instead of two separate full-width sections) - this is
  the specific move that reduces total section count without dropping any
  real functionality; the outstanding-balances heat map still renders, just
  grouped with Collections instead of standing alone.
- Added the missing **Recent activity** section (see above) as the fifth
  and final block, matching the brief's hierarchy exactly:
  Attention -> Portfolio (KPI) -> Occupancy -> Collections -> Maintenance
  -> Recent activity.
- Added a real **"Add property"** action in the page header (next to the
  existing refresh/currency controls) that navigates to `/properties` -
  the same place the app's own onboarding flow (`ManagerActivationEmpty`)
  already sends a manager to add their first property. Did not build a new
  dialog or query-param auto-open, since the existing "Add Property" form
  lives entirely inside `Properties.tsx` as local component state - wiring
  a cross-page auto-open would have meant touching that page's internals,
  which felt like scope creep for a dashboard-only phase. `/properties`
  already has its own "Add Property" button front and center.
- **Removed the always-visible "What to do next" generic shortcuts grid**
  (Properties/Tenants/Leases/Invoices/Payments/Receipts tiles) - this
  duplicated the sidebar navigation added in Phase 2 and was the clearest
  case of "excessive cards" on the page. Kept the **setup-progress card**
  from the same component (`ManagerQuickActions` with
  `includeShortcuts={false}`), but now it only renders while
  `!progress.isComplete` - a fully onboarded manager (the common case)
  never sees it again, while a manager mid-setup still gets the guided
  steps, which is real functionality worth keeping.
- Maintenance section unchanged (`OpenMaintenancePreview`, already real
  data, already the right shape for "Operations").

### Phase 3 findings (before any changes)
Audited the live homepage (`PublicLandingPage.tsx`, `PublicHeader.tsx`,
`PublicFooter.tsx`, `ProductPreview.tsx`, `PublicPricing.tsx`,
`publicConfig.ts`) and every public route in `src/app/routes.ts` before
touching anything:
- The homepage was already fairly compact (no long marketing scroll) - one
  real structural gap against this specific brief, not a rebuild-everything
  situation.
- **The header was navy (`bg-navy-primary`), white text on dark chrome** -
  the brief for this phase explicitly says "White. 68px approximately.
  Subtle border." The CSS itself even had a comment codifying the navy
  header as deliberate ("Navy is header/footer chrome only") and there was
  a passing unit test asserting `header.className` matches `/navy-primary/`
  - so this was a previously-intentional decision from an earlier Cursor
  phase, now superseded by James's explicit instruction this round. Fixed:
  header is now `bg-card` (white) at `h-[68px]`, subtle `border-border`
  bottom border, navy logo (dropped the `inverse` BrandMark prop), and nav/
  button colours switched from white-on-navy variants to the standard
  light-surface tokens.
- The footer was already Deep Navy with the CALQULUS wordmark, Platform/
  Solutions/Company/Legal link columns, and a short East Africa statement -
  matches the brief closely already. Only change: swapped the "About"
  footer link (pointed at a now-removed `#about` anchor) for "How it works",
  since the brief's footer list is Platform/Solutions/How it works/Contact/
  Privacy/Terms and there's no dedicated About section in the new layout.
- The hero already had the right headline ("Run your properties with
  clarity and control."), eyebrow, and both CTA buttons ("Start managing" /
  "Explore the platform") - only the supporting copy and the right-side
  preview needed work.
- `ProductPreview.tsx` was a static illustration but only showed a queue
  list + a 2x2 metric grid - missing the sidebar, a chart, and distinct
  "maintenance activity" vs "property information" panels the brief calls
  for. Rebuilt it to include a thin icon sidebar rail, a 4-up KPI row, a
  CSS bar chart for "Collections, last 7 weeks", a maintenance-activity
  list, and a small property-info card - still clearly labelled "Preview"
  and captioned as illustrative, not live data.
- The "connected workflow" chain was missing "Unit" (`Property -> Tenant ->
  Lease -> ...` instead of `Property -> Unit -> Tenant -> Lease -> ...`) -
  added.
- There was no "Three Pillars" section and no distinct "Portals" card grid
  - the four portal roles were rendered as plain list rows, and pillars
  didn't exist as their own section (the "how it works" chain stood in for
  both). Added a compact 3-up Pillars grid (Property / Finance / Operations)
  and rebuilt the roles list as a 4-up card grid with an icon, one-sentence
  description, and portal link per card, using each portal's real accent
  hex from `CALQULUS_PORTAL_ACCENT` as a restrained icon tint (not a full
  card background) - consistent with the tokens' own "thin chrome only,
  not a second design system" rule.
- There was no distinct Final CTA band - the old page merged a contact form
  and a pricing teaser card into one "contact" section. Replaced that with
  a navy Final CTA band ("Bring your property operations together." + Get
  started + Contact us) per the brief, and **removed the multi-field
  contact form** (name/email/message inputs) since it isn't part of this
  brief's section list and conflicts with "compact" - the contact channel
  itself is preserved via a direct `mailto:` link on "Contact us" and in
  the footer, so no functionality is actually lost, just the large inline
  form.

### Deliberately not changed
- Pricing page (`/pricing`, rendered by the same `PublicLandingPage`
  component's `PricingView`) - untouched, out of scope for this phase.
- `PublicPricing.tsx` - untouched.
- Portal login/signup routes, `publicConfig.ts` route values - untouched
  except reordering `PUBLIC_NAV` to Platform/Solutions/How it works (brief's
  literal order) and updating the two footer-link tweaks noted above.
- `e2e/homepage-executive.spec.ts` already existed with the brief's exact
  responsive breakpoint list (1440/1280/1024/768/480/390/360) baked in from
  an earlier phase - left the viewport-overflow assertions as-is, only fixed
  one now-stale assertion (`/view plans/i` link, which no longer exists
  since the contact-form/pricing-teaser section was replaced) to check the
  header's Pricing nav link instead.

### Phase 2 audit findings (before any changes)
Read this file first, then mapped which shell each portal actually uses before
touching anything - the portals do NOT share one shell component the way the
brief's phrasing implies:
- **Manager**: `Layout.tsx` + `Sidebar.tsx` + `Header.tsx` - the only portal
  using the shared `<Sidebar>`/`<Layout>` components. Confirmed via grep that
  no other portal renders `<Sidebar>` or imports `Layout.tsx`.
- **Agency**: its own separate `AgencyLayout.tsx` (not the shared Sidebar) -
  has 9+ routed pages so it genuinely needs a sidebar, just a parallel
  implementation of one rather than a shared one.
- **Landlord**: no sidebar - `/landlord/dashboard` is its only route
  (everything else redirects to it), so a single scrolling dashboard with an
  inline header is correct by design, not a gap.
- **Platform Admin / Webhost**: same as Landlord - `/webhost` is the only
  route, inline header, no sidebar needed.
- **Tenant**: `MobileBottomNav.tsx` (mobile bottom tabs) + its own inline
  top header in `TenantPortal.tsx` - correct per the brief's "Tenant must be
  SIMPLE, mobile-first" instruction.

**The one substantial, brief-explicit gap: the Manager sidebar was navy
(`#0D2744`), not white.** The brief says "white sidebar... NO black sidebar"
(and the original master brief said the same thing before Phase 1 even
started) - this had not actually been implemented despite several earlier
"Design Bible" phases claiming to lock down chrome. Also found: every
portal's active-nav-item styling was hardcoded to the interactive blue
(`text-primary`/`text-teal`, where `--teal` itself resolves to blue), not the
portal's own accent - technically invisible for Manager (blue is Manager's own
accent) but visibly wrong for Agency (was blue, should be amber) and Tenant
(was blue via a `teal` alias, should be violet).

### What changed
1. **`src/index.css`** - redefined `--sidebar-background/foreground/accent/
   accent-foreground/border/muted` from the navy palette to light values
   (white background, dark text, `#E5EAF0` border - the same values the main
   `--card`/`--border`/`--muted-foreground` tokens already use). Changed in
   both the `:root` block and its `.dark` mirror, consistent with the
   "dark mode is a dormant light-mirror" decision from Phase 1. This alone
   fixes the sidebar's background/text/hover colours everywhere they're
   consumed (`Sidebar.tsx`, `WorkspaceSwitcher.tsx`) with no component code
   changes needed, since both already used semantic `sidebar-*` classes
   rather than hardcoded colours.
2. **`src/shared/components/layout/Sidebar.tsx`** - removed `inverse` from
   the two `BrandMark` calls (was rendering a white wordmark for a dark
   sidebar; now renders the normal navy wordmark on the new white sidebar,
   per "navy logo"). Replaced the two hardcoded `bg-primary/10 text-primary
   border-primary` active-nav-item treatments (favourites + regular items)
   with `bg-[var(--portal-accent-muted)] text-[var(--portal-accent)]
   border-[var(--portal-accent)]`, so the active state now genuinely reflects
   whichever portal is rendering the sidebar rather than always blue.
3. **`src/features/agency/components/AgencyLayout.tsx`** - same fix: hardcoded
   `bg-primary/10 border-primary/20 text-primary` active state and the
   hardcoded `bg-navy-primary` user-avatar circle both now use
   `var(--portal-accent)`, so Agency's own amber accent shows up correctly
   instead of blue/navy.
4. **`src/features/tenant-portal/components/MobileBottomNav.tsx`** -
   `text-teal` (resolves to interactive blue via the legacy alias) replaced
   with `text-[var(--portal-accent)]` so the active tab shows tenant violet.
5. **`src/shared/components/branding/PortalPreviewCanvas.tsx`** - this is the
   illustrative "structural portal mock" used in the homepage's product
   preview and the design-preview page's per-portal tabs. It hardcoded a
   `bg-navy-primary` rail with an inverse (white) logo - now inconsistent
   with the real sidebar. Updated to a white rail (`bg-sidebar border-r
   border-sidebar-border`) with a normal navy logo and a portal-accent icon,
   plus updated its doc comment and on-screen description text
   ("navy rail" ŌåÆ "white rail") so the illustration matches reality.
6. **Header height**: `Header.tsx` and `AgencyLayout.tsx`'s inline header
   were both `h-14` (56px), under the brief's 64-72px application-header
   spec. Bumped both to `h-16` (64px) - confirmed no other file has a
   hardcoded offset depending on the old height (headers are `sticky top-0`
   with content flowing normally below, no manual padding compensation
   anywhere).

**Not changed, and why:** `Sidebar.tsx` still contains `webhostNavGroups`/
`agencyNavGroups`/`landlordNavGroups`/`tenantNavGroups` and the `isWebhost`/
`isAgency`/`isLandlord`/`isTenant` branching that selects between them, even
though the audit above suggests these are unreachable in practice (nothing
renders `<Sidebar>` except Manager pages). Left alone rather than deleted:
removing them wasn't necessary to satisfy this phase's visual requirements,
and I did not want to risk deleting something a future auth/role change might
actually need without a more thorough reachability check than time allowed
this session. Flagging as a candidate for a future dead-code pass, not doing
it now.

Breadcrumbs, notifications, and a user/profile menu already existed and
already looked correct (`BreadcrumbSystem`, `NotificationsDropdown`,
`ProfileMenu` inside `Header.tsx`) - no changes made there. Landlord's and
Webhost's inline headers were already white/light with `PortalAccentBar` and
`BrandMark` - reviewed, found consistent with the new shell language already,
no changes needed.

No authorization code touched. No routes added, removed, or restructured.

### Phase 1 audit findings (before any changes)
Read `AGENTS.md` (no `CLAUDE.md` exists in the repo - AGENTS.md is the closest
match to "CLAUDE master instructions") and this file, then inspected
`src/index.css`, `src/shared/theme/tokens.ts`, and the shared `ui/` components
before touching anything, per the brief's "inspect before redesign" instruction.

**The foundation was already substantially built** (Tailwind v4 CSS-first
config, no `tailwind.config.ts`). Specifically already solid, no changes made:
- Full semantic colour system in `src/index.css` `@theme`/`:root` - primary,
  secondary, success/warning/destructive/info with `-bg` tints via
  `color-mix()`, portal accents per `[data-portal]`, legacy purple/indigo/teal/
  gold aliases deliberately resolved to navy/blue so they can't reintroduce a
  second palette. Mirrored 1:1 in `src/shared/theme/tokens.ts`
  (`CALQULUS_COLOR`) as the TypeScript source of truth.
- Spacing (`CALQULUS_SPACE`), radius (`CALQULUS_RADIUS`, `--radius: 0.75rem`),
  shadows (`CALQULUS_SHADOW` - card/elevated, tinted navy not black, no
  decorative glow), a global `*:focus-visible` ring, and an icon size scale
  (`CALQULUS_ICON` xs/sm/md/lg) already existed and are used consistently in
  `button.tsx`/`badge.tsx`/`input.tsx`.
- `button.tsx`: full variant hierarchy (default/destructive/outline/secondary/
  ghost/link) x size hierarchy (sm/default/lg/icon) x state (loading via
  `aria-busy`, disabled), all through one `cva()` definition.
- `badge.tsx`: default/secondary/outline/destructive + full semantic set
  (success/warning/danger/info) + legacy aliases resolved to navy/primary.
- `alert.tsx`: default/destructive/success/warning/info - already existed,
  wasn't in the design-preview page yet.
- `card.tsx`, `table.tsx`, `dialog.tsx`: consistent with the token system,
  no changes needed.
- A `/design-preview` route **already existed**
  (`src/features/design-preview/pages/DesignPreview.tsx`) - more ambitious
  than the brief asked for, since it previews full page hierarchies per portal
  (homepage/manager/landlord/agency/tenant/platform_admin/login/properties/
  tenants/billing/payments/maintenance/reports), not just isolated components.

**Two real gaps found and fixed this session:**
1. **Typography scale was measurably smaller than the brief's spec.**
   `.type-page-title` was 28px mobile / 32px desktop against a spec of
   36-44px; `.type-section-title` was 22px against 26-32px; `.type-card-title`
   was 17px against 20-24px. Bumped all three to the low end of each range
   (36px/40px responsive, 26px, 20px) in `src/index.css` - deliberately the
   floor of each range rather than the ceiling, since this is a data-dense
   operational product, not a marketing site, and a smaller bump is lower-risk
   for existing tight layouts. Added a new `.type-subtitle` (17px, H4's
   16-18px range) using the exact value `.type-card-title` vacated, and
   exposed it as `CALQULUS_TYPE.subTitle` in `tokens.ts` - no H4-equivalent
   existed before.
2. **Design preview page was missing several items the brief explicitly asked
   for as isolated component swatches**: buttons, badges, alerts, tabs,
   success. (It had tables/forms/dialogs/loading/empty/error already, just
   folded into fuller page-hierarchy mockups rather than standalone swatches.)
   Added five new tabs to the existing preview page rather than building a
   second route: Buttons (all variant x size x state combinations), Badges
   (all 9 variants), Alerts (info/success/warning/destructive using the
   existing `alert.tsx`), Tabs (a 3-tab example using the existing
   `tabs.tsx`), and Success (a success alert + success badges + a "saved"
   button state, since no dedicated `SuccessState` component exists
   alongside `EmptyState`/`ErrorState` - a success alert/badge is the honest
   equivalent rather than inventing a new component for a one-off).

No business logic, backend, or routing architecture touched. No individual
page redesigned - only shared tokens/components and the preview route.

**Done this session (10 of 86 files, now permanently clean, no longer in the
exemptions list):**
`src/features/billing/pages/Billing.tsx`, `.../components/BillingStatsBar.tsx`,
`.../components/InvoiceTable.tsx`, `.../components/MpesaPaymentDialog.tsx`,
`.../hooks/useBillingData.ts`, `.../lib/receiptPdfExport.ts`,
`src/integrations/supabase/client.ts`, `src/shared/hooks/useKeyboardShortcuts.ts`,
`src/shared/lib/errorLogger.ts`, `src/shared/lib/observability.ts`.

Real bugs found and fixed along the way (not just type-satisfying noise):
- **`MpesaPaymentDialog.tsx`**: `setCheckoutRequestId(data.checkoutRequestId)` was
  calling a setter for a state variable that was never declared ŌĆö dead code left
  over from a refactor (the real value flows straight into
  `pollPaymentStatus(data.checkoutRequestId)` on the next line, so nothing was
  actually broken, but this doesn't type-check and never worked).
- **`BillingStatsBar.tsx` / `InvoiceTable.tsx`**: both referenced
  `invoice.paid_amount` / `invoice.balance_due` and an `invoice_status` value of
  `"partially_paid"` ŌĆö none of which exist in the live schema (`invoices` has no
  such columns, and the `invoice_status` enum is only
  `paid | pending | overdue | cancelled`). These branches were always silently
  falling back to the full invoice amount. Simplified to match what the schema
  actually supports rather than inventing a migration to match the aspirational
  UI code (brief says don't fabricate backend data/endpoints).
- **`useBillingData.ts`**: `BillingLease` claimed to extend the full `LeaseRow`
  but `fetchLeases()` only selects 7 columns ŌĆö narrowed the type to match the
  real projection. Also normalized the `tenants` embed, which Supabase's
  generated types infer as an array even though `leases.tenant_id` is a forward
  FK that PostgREST actually returns as a single object at runtime.
- **`src/integrations/supabase/client.ts`**: the offline/unconfigured-Supabase
  `NoopBuilder` fallback had a typing-order bug (chain methods were attached
  after the object was already cast to its final type) and a spurious `.catch()`
  that real Supabase query builders don't have either ŌĆö removed it for
  consistency rather than papering over the mismatch.
- Added `getAutoTableFinalY()` to `src/shared/lib/pdf/companyPdfHeader.ts` ŌĆö a
  properly-typed helper for reading jspdf-autotable's runtime-injected
  `lastAutoTable` property, replacing one `as any` (in
  `propertyStatementPdfExport.ts`, also in the exemption list but not otherwise
  touched this session) and one broken direct cast (`receiptPdfExport.ts`) with
  a single reusable, honestly-typed function.
- `NodeJS.Timeout` (browser code doesn't have the Node globals) replaced with
  `ReturnType<typeof setTimeout>` / `ReturnType<typeof setInterval>` in
  `useKeyboardShortcuts.ts` and `observability.ts`.
- `errorLogger.ts` and `Billing.tsx` were calling `.catch()` on Supabase
  PromiseLike results, which don't have `.catch()` (only real Promises do) ŌĆö
  fixed via two-arg `.then(ok, err)` for the simple cases and an async/await +
  try/catch rewrite for the one nested case in `Billing.tsx`.

**NOT done ŌĆö 76 files still have `@ts-nocheck` and real errors underneath.**
Re-added the marker to all 76 rather than leave them broken; the exemptions file
now lists exactly these 76 (down from 86). Full remaining error count, captured
this session by temporarily stripping `@ts-nocheck` from all 76 at once and
running `tsc --noEmit`: **562 errors**, breakdown by TS code:
- TS2339 (property doesn't exist) ŌĆö 101
- TS2304 (cannot find name) ŌĆö 53
- TS2322 (type not assignable) ŌĆö 52
- TS18046 (`unknown` used without narrowing) ŌĆö 38
- TS2345 (argument type mismatch) ŌĆö 28
- TS2561/TS2551 (property doesn't exist, did-you-mean suggestions) ŌĆö 36 combined
- TS2353 (unknown object property) ŌĆö 17
- TS18047/TS18048/TS18049 (possibly null/undefined) ŌĆö 23 combined
- remainder (TS7006, TS2769, TS2459, TS2352, TS1345, TS2719, TS2552, TS2344,
  TS2774) ŌĆö ~18 combined

This has NOT been triaged file-by-file the way the billing batch was ŌĆö this is
raw `tsc` output, not yet reviewed for real-bug-vs-noise the way the 10 finished
files were. That review is the next step.

## COMPLETED TASKS (reconstructed from git log, newest first)
- (this session, not yet committed at write-time - see CURRENT PHASE) Phase 4B
  Property Operations: Properties converted from a card grid to a table
  (PropertyCard.tsx removed, replaced by PropertyTableRow.tsx), Property
  Detail overview polished (icons instead of emoji badges, Phase 1
  typography tokens, "Agreements" relabelled "Documents"), Units tab gained
  real Lease and Balance columns.
- `45e41d7` calqulus/redesign-phase-4a-manager-dashboard
- `48adb0e` calqulus/redesign-phase-3-executive-homepage
- `2ea4dc6` calqulus/redesign-phase-2-application-shell
- `2455697` calqulus/redesign-phase-1-design-system-foundation
- `6ff14e2` feat(design): apply master colour foundation without rewriting desks
- `68f372f` feat(design): make the public site feel like an operating system
- `458e2ea` fix(design): prefer hierarchy over extra chrome
- `78a0bd8` feat(design): apply Design Bible desk chrome without changing operations
- `f3e7598` fix(design): map leftover palettes to tokens and close Design Bible gaps
- `cf546a2` feat(design): lock portal accents and design-preview to the Design Bible
- `30cf00a` feat(brand): add BrandConfig layer instead of CSS overrides
- `6a6287a` feat(core): add product, design, and brand systems with a white-label engine
- `20e0f0f` feat(theme): lift chrome from near-black to mid navy
- `527aa11` feat(brand): apply navy-cyan identity and compact the homepage
- `6b67ecc` feat(manager-portal): rebuild executive dashboard hierarchy (phase 3)
- `bc99d45` feat(auth): rebuild agency and tenant portals as operational desks
- `68cc979` feat(auth): rebuild the landlord portal as a revenue-only desk
- `6aa9261` feat(auth): rebuild the manager portal as an operational desk
- `905d00e` feat(marketing): rebuild the public homepage as an executive entry point
- Merge `cursor/phase-8-platform-admin-1e5d` ŌĆö platform admin pass
- Merge `cursor/phase-6-portal-excellence-1e5d`
- Merge `cursor/phase-12-certification-1e5d` ŌĆö quality-gate certification pass
- `71343cb` cert: independent 30-gate quality assessment (55/100), followed by fixes
  in `709d19e`
- Round 5ŌĆō9 (separate engagement, this agent): a11y/dead-code cleanup, corrupted
  binary asset restoration, Vercel rewrite fix, npm audit fixes, mislabeled logo fix,
  TenantContracts/TenantContractsSection hook dedupe, orphaned-file cleanup,
  26 unused npm dependencies removed. These predate the redesign brief and are
  orthogonal to it (bug fixes / hygiene, not visual redesign).

## IN PROGRESS
Nothing actively mid-edit as of this entry.

## NEXT TASK (Phase 4B Property Operations - James's most recent instruction)
Phase 4B as scoped is done. Not done, and worth doing before calling it
fully final:
- **Still no literal visual preview generated** - same sandbox limitation
  as every prior phase (no browser/screenshot tool). The Properties table
  in particular (7 columns) has only been checked for horizontal-scroll
  behaviour on narrow viewports by reading the shared `Table` component's
  wrapper (`overflow-auto`), not by actually looking at it on a phone-sized
  screen.
- `handleQuickAssignTenant`/`handleUnassignTenant` in `Properties.tsx` are
  still real, working, but completely unwired functions (no call site) -
  flagged, not resolved. Either wire a genuine "quick assign" action into
  the new table's row actions, or remove them as confirmed-dead code - did
  neither this session since it felt like a scope decision worth asking
  James about rather than guessing.
- `Properties.tsx` still carries `@ts-nocheck` (pre-existing, separate from
  the `@ts-nocheck` remediation task #45's 76-file list - worth confirming
  it's on that list, or adding it if it was somehow missed) - the file was
  extensively edited this session but the exemption was deliberately left
  in place rather than attempting removal mid-phase, to keep this phase's
  diff focused on the redesign brief rather than expanding into type-safety
  remediation at the same time.
- The new Units "Balance" column sums `pending` + `overdue` invoices per
  tenant with a fresh query added to `PropertyDetail.tsx` - this mirrors
  `ArrearsHeatMap.tsx`'s existing real-data pattern but hasn't been checked
  against a live database with actual overdue invoices to confirm the
  number renders and formats correctly end-to-end (only typecheck/lint/
  build-level verification was possible in this sandbox).
- Other portal property surfaces (Agency's `AgencyProperties.tsx`,
  Landlord's read-only property views) were not touched - only the Manager
  Properties/Property Detail/Units surfaces were in scope per the brief's
  title ("MANAGER Property Operations").

## NEXT TASK (Phase 4A Manager Dashboard - James's most recent instruction)
Phase 4A as scoped is done. Not done, and worth doing before calling it fully
final:
- **Still no literal visual preview generated** - same sandbox limitation as
  Phases 2/3 (no browser/screenshot tool). Built directly in place again,
  verified hard via typecheck/lint/tests/build, but James hasn't seen it
  rendered yet.
- `ManagerActivityLog.tsx` (the fuller, filterable activity log with search)
  is still unused - if James wants a dedicated "view all activity" page
  reachable from the new Recent Activity section's header, that's a natural
  follow-up, not done this session (no link/route added, out of scope for a
  dashboard-only phase).
- The Collections section now places `RevenueChart` and `ArrearsHeatMap`
  side by side on desktop (`lg:grid-cols-[1.3fr_1fr]`) - only checked this
  visually in my head from the two components' existing internal card
  styling, not from an actual rendered screenshot. Worth confirming neither
  chart looks cramped at 1024-1280px widths specifically.
- Other portal dashboards (Landlord/Agency/Tenant/Platform Admin) were not
  touched this phase - only the Manager dashboard was in scope. If James
  wants matching KPI-row/hierarchy treatment on those, that's presumably
  Phase 4B/4C/etc., not started.

## NEXT TASK (Phase 3 executive homepage - James's most recent instruction)
Phase 3 as scoped is done. Not done, and worth doing before calling it fully
final:
- **No literal visual preview was generated this session either** - same
  sandbox limitation as Phase 2 (no browser/screenshot tool). Built directly
  in place rather than standing up a separate preview route, since a preview
  route nobody can screenshot doesn't buy much extra safety over careful
  testing - but this means James hasn't actually seen it rendered yet.
  Worth a real look before treating this as final.
- `e2e/homepage-executive.spec.ts` (Playwright) was not actually run this
  session - no browser in this sandbox. It's been kept in sync (one stale
  assertion fixed) but the seven-breakpoint overflow checks it contains have
  not been executed since this change landed.
- The final CTA band's "Contact us" button is a plain `mailto:` link now
  instead of the old inline form - if James wants an actual contact form
  back (rather than opening the visitor's email client), that's a
  reasonably scoped follow-up.
- Icon choices for the four portal cards (Building2/Landmark/Users/User)
  are a judgment call, not from the brief - flag if James wants different
  iconography.
- Footer link groups still use "Company" as a column heading covering
  How it works/Pricing/Contact - the brief lists these as a flat set of
  footer links rather than specifying column headers, so this was kept
  as the lowest-risk interpretation rather than restructured further.

## NEXT TASK (Phase 2 app shell - James's most recent instruction)
Phase 2 as scoped is done. Not done, and worth doing before calling the shell
fully finished:
- **No literal visual preview was generated this session** - I don't have a
  browser/screenshot tool in this sandbox, so "create preview first if the
  shell is substantially different" was satisfied by describing the change
  in detail here rather than an actual rendered mockup. The change itself is
  low structural risk (pure CSS custom property values plus a few
  hardcoded-colour-to-token swaps, no component structure changes), and is
  a single-token revert if James doesn't like it live. Worth James actually
  looking at `/design-preview` (or the real sidebar) before treating this as
  final.
- Untested at the specific breakpoints the brief calls out (1440/1280/1024/
  768/480/390/360) - only confirmed via the existing auth-shell render tests
  and a build/lint/typecheck pass, not actual viewport testing.
- The suspected-dead `webhostNavGroups`/`agencyNavGroups`/`landlordNavGroups`/
  `tenantNavGroups` branches in `Sidebar.tsx` - confirm reachability properly
  and remove if genuinely dead.
- Consider whether Agency's parallel sidebar implementation
  (`AgencyLayout.tsx`) should eventually be merged into the shared
  `Sidebar.tsx`/`Layout.tsx` to stop the duplication - flagged, not done,
  since it's a bigger structural change than this phase asked for.

## NEXT TASK (Phase 1 design system - older, already shipped)
Phase 1 as scoped is done. Natural continuations, not yet started:
- Now that the type scale changed globally, spot-check a few dense screens
  (Properties table, Billing invoice list, Manager dashboard) for any heading
  that now wraps awkwardly or crowds a card - the brief explicitly asked to
  test across 1440/1280/1024/768/480/390/360, which hasn't been done for this
  specific change.
- Consider whether `DialogTitle` (currently hardcoded `text-lg font-semibold`
  in `dialog.tsx`) should adopt `CALQULUS_TYPE.subTitle` instead, for full
  consistency - left alone this session since it wasn't broken, just slightly
  off-pattern.
- James may want the `/design-preview` page's new tabs cross-linked from
  `docs/audits/` or `AGENTS.md` so future contributors know it's the reference.

## NEXT TASK (older, paused - resume when asked)
Continue `@ts-nocheck` remediation: pick up the remaining 76 files listed in
`docs/audits/TYPECHECK_EXEMPTIONS.txt`. Suggested approach (same one used this
session, it works and stays within sandbox time limits): strip `@ts-nocheck` from
a batch of files via a scoped `tsconfig` that extends `tsconfig.app.json` with a
narrower `include` (must also include `src/vite-env.d.ts` or you'll get false
`ImportMeta.env`/module-not-found noise), run `tsc --noEmit -p` against it,
triage real-bug-vs-noise, fix properly, re-run to confirm zero errors, THEN
remove those files from the exemptions list. Do not remove `@ts-nocheck` from a
batch without either finishing it in the same session or restoring the marker ŌĆö
leaving files mid-fix with no `@ts-nocheck` and real errors regresses CI.
Good next batches to try (grouped by shared root-cause potential):
- `src/features/contracts/**` (5 files) + `src/features/payments/**` (6 files,
  1 already done) ŌĆö likely share the same PostgREST forward-FK array-vs-object
  pattern fixed in billing this session.
- `src/features/webhost/**` (15 files) ŌĆö the largest single cluster, all
  platform-admin surfaces.
- `src/features/tenant-portal/**` + `src/features/tenants/**` (11 files combined).

Once `@ts-nocheck` remediation is fully done (or paused again), the other
candidates James didn't pick this round are still open: line-by-line portal
verification against the brief's exact section hierarchy, responsive QA across
the seven required breakpoints, accessibility pass on the redesigned surfaces
specifically, and the white-label config UI (engine exists, no settings screen).

## FILES CHANGED
See `git log --stat` for exhaustive detail. High-level areas touched by the redesign
effort so far: `src/index.css` (design tokens), `tailwind.config.ts`, `src/core/brand/*`,
`src/core/design/*`, `src/core/whiteLabel/*`, `src/shared/components/branding/*`,
`src/features/marketing/*` (homepage), `src/features/dashboard/*` (manager),
`src/features/landlord/*`, `src/features/agency/*`, `src/features/tenant-portal/*`,
`src/features/webhost/*` (platform admin).

Phase 3 session, specifically: `src/features/marketing/PublicLandingPage.tsx`
(full rewrite of `HomeView` - pillars, portal cards, final CTA, contact-form
removal), `src/features/marketing/components/PublicHeader.tsx` (navy -> white),
`src/features/marketing/components/ProductPreview.tsx` (full rewrite - sidebar,
KPI row, chart, maintenance activity, property card), `src/features/marketing/
publicConfig.ts` (nav order, footer "About" -> "How it works"), `src/index.css`
(one comment fix, no token changes), `src/test/publicLanding.test.tsx` (rewritten
to match the new structure), `src/test/publicConfig.test.ts` (nav order),
`e2e/homepage-executive.spec.ts` (one stale assertion fixed).

Phase 4A session: `src/features/dashboard/pages/Dashboard.tsx` (KPI row
rebuilt, Occupancy/Collections split into named sections, Recent Activity
wired in, Add Property header action, shortcuts grid removed / setup nudge
made conditional). No other file touched - `dashboardStats.ts`,
`attentionItems.ts`, `StatCard.tsx`, `RecentActivity.tsx`,
`ManagerQuickActions.tsx`, `OccupancyChart.tsx`, `RevenueChart.tsx`,
`ArrearsHeatMap.tsx`, `OpenMaintenancePreview.tsx` were all read/audited but
used exactly as they already existed, unmodified.

Phase 4B session: `src/features/properties/pages/Properties.tsx` (card grid
-> table, dead imports removed, `PropertyCard` import swapped for
`PropertyTableRow`), `src/features/properties/components/PropertyCard.tsx`
(deleted - fully replaced, confirmed zero remaining references first),
`src/features/properties/components/PropertyTableRow.tsx` (new file),
`src/features/properties/pages/PropertyDetail.tsx` (Overview label added,
emoji badges -> icons, typography tokens applied, "Agreements" tab
relabelled "Documents", tenant-balance query added, `occupants` extended
with `leaseEndDate`/`balance`), `src/features/units/components/
UnitManagement.tsx` (Lease + Balance columns added, "Next" nudge moved into
the actions dropdown, colSpan updated 6->7 across five expanded-row cells).

## ROUTES CHANGED
Not enumerated this session ŌĆö no route-level regressions found in the build, but no
explicit route diff against pre-redesign `main` was run either.

## COMPONENTS CREATED
`src/core/brand/BrandConfig.ts`, `mergeBrandConfig.ts`, `platformBrand.ts`,
`composeBrandConfig.ts`; `src/core/design/deriveBrandPalette.ts`;
`src/core/whiteLabel/applyBrand.ts`, `WhiteLabelProvider.tsx`;
`src/shared/components/branding/BrandMark.tsx`, `MultiBrandStudio.tsx`,
`BrandAssetManager.tsx`.

## COMPONENTS MODIFIED
Effectively every portal dashboard and the homepage, per the commit list above.
Exhaustive list not reconstructed ŌĆö refer to git history per-commit.

Phase 3 session: `PublicLandingPage.tsx`, `PublicHeader.tsx`, `ProductPreview.tsx`,
`publicConfig.ts` (see FILES CHANGED above for detail). `PublicFooter.tsx` and
`PublicPricing.tsx` were audited but not modified.

Phase 4A session: `Dashboard.tsx` only (see FILES CHANGED above for detail).

Phase 4B session: `Properties.tsx`, `PropertyDetail.tsx`,
`UnitManagement.tsx` (see FILES CHANGED above). `PropertyTableRow.tsx`
created; `PropertyCard.tsx` removed.

## KNOWN ISSUES
1. **86 files under `@ts-nocheck`** (see `docs/audits/TYPECHECK_EXEMPTIONS.txt`).
   This is the single largest piece of tracked debt right now. Documented, not
   hidden, but violates the brief's own code-quality rule.
2. **This state file didn't exist until now** ŌĆö any prior agent (Cursor) session
   notes, rationale, or "why this approach" context for specific redesign
   decisions is not recoverable beyond what commit messages say.
3. Full `npm run test` (vitest) suite is large enough that it doesn't finish
   inside this sandbox's ~170s per-command cap. Spot-checked: 300+ tests observed
   passing across two separate capped runs, zero `FAIL` markers seen, including
   `designTokens.test.ts` (15/15) and `publicLanding.test.tsx` (8/8, validates the
   new executive homepage). Full-suite green status not independently confirmed
   end-to-end this session.
4. Certification history shows a documented low score at one point
   (`71343cb` "independent 30-gate quality assessment (55/100)") followed by a
   remediation commit (`709d19e`). Current score not re-verified.

## TEST STATUS
Phase 4A session: no Dashboard.tsx-specific test file exists (confirmed via
repo-wide grep), so re-ran every test file that touches the data/logic this
phase depends on - `dashboardStats.test.ts` (7/7), `attentionItems.test.ts`
(4/4), `activationPath.test.ts` (10/10), `commercialMetrics.test.ts` (2/2),
`statCard.test.tsx` (1/1), `activationMetrics.test.ts` (3/3) - 27/27 passing,
confirming none of the underlying stats/attention/activation logic was
disturbed by the page-layout rewrite. Scoped `tsc --noEmit` across
`Dashboard.tsx`, `RecentActivity.tsx`, `StatCard.tsx`,
`ManagerQuickActions.tsx` - zero errors. `eslint` on `Dashboard.tsx` - zero
warnings. `npm run build` - clean; confirmed `RecentActivity` code-splits into
its own ~6.5KB chunk rather than bloating the main Dashboard bundle.

Phase 3 session (still valid): `publicLanding.test.tsx` (10/10),
`publicConfig.test.ts` (4/4), plus `managerAuthShell.test.tsx` (1/1),
`landlordAuthShell.test.tsx` (1/1), `agencyTenantAuthShell.test.tsx` (2/2), and
`designTokens.test.ts` (15/15) as a regression check - all green.

Phase 2 session (still valid): `designTokens.test.ts` (15/15), `deriveBrandPalette.test.ts`
(6/6), `pageHeader.test.tsx` (2/2), `managerAuthShell.test.tsx` (1/1),
`landlordAuthShell.test.tsx` (1/1), `agencyTenantAuthShell.test.tsx` (2/2) - 27/27
passing after the sidebar/header changes.

Full-suite vitest run still not completed end-to-end in one sandbox call (suite
is large); no evidence of breakage in anything run this session or prior.
`npm run test:e2e` (Playwright) still not run this session either - no browser
in this sandbox.

Phase 4B session: no dedicated test files exist for Properties/PropertyDetail/
Units (confirmed via repo-wide grep), so re-ran the shared regression set -
`designTokens.test.ts` (15/15), `managerAuthShell.test.tsx` (1/1),
`dashboardStats.test.ts` (7/7) - all still green. Scoped `tsc --noEmit`
across `PropertyTableRow.tsx` (no `@ts-nocheck`), `PropertyDetail.tsx`, and
`UnitManagement.tsx` (neither carries `@ts-nocheck`) - zero errors, real
type-safety confirmation on all three. `Properties.tsx` itself still carries
its pre-existing `@ts-nocheck` so wasn't type-checked, but `eslint` ran
clean on it regardless. `npm run build` - clean; confirmed both `Properties`
and `PropertyDetail` chunks still build (26.77KB and 199.13KB respectively).
Checked `e2e/mobile.spec.ts`'s `.property-card` / `[data-testid*='property']`
selector - neither existed anywhere in the codebase even before this
session (a pre-existing, likely-already-broken selector, gated behind
`test.skip` without real credentials) - added `data-testid="property-row"`
to the new `PropertyTableRow` so that assertion has something real to find
if the test is ever run with credentials, rather than leaving it dangling.

## BUILD STATUS
Clean. `npm run build` succeeds (Phase 4B session re-verified), PWA service
worker builds.

## DESIGN DECISIONS
(Reconstructed from commit messages, not first-hand)
- Outfit remains the primary font (brief said "Inter unless the project already
  has an equally appropriate font" ŌĆö Cursor kept Outfit, treating it as
  already-appropriate rather than switching to Inter).
- Portal colour is applied as an accent only (brief's "these are accents, not
  separate design systems" rule) ŌĆö enforced via `cf546a2` "lock portal accents
  ... to the Design Bible."
- Chrome was deliberately moved from near-black toward mid-navy across two
  iterations (`20e0f0f`, then `6ff14e2`) rather than landing on the final navy
  value in one pass.

## DEVIATIONS FROM BLUEPRINT
- **Palette ŌĆö RESOLVED, doc is just stale.** Verified `src/index.css` directly:
  the live tokens are exactly the brief's hex values (`--navy-deep: #081A2E`,
  `--navy-primary: #0D2744`, `--navy-mid/--secondary-navy: #173F67`,
  `--primary/--accent/--ring: #2F6FED`, `--background/--muted: #F7F9FC`,
  `--border/--input: #E5EAF0`, `--foreground: #102033`,
  `--muted-foreground: #637286`). Portal accents also match: manager `#2F6FED`
  blue, landlord `#23856B` emerald, agency `#9A5A16` amber, tenant `#5C4A8A`
  violet, platform_admin `#3E4C94` indigo. So `6ff14e2` did land the brief's exact
  palette. The *only* loose end is that `ENTERPRISE_DESIGN_SYSTEM.md` (a repo doc,
  not the brief) still documents the old `#304FFE`/`#546E7A` palette and hasn't
  been updated to match ŌĆö stale documentation, not a code problem. Small fix,
  low priority.
- Font: brief implies Inter as default; repo has standardized on Outfit and self-hosts
  it. Confirmed intentional (`ENTERPRISE_DESIGN_SYSTEM.md` explicitly: "This markdown
  must not specify Inter"), and defensible under the brief's own "unless the project
  already has an equally appropriate established font" carve-out.

---

## Open question for James
Cursor has already run through the homepage, all five portals, platform admin, and
a white-label engine, plus a 30-gate certification pass ŌĆö the palette/typography/
portal-accent foundation is confirmed live and matches your brief exactly. Rather
than risk duplicate or conflicting work by picking a phase at random, tell me where
to focus. Candidates: pay down the `@ts-nocheck` debt (86 files), verify one specific
portal against the brief's exact section hierarchy, run the responsive/a11y QA pass,
update the stale `ENTERPRISE_DESIGN_SYSTEM.md`, or build the white-label config UI
(engine exists, no settings screen for it yet).
