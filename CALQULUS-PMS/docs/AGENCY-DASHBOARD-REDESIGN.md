# Agency Dashboard Redesign — Handoff Record

Purpose: executive-grade property-management command centre for CALQULUS Agency portal (`/agency`).
This file is the handoff/safety record. Read it first if this task is resumed after a timeout.

Status: **IN PROGRESS — Phase 2 complete (isolated preview); Phase 3+ next (live dashboard rewrite).**

---

## Inspected (Phase 1 — complete)

- `src/features/agency/pages/AgencyDashboard.tsx` — current dashboard (header via `AgencyLayout`, KPI strip, Needs attention, Portfolio activity chart, Client portfolio performance, Property performance table, Recent activity). Uses `useAgencyPortfolio()`, `buildAgencyAttentionItems()`, `ManagerActivityLog`, recharts `AreaChart`, `formatKes`.
- `src/features/agency/lib/useAgencyPortfolio.ts` — data hook. Returns: `properties[]`, `clients[]`, `clientCount` (linked + pending), `unlinkedCount`, `totalProperties`, `totalUnits`, `totalOccupied`, `occupancyRate`, `collectedMtd`, `outstanding`, `overdueInvoices`, `expiringLeases`, `series[{month,paid,pending}]`.
- `src/features/agency/lib/agencyPortfolio.ts` — pure helpers: `agencyClientStatus` (active/pending/attention), `agencyClientStatusChipClass`, `AGENCY_TREND_COLORS` (navy-mid collected / warning outstanding), `agencyCollectionRate`, `buildAgencyAttentionItems`.
- `src/features/agency/lib/agencyPaths.ts` — routes: dashboard `/agency`, clients `/agency/clients`, portfolio `/agency/portfolio`, tenants, billing, reports, settings; ops: buildings `/agency/properties`, landlords `/agency/landlords`, leases, maintenance, invites, water-billing, statements, vacation-notices.
- `src/features/agency/components/AgencyLayout.tsx` — desk shell: sidebar NAV (13 items incl. Dashboard…Settings), `PortalAccentBar`, `deskNavClass`, `PageHeader`, `Footer`. BrandMark `subtitle="Agency"` already used.
- Design tokens: `src/core/design/index.ts`, `src/core/design/deriveBrandPalette.ts` (`portalSurfaceProps("agency")` → `data-portal="agency"`), CSS tokens in `src/index.css` (`--calqulus-cyan #0F766E`, semantic `--portal-accent`), `src/shared/theme/tokens.ts`.
- White-label: `src/core/whiteLabel/WhiteLabelProvider.tsx` (`useWhiteLabel`, `useBrandTerm`), `src/core/brand/*`. Already exists — reuse; do not build a parallel system.
- Shared UI: `Card`, `Button`, `Table`, `EmptyState`, `ErrorState`, `Skeleton`, `PageHeader`, `StatusBadge` (`occupancyRateColor`), utility type classes (`page-title`, `section-title`, `type-meta`, `exec-table`), semantic soft status tokens (`--success-soft`, `--warning-soft`, `--danger-soft`).
- Onboarding completion: `src/features/onboarding/lib/completion.ts` `agencyCompletionItems`/`agencyRecommendations`; `deriveAgencyCompletedSteps` in `AgencyOnboardingPage.tsx`.
- Preview pattern: `design-preview` route family (lazy routes + `designPreviewPublicRoutes`, `PUBLIC_ROUTES`, `DesignPreview` nav, per-screen preview tests).

## Decisions / rules

- Redesign ONLY `/agency` dashboard. No portal-auth/db/API/business-rule changes.
- Preserve `useAgencyPortfolio` data hook + `agencyPortfolio` helpers verbatim (data integrity). Reuse `formatKes`, `occupancyRateColor`, semantic tokens.
- No mock/fake data. Zero-state must still look premium.
- Agency accent stays teal/cyan `#0F766E` (already in tokens). Spending: active nav, agency indicators, collection/share highlights, selected chart states, important actions.
- One unified card language; reduce container count ~25–30% (sections sit on the page, not every one a floating card).
- New isolated preview route: `/design-preview/agency-dashboard`.
- Money colour rules (locked by `agencyPortalPhase6.test.ts`): never `text-success`/`text-green` for money. Do NOT break that test.

## Changed / created (so far)

- `src/features/agency/theme.ts` — Agency design-token module. `AGENCY_ACCENT` (from CSS vars: accent/muted/surface/border), `AGENCY_STATUS` (soft success/warning/danger), `AGENCY_CARD` (unified panel vs on-page section chrome). White-label ready — colours resolve at render from CSS custom properties, never hard-coded per component.
- `src/features/design-preview/components/AgencyDashboardPreview.tsx` — isolated layout chrome: PageHeader ("Your agency at a glance."), compact setup banner (Profile ✓ / Portfolio defaults / First client / First property), KPI slots (Clients, Properties, Units, Occupancy, Collections), Portfolio performance hero card (chart frame + collected/outstanding legend), Portfolio snapshot, Needs attention (chips), Client portfolio performance (7-column table), Quick actions (Add client / Add property / Invite tenant / Create billing / View reports). No invented metrics — slots labelled "Live value"/"Live".
- `src/features/design-preview/pages/AgencyDashboardPreviewPage.tsx` — standalone preview page (design-bible header, skip link, BrandMark "Agency dashboard preview").
- `src/app/routes.ts` — added `AGENCY_DASHBOARD_PREVIEW_PATH`, `agencyDashboardPreviewRoute` (in `designPreviewPublicRoutes`, `publicRoutes`, `authOnlyRoutes`, `fallbackRoutes`).
- `src/features/marketing/publicConfig.ts` — `PUBLIC_ROUTES.agencyDashboardPreview`.
- `src/features/design-preview/pages/DesignPreview.tsx` — header nav link "Agency dashboard".
- `src/test/agencyDashboardPreview.test.tsx` — preview test (3 cases: hierarchy headings, no invented KES/client data, design-bible link).

## Design tokens introduced

- `src/features/agency/theme.ts`: centralised Agency palette derive from `--portal-accent`/`CALQULUS_PORTAL_ACCENT` + semantic token buckets; white-label ready via `useWhiteLabel` where appropriate. Default stays CALQULUS cyan.

## Remaining work

1. ✅ **Phase 2** — `/design-preview/agency-dashboard` preview done (visual QA across 1440/1280/tablet/390 still to confirm in this sandbox).
2. **Phase 3** rewrite `AgencyDashboard.tsx`: header copy ("Your agency at a glance." + supporting copy + date), compact onboarding banner, 5–6 KPI system.
3. **Phase 4** portfolio performance hero chart (six-month collected vs outstanding) + portfolio snapshot.
4. **Phase 5** needs-attention intelligence panel + client portfolio performance table/card hybrid.
5. **Phase 6** empty states + quick actions + responsive.
6. **Phase 7** theme/token architecture (agency/theme.ts) + white-label readiness.
7. **Phase 8** a11y/visual polish/responsive QA.
8. **Phase 9** build/lint/type/test.
9. **Phase 10** finalise this file.

## Known issues

- Dev preview (VITE_ENABLE_DEV_ACCESS) renders the live manager dashboard at `/`; use the preview route for visual QA.
- E2E chromium suite in this sandbox has pre-existing environmental failures; rely on unit + preview + build for the new surface.

## Next step

Build `src/features/agency/theme.ts` + the isolated preview component/page for `/design-preview/agency-dashboard`, wire the route & nav, then visually compare across widths before rewriting the live `AgencyDashboard.tsx`.