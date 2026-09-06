# Manager Dashboard Redesign — Handoff

Task: Redesign the CALQULUS **Manager** dashboard (`/`, `src/features/dashboard/pages/Dashboard.tsx`) into a refined, production-grade property-operations command center. Scope is Dashboard page content + composition ONLY. Do NOT rebuild app architecture, do NOT invent backend functionality, do NOT replace working business logic. The shell (`Layout`/`Sidebar`/`Header`) was already refined in earlier work and is untouched.

## What was inspected (Phase 1)

- `src/features/dashboard/pages/Dashboard.tsx` — the page being redesigned.
- `src/features/dashboard/lib/dashboardStats.ts` — `fetchManagerDashboardStats` (real stats; fields include `totalProperties`, `totalUnits`, `occupiedUnits`, `vacantUnits`, `occupancyRate`, `collectedRent`, `expectedRent`, `collectionRate`, `revenueChange`, `activeLeases`, `openMaintenanceCount`, `urgentMaintenanceCount`).
- `src/features/dashboard/lib/attentionItems.ts` — `buildAttentionItems` (zero-count items omitted).
- Components used: `StatCard`, `AttentionStrip`, `RevenueChart`, `OccupancyChart`, `ArrearsHeatMap`, `OpenMaintenancePreview`, `UpcomingPayments`, `PropertiesOverview`, `RecentActivity`, `ManagerQuickActions`, `ManagerActivationEmpty`, `PaymentSetupStatus`.
- `src/shared/components/layout/Layout.tsx` — the shared app shell (title/subtitle/headerActions pattern).
- Design tokens: CSS vars `--card`, `--border`, `--muted-foreground`, `--foreground`, `bg-success`/`text-success` (semantic only, money never green), `card-shadow`, `section-title`, `supporting-text`, `meta-text` classes.
- Imagery: `src/assets/marketing/property-residential-thumb.webp` (and commercial/office variants) — local project assets, suitable for subtle restrained use.
- **Critical guardrail**: `src/test/managerDashboardLayout.test.ts` is a **source-contract test** that locks `Dashboard.tsx` structure: exactly 4 `<StatCard`, string "Portfolio overview and today's operational priorities.", "Add property", "View reports", `AttentionStrip`, `UpcomingPayments`, `PropertiesOverview`, section strings ("Collections performance", "Recent activity", "Upcoming actions", "Property performance", "PaymentSetupStatus", "ManagerActivationEmpty", "fetchManagerDashboardStats", "buildAttentionItems"), and `dashboard-collections` must appear before `dashboard-occupancy` in the file, `dashboard-occupancy` after `dashboard-collections`. Do NOT rename section titles or reorder collections/occupancy IDs; keep exactly 4 StatCards.

## What was changed

### Live Management Dashboard (`src/features/dashboard/pages/Dashboard.tsx`)
- **Greeting hero card** added (replaces the previous single `<p>` greeting): an executive "Portfolio overview" eyebrow + greeting `<h1>` name + context line, plus "Add property" and "View reports" buttons. A restrained navy-veiled low-opacity property image sits on the right (hidden below `lg`). Removed the duplicated "Add property"/"View reports" buttons from `Layout` `headerActions` (kept the refresh + currency selector there). This is a **pure presentational** change — real `stats` still drive the context line.
- **Collection-rate summary strip** added above the `RevenueChart` inside "Collections performance", driven by real `stats.collectionRate` / `stats.collectedRent` / `stats.expectedRent` / `stats.revenueChange`. Zero invented numbers (empty state when `expectedRent` is 0).
- **New hierarchy order** (preserves the 4 StatCard KPI row, all section id/h2 strings, and the collections<occupancy contract): setup nudge (if incomplete) → Executive KPI row (`Portfolio`) → Portfolio performance (`Collections performance` 2-col with `Occupancy`+`Maintenance` rail) → **Needs attention** → **Property performance** → Recent activity + Upcoming actions. Sections were regrouped/reordered only; all markers retained.

### Isolated preview (Phase 2) — `/design-preview/manager-operations`
- `src/features/design-preview/components/ManagerOperationsPreview.tsx` — isolated visual preview of the manager operations command-center (5-KPI hero, portfolio-performance surface, snapshot, needs-attention panel, property table w/ thumbnails, recent collections + maintenance). Uses `cn`, `CALQULUS_COLOR` tokens, `PreviewTable`, `PROPERTY_ROWS`, real thumbnail images. Static layout only — no invented currency/client values (locked by test).
- `src/features/design-preview/pages/ManagerOperationsPreviewPage.tsx` — thin shell page.
- Route wiring in `src/app/routes.ts`: added lazy import, `MANAGER_OPERATIONS_PREVIEW_PATH = "/design-preview/manager-operations"`, `managerOperationsPreviewRoute`, and added to `designPreviewPublicRoutes`, `publicRoutes`, `authOnlyRoutes`, `fallbackRoutes`.
- `src/features/marketing/publicConfig.ts` — added `managerOperationsPreview` (and locked in `src/test/publicConfig.test.ts`).
- `src/features/design-preview/pages/DesignPreview.tsx` — added "Manager operations" nav link.
- `src/marketing/marketing.routes.ts` — unchanged.

## Files modified / created

- `src/app/routes.ts` (M)
- `src/features/dashboard/pages/Dashboard.tsx` (M)
- `src/features/design-preview/pages/DesignPreview.tsx` (M)
- `src/features/marketing/publicConfig.ts` (M)
- `src/test/publicConfig.test.ts` (M)
- `src/features/design-preview/components/ManagerOperationsPreview.tsx` (new)
- `src/features/design-preview/pages/ManagerOperationsPreviewPage.tsx` (new)
- `src/test/managerOperationsPreview.test.tsx` (new)

## Routes affected
- `/design-preview/manager-operations` (new preview route; public + authOnly + fallback).
- `/` (live manager Dashboard) — internal composition only, no route change.

## Design tokens introduced
- None new (reused existing `--card/--border/--muted-foreground/--foreground`, `card-shadow`, `section-title`, `supporting-text`, `meta-text`, semantic `bg-success`/`text-*`). White-label readiness note: manager surface already inherits the shared shell; no hard-coded accent colours added to `Dashboard.tsx` (uses token classes).

## Validation status
- `npx tsc --noEmit`: exit 0.
- `npx eslint` on changed files: exit 0.
- `npx vitest run src/test/`: **97 passed / 1 skipped (1193 / 1194)** — includes the source-contract `managerDashboardLayout.test.ts`, new `managerOperationsPreview.test.tsx`, `managerDashboardPreview`, `publicConfig`.
- `npm run build`: exit 0 (precache 770.73 KiB).
- Responsive overflow check via playwright-core + system chromium: **0 horizontal overflow** at 1440/1280/1024/768/390/375px on `/`, `/design-preview/manager-operations`, `/design-preview/agency-dashboard`.
- Live dev dashboard (`/` under `VITE_ENABLE_DEV_ACCESS`) renders the hero, KPI cards, collection-rate strip, reordered sections.

## Known issues / notes
- Dev preview renders the live dashboard at `/` (dev-access); use `/design-preview/manager-operations` for isolated visual QA.
- Playwright browser binaries are not installed in this sandbox; use `executablePath: "/usr/bin/chromium"` for playwright-core checks. Full `npx playwright test` is environmentally blocked in this sandbox (pre-existing).
- `ResendVerification` cooldown unit-test is a pre-existing intermittent flake under full-suite parallelism (passes on re-run).
- Document title on the manager-operations preview tab may briefly show the shared `CALQULUS | Property Operations, Connected` until the lazy page's title effect runs — cosmetic only.

## Remaining work (not done, do not mark complete)
- [ ] Optional: refresh the greeting-hero imagery once a clean source re-export exists (current hero uses the local property thumbnail). Candidate only, not required.
- [ ] Visual QA of matched data state (populated portfolio) is limited in this sandbox (no Supabase); run locally with a seeded account to eyeball the populated-state KPI/collection-rate strip + Properties table.
- [ ] Compare populated-dev dashboard vs preview and refine spacing/alignment if a populated account reveals issues.
- [ ] Unless the product owner decides to continue, this manager dashboard surface IS integrated (not gated behind a preview). No further mechanical work is required to ship it.
- [ ] Follow the same preview-then-commit pattern for any future manager sub-pages (Properties, Maintenance) if a similar redesign is requested.

## Exact next step
1. `git status` (current working file set).
2. If the owner approves, commit the changes (do **not** commit without confirmation; current branch `main` is clean).
3. Optionally run one manual populated-data review on a seeded account before shipping.