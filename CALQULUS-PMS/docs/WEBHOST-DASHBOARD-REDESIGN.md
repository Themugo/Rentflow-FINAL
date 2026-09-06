# Webhost / Admin Dashboard Redesign — Handoff

Task: Redesign the CALQULUS **Webhost / Admin** dashboard (`/webhost`, `src/features/webhost/pages/AdminDashboard.tsx`) into a premium **platform command center** — the control plane for the people who operate, administer, commercialise, secure and configure the CALQULUS platform. **Not** another property-management dashboard. Scope is the dashboard page content + the shell header identity. Do NOT build a white-label system, do NOT invent backend/health/commercial data, do NOT replace working business logic. Unrelated to the Tenant/Manager dashboard redesigns.

## What was inspected (Phase 1)

- `src/features/webhost/pages/AdminDashboard.tsx` — the primary target. Original structure: system-status band → compact stat strip → Service health → Applications + Alerts grid → Infrastructure activity → Users & access → tenant-firewall note.
- `src/features/webhost/components/WebhostLayout.tsx` — shared webhost shell. **Nav groups are source-contract-locked**: `"Control plane"` / `"Administration"` / `"Account"` (asserted in `webhostOperatorOnboarding.test.ts`); `aria-current` + "Skip to main content" (asserted in `accessibilityCertification.test.ts`). Added a right-side header identity cluster (additive; nav untouched).
- Real data sources kept intact: `useAdminHealthProbes` (service probes → StatusCell/deriveSystemStatus), `getApplicationFacts` (build/runtime facts), `user_roles` counts, `activity_logs` security grouping, and — newly surfaced — **`manager_invoices`** for the commercial overview (matches `ManagerBilling.tsx` billing logic).
- **Source-contract guardrail**: `src/test/adminWebhostPhase8.test.ts` requires the dashboard file to contain `<table` and `font-mono` — both preserved (Service-health, Applications, Needs-attention, Activity tables all still emit `<table`; latency/detail/actor cells keep `font-mono`).

## What was changed

### Executive header (`AdminDashboard.tsx`)
- Replaced the generic page with an **executive page header**: eyebrow `Platform command center`, greeting `h1` (`Good morning/afternoon/evening, <name>` from `useAuth().platformAdminInfo.display_name` → user email → `administrator`), context line, and a right-side date pill (`todayFmt`, e.g. `Wednesday, 27 August 2026`) + `Executive view` tag. Real `useAuth` + `Intl` only; no invented identity.

### Platform-scale KPI row (real counts, no tenant PII)
- 4 KPI cards: **Organizations** (manager+agency `user_roles`), **Users** (all portal roles), **Properties** (`properties`), **Units** (`units`). Each links to the existing orgs/users/properties/subscriptions routes. Teal accent used only on the icon tile (`[var(--portal-accent)]/10`), never fills. Zero fabrication — counts come from `count: exact` queries; show `…` while loading.

### Commercial overview (real platform billing)
- A compact 4-cell strip derived from existing `manager_invoices`: **Received this month** (paid within MTD), **Outstanding** (pending+overdue), **Active subscriptions** (distinct managers with paid subscription invoices), **Collection rate** (paid/total billed). Honest empty state: "No invoices billed yet." Query uses an **array queryKey** (`["platform-admin-infra-commercial"]`) — required for React Query v4+.

### Kept, reorganized & relabelled
- **System status band** (unchanged, honest "not instrumented" footer retained — never fabricate deployments/history).
- **Service health** table (unchanged).
- **Applications** table (unchanged, `<table`/`font-mono` retained).
- **Alerts** relabelled **"Needs attention"** (same real audit-log source).
- Removed the old redundant compact stat strip (superseded by the new KPI row + commercial strip) — this is the "reduce card soup" reduction.
- **Infrastructure activity** table and **Users & access** breakdown retained.
- Tenant-firewall footer note and login-security note retained.

### Shell header (`WebhostLayout.tsx`)
- Added right-side **identity cluster**: a platform-settings gear (links `/webhost/settings`) + an email avatar/identifier chip. Additive; nav groups and `aria-current` untouched.

## Design / token usage
- Used the existing theme layer only: `bg-card`, `border-border`, `text-muted-foreground`, `font-heading`, `tabular-nums`, semantic `bg-success`/`text-warning`/`bg-destructive`, and the portal accent `[var(--portal-accent)]` (platform/WebHost = **teal**, CSS var already centralized in `index.css`). No new tokens introduced, no hard-coded raw colours scattered in components — future white-labeling can swap `--portal-accent`/`--calqulus-*` centrally without touching this dashboard.

## Files modified
- `src/features/webhost/pages/AdminDashboard.tsx` (redesigned).
- `src/features/webhost/components/WebhostLayout.tsx` (right-side identity cluster; nav untouched).
- Added `docs/WEBHOST-DASHBOARD-REDESIGN.md` (this doc).

## Routes affected
- `/webhost` (dashboard only). No routes added/changed. No navigation reordering.

## Known issues / notes
- `manager_user_id` is `NOT NULL` on `manager_invoices`; active-subscriptions Set keyed by `manager_user_id` is valid.
- `paid_date` is a `date` column → `new Date(paid_date)` is midnight; MTD `>= startOfMonth(now) && <= now` is correct.
- The **duplicate-key console warning** on webhost pages is **pre-existing** (reproduces identically on untouched `/webhost/audit` and `/webhost/applications` — it originates in the shared `Layout`/nav, not this change).
- The `queryKey` string bug is fixed (was array=required).
- Greeting shows `Administrator` when no platformAdminInfo/user email present (dev orphan account) — acceptable.

## Remaining work
- None for this dashboard scope. White-label system intentionally NOT built (per instructions); `--portal-accent` teal is already the centralised knob.
- Optional later: an organizations registry table on the dashboard is deferred — the Organizations KPI already links to `/webhost/organizations`, avoiding a second dashboard grid (reduces card soup).

## Verification
- `npx tsc --noEmit` exit 0
- `npx eslint` on both changed files: 0 errors (pre-existing warnings elsewhere untouched)
- Full unit suite: **1193 passed / 1 skipped** (incl. `adminWebhostPhase8` `<table`+`font-mono`, `webhostOperatorOnboarding` nav groups, `accessibilityCertification`, `designTokens`)
- `npm run build` exit 0 (precache 26 entries, 771.28 KiB)
- Responsive: 0px horizontal overflow at 1440/1280/1024/768/390/375 across `/webhost`, `/webhost/organizations`, `/webhost/users`, `/webhost/subscriptions`, `/webhost/audit`, `/webhost/settings`

## Final UX check
- Webhost/Admin identity is visually distinct from the property dashboards (teal command-center vs manager/agency/landlord banks).
- Zero-data state is honest and premium (all KPI cells show 0, commercial says "no invoices yet", empty alerts show "All clear"-style success state) — nothing fabricated.
- Page is compact; the redundant stat strip was removed to reduce container count.
- Tenancy firewall maintained throughout — no tenant PII anywhere on this desk.

## Exact next step (if resumed)
1. `git add src/features/webhost/pages/AdminDashboard.tsx src/features/webhost/components/WebhostLayout.tsx docs/WEBHOST-DASHBOARD-REDESIGN.md`
2. Commit (e.g. `webhost admin dashboard control center redesign`), push to `main`.
3. Optional visual QA in a real Supabase env to see populated Commercial/KPI values.