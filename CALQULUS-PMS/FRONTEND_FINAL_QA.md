# CALQULUS PMS — FRONTEND FINAL QA

**Phase 12 — Visual + UX certification (re-certification)**
**Date:** 2026-08-26 (supersedes the 2026-08-25 pass)
**Scope:** Public site (homepage, registration, login, onboarding) + all six portal surfaces (Manager, Landlord, Agency, Tenant, Admin, WebHost). QA only — no new features, no redesign. Two classes of in-phase fixes were applied: compile-gate regressions (typecheck) and off-palette colour leftovers.
**Gates (final):** lint 0 errors / 11 pre-existing warnings · typecheck clean · 1151 unit tests passed / 1 skipped · production build clean (precache 763.11 KiB) · visual verification on 18 screenshots (10 public/auth surfaces + 8 portal views) with 0 px horizontal overflow and 0 page errors.

---

## VERDICT: PASS — the frontend reads as ONE product.

One token system, one typeface, one component library, one layout grammar per portal, six thin identity accents. Nothing template-generated, crypto-like, or consumer-social remains in the audited surfaces.

---

## FAILURES FOUND IN THIS PASS — ALL FIXED IN-PHASE

The 2026-08-25 certification claimed "typecheck clean". It no longer was: **9 TypeScript errors had regressed onto `main`** (silent because Vite build and Vitest do not typecheck — only `npm run typecheck` / CI catch them). All fixed with minimal, behaviour-neutral edits:

1. **Missing `EmptyState` imports** (TS2304 ×4) — `LandlordBilling.tsx`, `ManagerManagement.tsx`, `SystemLandlordManagement.tsx` (webhost). These screens would crash at runtime if their empty branch rendered. Added the standard `@/shared/components/ui/empty-state` import.
2. **`ErrorState` prop mismatch** (TS2322) — `TenantInbox.tsx` passed `description`; the shared component's prop is `message`. Fixed call site.
3. **`window` narrowed to `never`** (TS2339) — `App.tsx` chart-warmup fallback (`"requestIdleCallback" in window` is always true per lib.dom, so the else branch narrowed `window` to `never`). Uses the global `setTimeout` fallback now.
4. **Updater fn passed to a plain-value setter** (TS2345/TS7006) — `AgencyOnboardingPage.tsx` called `setAgencyName((current) => …)` where `useOnboardingDraft` returns `(value: string) => void`. Replaced with an equivalent guarded direct set (`!agencyName` check).
5. **Supabase embed cast** (TS2352) — `AgencyClientDetail.tsx` cast a generated `properties: { name }[]` row to a single-object interface; now casts through `unknown` (the established pattern for embed rows).

**Colour leftovers (same class as the previous phase's chart fix):**

6. **Tenant independent-account stats coloured money green** — `OrphanTenantHome.tsx` rendered "Total recorded" in `text-success`, plus primary-blue and warning-amber counts. Violates the locked rule (money in ink; status colours are for status). All three stats now render `text-foreground`.
7. **Raw slate hex in a mounted chart** — `ExecutiveAnalyticsWorkspace.tsx` (manager Reports → Executive analytics, mounted + feature-gated) drew its dashed "Previous" line in raw `#94a3b8`. Now `CALQULUS_COLOR.textSecondary`, matching the token convention every other chart follows.

---

## PASS

### Colour
- **Single palette authority.** `src/shared/theme/tokens.ts` (TS source of truth) is kept in lockstep with `src/index.css` by `designTokens.test.ts`. Foundation: white/mist desks, deep navy `#173650` + mid navy `#31577E` chrome, interactive blue `#356FE5`.
- **Palette remap is total.** Every raw Tailwind scale resolves to muted CALQULUS families via `@theme`; legacy class names cannot introduce a second palette. Full hex-literal scan of `src` re-run this pass: remaining literals are token definitions, on-palette mist shades in marketing, test fixtures, dead (unmounted) showcase components, or deliberate document-renderer palettes (see warnings).
- **Six portal identities, 2px only.** Manager Blue `#356FE5`, Landlord Emerald `#2F9B74`, Agency Amber `#C08A37`, Tenant Violet `#7C5FD3`, WebHost Teal `#2C9183`, Admin Indigo `#4658C9` — carried by `portalSurfaceProps()` + `PortalAccentBar` in all five layouts, verified in screenshots. Never page fills.
- **Status stays semantic.** Success/warning/danger reserved for status. The one place money was rendered green (OrphanTenantHome) was fixed in this pass.
- Password fields showing "••••••••" on login pages are **placeholder text**, not prefilled values — verified in source.

### Typography
- Outfit everywhere: `h1–h6` forced to Outfit in base CSS; 126 `font-heading` usages; self-hosted woff2 with `font-display: swap`. Shared type scale (`.page-title`, `.section-title`, `.supporting-text`).

### Components
- shadcn/ui primitives are the only component source; zero MUI/AntD/Chakra/react-icons/iconify imports (locked by `componentAuditPhase9.test.ts`). lucide-react is the only icon family (272 imports).
- Radii: one scale (`--radius: 0.75rem`); arbitrary radii confined to marketing showcase cards and a device-frame mock — not product chrome.
- Shared `EmptyState`/`ErrorState`/`LoadingState` used across portals (the missing-import regressions that broke this are fixed, above).

### Navigation & layout
- All five portal layouts (Manager `Layout`, `LandlordLayout`, `AgencyLayout`, `TenantLayout`, `WebhostLayout`) share one grammar: navy chrome, white desk, accent bar, mobile hamburger + overlay (manager) or bottom tab bar (tenant: Home/Bills/Fix/Docs/Me). Verified at 1440px and 390px.
- Role boundaries intact: 97 protected routes, per-role route configs, webhost tenant firewall, landlord revenue-only view. Legacy `AccountantDashboard`/`MaintenanceDashboard`/`SupportDashboard`/`LeasingDashboard` are unrouted dead files.
- `EnterpriseAdminPlatform` (which mounts the hardcoded `DeploymentReleaseManager` fake UI and off-palette `OrgCustomization`) is **not mounted in any route** — dead code, never renders. Confirmed by mount-chain grep.

### Visual hierarchy (verified by screenshot)
- Homepage: one dominant h1 ("Run your properties. Without the chaos."), one primary CTA, approved compact section order, real Kenyan photography. Zero horizontal overflow at 1440/390.
- Login/register (all 5 portals): identical two-panel grammar — branded left panel with capability tiles + sample strip, form card right with role badge, cross-portal links. KES pricing page matches the published catalog (400/600/Custom per property/month).
- Manager desk: one `<h1>` per page via shared `PageHeader`, one primary action per page (Dashboard "Add property"; Properties "Add property" + outline secondary). Empty states guide to first value.
- Landlord/Agency/Tenant/WebHost desks: portal-accent identity visible, question-format headings on landlord/agency, tenant stays a service portal (no charts, dominant PAY RENT on home), webhost is the infrastructure control center with semantic status dots.

### Security surface
- No secrets, tokens, service-role keys, JWTs, or passwords in `src` or the production `dist` bundle (scanned both; the one `service_role` string hit in the Reports chunk is the documented `<SERVICE_ROLE_KEY>` placeholder hint — see warnings).
- Supabase client is env-driven with placeholder detection + noop fallback; `.env*` gitignored, only `.env.example` committed. Ops/log viewers mask secret-shaped keys via `lib/secrets.ts` (locked by tests). No permission changes made.

### Functionality (regression evidence)
- Full unit suite green: 1151 passed / 1 skipped — covers auth flows, tenant + admin invitation flows, per-role onboarding completion, RBAC hooks, portal desks, chart colours, currency/date formatting.
- Production build clean (601 assets, precache 763.11 KiB).
- Visual verification: 18 page captures across public + all six portal surfaces, 0 console page errors, 0 px horizontal overflow at desktop and mobile widths.
- E2E note (unchanged from baseline): the full Playwright suite is environmentally blocked in this sandbox (no bundled browsers); the credential-gated specs skip in CI without secrets. The a11y + responsive certification suites (25 tests) were green at the 2026-08-25 run and their locked contracts were not touched by this pass.

---

## WARNINGS (non-blocking; product decisions needed)

1. **Receipt default brand colour is bright green.** `ReceiptSettings.tsx` seeds `primary_color: "#22c55e"` (off-palette) for generated tenant-facing receipts. Recommend changing the seed to brand navy/blue in a product-approved pass.
2. **Spreadsheet statement palette.** `PropertyCollectionStatement.tsx` intentionally mimics an Excel rent schedule (`#ADD8E6`, `#FFFF99`, `#EBF5FF`). It is a document renderer, not app chrome — left as-is; re-tokenize only if it becomes interactive screen UI.
3. **Amber as decoration on webhost Billing.** `BillingAnalytics.tsx` uses `text-warning` titles on every card regardless of state. Warning colour should mean "warning".
4. **pg_cron setup hint in a manager-facing report.** `RentCollectionSummary.tsx` shows a SQL snippet with `<SERVICE_ROLE_KEY>` placeholders (no real secret) aimed at a Supabase project owner. Operational clutter in the wrong portal — move to platform-admin docs or the webhost surface.
5. **One consumer-style emoji.** M-Pesa success toast contains 🎉. Everything else is enterprise-toned.
6. **11 pre-existing ESLint warnings** (0 errors) — exhaustive-deps notes; unchanged by this phase.
7. **Empty-portfolio landlord stats render red 0%.** `occupancyRateColor(0)` → destructive, so a brand-new landlord sees red "0%" before any units exist. This is the shared semantic status mapper working as designed (occupancy health is status, not money) — but a "no data yet" neutral state would read better. Product decision; not changed in QA.
8. **Label casing drift.** Register uses "Full Name" (title case) where login uses "Email address" (sentence case). Cosmetic; align in a copy pass.
9. **Marketing radius drift.** Marketing showcase cards use `rounded-[14px]` vs the 12px card token — invisible to users.

## FAILURES

- **None outstanding.** The 9 typecheck regressions and 2 colour leftovers found in this pass were fixed in-phase and re-verified (lint 0 errors, typecheck clean, 1151/1 tests, build clean). No broken authentication, navigation, forms, CRUD, payments, tenant flows, role boundaries, or onboarding detected.

## RECOMMENDED FUTURE WORK

1. **Add a typecheck gate that cannot silently rot** — these 9 errors reached `main` because nothing forced `tsc` before merge. Require the CI `Lint + Typecheck + Tests` job on PRs (branch protection) or run typecheck in a pre-push hook.
2. Product-approved pass on warnings 1–5 (receipt default colour, billing amber decoration, cron hint relocation, toast emoji, statement tokenization).
3. Delete dead showcase code (`EnterpriseAdminPlatform`, `OperationalExcellenceHub`, `PropertyOsSuite`, `DeploymentReleaseManager`, unrouted legacy dashboards) — they are unmounted, but they carry off-palette literals that pollute every future colour audit.
4. Manual exploratory QA on the live deployment with the demo accounts (demo.manager / demo.landlord) across a real device matrix — automated suites cover structure and a11y, not taste.
5. Axe scan of authenticated portal screens (current E2E covers public + login surfaces).
6. Resolve the 11 ESLint warnings and the 8 outdated major dependencies in a dedicated maintenance window.
7. Dark mode remains classified **dormant** — if activated, the chart token convention is the pattern to follow everywhere.
