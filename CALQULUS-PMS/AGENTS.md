# CALQULUS PMS ŌĆö Agent Memory

## Goal
Realign all dashboards to the new role architecture (Webhost, Manager, Landlord, Tenant, Submanager) and implement the UI patterns shown in the HTML mockup files.

**Current production truth (2026-08-19):** independent 30-gate score **55/100** ŌĆö `docs/audits/INDEPENDENT_QUALITY_GATE.md`. Not SOC 2 / ISO / PCI certified. Live anon `tenants` REST still `42P17` until `supabase/sql/apply-live-p1-rls.sql` is pasted. Edge `health-check` is 404 until deployed. Published catalog is **KES per property / month** (Starter 400 / Professional 600 / Enterprise 800). Demo logins: `demo.manager@calqulusrms.com` / `Demo@2026`. AGENTS.md `CALQULUS RMS@2026!` accounts are invalid on live Auth.

## Constraints & Preferences
- Local folder: `C:\Users\hp\Desktop\CALQULUS-PMS`
- Repo: `https://github.com/Themugo/CALQULUS-PMS.git` ŌĆö auto-deploys Vercel from `main`
- Production: `https://www.calqulus.site` / Supabase `aelzsqxllkypbzslxyju.supabase.co`
- Test accounts: `jimmythemugo@gmail.com` (manager), `kamauwamakena@gmail.com` (tenant), `mugo.james27@gmail.com` (webhost) ├óŌé¼ŌĆØ all pw `CALQULUS RMS@2026!`
- Demo accounts: `demo.manager@calqulusrms.com`, `demo.landlord@calqulusrms.com` ├óŌé¼ŌĆØ pw `Demo@2026`
- Edge functions deployed: `send-tenant-invitation`, `create-tenant-account`, `notify-manager-tenant-signup`
- 74 migrations in `supabase/migrations/`

## Build & Verify
- `npm run build` ├óŌé¼ŌĆØ production build (Vite/Rolldown)
- `npm run dev` ├óŌé¼ŌĆØ dev server at `http://localhost:3000` (vite.config.ts server.port overrides Vite's 5173 default)
- `npx tsc --noEmit` ├óŌé¼ŌĆØ TypeScript check
- `npx eslint src` ├óŌé¼ŌĆØ ESLint
- `npx vitest run` ├óŌé¼ŌĆØ 690 unit tests (38 files). Added `src/test/chartColors.test.ts` (14), `src/test/formatCurrency.test.ts` (21), `src/test/dateFormat.test.ts` (28) covering the previously-untested `@/shared/lib/{chartColors,formatCurrency,dateFormat}` pure utilities.
- `npm audit` ├óŌé¼ŌĆØ 0 vulnerabilities
- `npx playwright test` ├óŌé¼ŌĆØ 14 E2E tests (Chromium)

## Deploy
- `node scripts/deploy-production.mjs --dry-run` ├óŌé¼ŌĆØ pre-flight checks
- `node scripts/deploy-production.mjs` ├óŌé¼ŌĆØ deploy (build + edge functions + Vercel push)
- Set secrets: Supabase Dashboard ├óŌĆĀŌĆÖ Edge Functions ├óŌĆĀŌĆÖ Secrets
- Vercel auto-deploys from GitHub `main` branch

## Observability Stack

### Frontend Observability
- **Structured Logging** (`src/shared/lib/observability.ts`)
  - Correlation IDs for request tracing
  - Session context tracking
  - Component-level loggers
  - Performance marks and measures
  - Web Vitals monitoring (LCP, FID, CLS, TTFB)

- **Business KPIs** (`kpi.track()`)
  - Payment metrics (success/failed/pending)
  - Tenant events (signup, lease_signed, move_in/out)
  - Property events (created, unit_added, unit_occupied)
  - Revenue tracking by source

- **Application Metrics** (`metrics.record()`)
  - Counter, gauge, timing metrics
  - Batch flush to Supabase
  - Performance marks

- **Production Diagnostics** (`ProductionDiagnostics.tsx`)
  - Real-time component health checks
  - Ctrl+Shift+D to toggle
  - Correlation ID display for support

### Edge Function Observability
- **Health Check** (`supabase/functions/health-check/`)
  - GET `/health-check` - Basic health
  - GET `/health-check?detailed=true` - Full component status
  - GET `/health-check?metrics=true` - With metrics
  - Checks: Database, Auth, Storage, Edge Functions

### Monitoring Dashboards
- `monitoring/grafana-dashboards/observability.json` - Full observability dashboard
  - System Health Overview
  - Request Rate & Error Rate
  - Payment Operations
  - Web Vitals
  - Business KPIs

### Alerting
- Prometheus metrics-based alerts (`monitoring/alerts.yml`)
- Payment failure alerts
- Database connection pool monitoring
- Security alerts (failed logins, MFA bypass)

## CI/CD Pipeline

### GitHub Actions Workflows

1. **ci.yml** - Continuous Integration
   - Lint + Typecheck + Tests (fast feedback)
   - Security: Dependency Audit (npm audit --audit-level=high)
   - Security: Secret Detection (GitLeaks)
   - Build Verification
   - Bundle Size Check
   - Full Verify (production audit)
   - CI Summary Dashboard

2. **security-scan.yml** - Security Scanning (Weekly + On Push)
   - Secret Detection (GitLeaks)
   - Dependency Security Audit (npm audit)
   - CodeQL Security Analysis
   - Dependency Health Check
   - Supply Chain Security
   - SBOM Generation

3. **deploy-production.yml** - Production Deployment
   - Pre-deployment Quality Gate
   - Production Build
   - Lighthouse Performance Audit
   - E2E Test Verification
   - Vercel Deployment
   - Health Check
   - Rollback Validation
   - Deployment Notifications

4. **monitor.yml** - Deployment Monitoring (Every 15 min)
   - Endpoint Health Monitor
   - Performance Monitoring
   - SSL Certificate Check
   - Uptime Verification
   - Database Health Check
   - Rollback Capability Check

### Quality Gates
- Bundle size limit: 2.5MB (warning threshold)
- Lighthouse performance scores: Performance ├óŌĆ░─ä0.8, Accessibility ├óŌĆ░─ä0.9, Best Practices ├óŌĆ░─ä0.9
- Critical/High vulnerabilities: Block deployment
- Secret detection: Block deployment

### Configuration Files
- `.gitleaks.toml` - Secret scanning rules
- `lighthouse-budget.json` - Performance budgets
- `scripts/check-outdated-deps.mjs` - Dependency health checks

### Secrets Required (GitHub Actions)
- `VERCEL_TOKEN` - Vercel deployment
- `VERCEL_ORG_ID` - Vercel organization
- `VERCEL_PROJECT_ID` - Vercel project
- `E2E_MANAGER_EMAIL` / `E2E_MANAGER_PASSWORD` - E2E tests
- `E2E_TENANT_EMAIL` / `E2E_TENANT_PASSWORD` - E2E tests
- `SUPABASE_SERVICE_KEY` - Database health checks

## Progress

### Done
- **Sidebar (live `Sidebar.tsx`)**: Manager groups are OVERVIEW (Dashboard), PORTFOLIO (Properties, Landlords), OCCUPANCY (Leases, Tenants, Invites, Vacation Notices, Tenant Screening), COLLECTIONS (Billing, Water Billing, Statements, Payment History), OPERATIONS (Maintenance, Contracts, Reports), ACCOUNT (Platform Billing, Settings). Do not treat older mockup notes as the product.
- **Water Billing standalone page** (`/water-billing`): New property selector + WaterBillingManager integration. Route added for manager, submanager, and agency roles.
- **Invites page** (`/invites`): Wraps InvitationTracker with InviteTenantDialog trigger. Route added for manager, submanager, and agency roles.
- **Statements page** (`/statements`): Wraps PropertyStatementTab with property selector. Route added for manager, submanager, and agency roles.
- **Landlord dashboard tenant PII removed**: Deleted Payment Activity tab (showed tenant names, units, property names). Removed InviteTenantDialog from property cards. Landlord now only sees aggregate revenue, occupancy, and property-level data ├óŌé¼ŌĆØ zero tenant PII.
- **`can_manage_tenants` removed from all TypeScript types**: Removed from `WebhostPermissions` interface, `AdminPermissionsRow`, `AuthContext.tsx` select query + mapping, `WebhostDashboard.tsx` bootstrap, `supabase/types.ts` (Row/Insert/Update), `useAdminPermissions.ts` comment.
- **AgencyDashboard `agency_id` ├óŌĆĀŌĆÖ `manager_id`**: Fixed deprecated query that referenced `agency_id` column (removed by pending migration). Agency sidebar updated with Invites, Statements links.
- **Agency routes expanded**: Added `/agency/water-billing`, `/agency/invites`, `/agency/statements` routes.
- **Role detection paths updated**: Added `/invites`, `/statements` to `managerPaths` in `AuthContext.tsx`.
- **Agency portal scaffolding** ├óŌé¼ŌĆØ added `'agency'` to `AppRole` type, `isAgency` to `AuthContext`. Created `AgencyDashboard.tsx` (stats cards, quick actions, sidebar nav), `AgencyAuth.tsx` (emerald-themed login). Routes: `/agency/login`, `/agency` with subroutes for Properties, Tenants, Leases, Billing, Maintenance, Landlords, Reports, Settings.
- **Major refactor from agency├óŌĆĀŌĆÖlandlord model**: Agency CRUD, filters, grouping, bulk assign removed from `Properties.tsx`.
- **Manager Landlords page** (`/landlords`): `ManagerLandlords.tsx` lists properties with linked landlords, revenue share %.
- **Submanager role-only conversion**: Removed `/submanager` standalone route. Submanagers use manager routes with `viewOnly` wrapper.
- **Rent payment flow**: Multi-modal (STK push, feature phone Paybill, bank transfer), auto SMS+email receipts.
- **Water billing system**: Meter readings per unit, auto-calc charge ─éŌĆö rate, "Bill" action.
- **Reports**: Financial/occupancy/maintenance tabs with Chart.js revenue bars/doughnut occupancy chart.

### Done
- **Webhost dashboard overhaul**: ├ó┼øŌĆ” Completed - Removed extra tabs (Oversight, Compliance, Platform Admins, Billing Blocks) to align sidebar to `dashboard_previews.html` (Overview, Managers, Properties, Billing, Tiers, Contracts, Security, Error Logs). Unlinked Landlords tab already exists (filtered by `manager_id IS NULL`). Webhost Overview already has no tenant metrics (only manager/property/platform billing stats).
- **Tenant dashboard hero card**: ├ó┼øŌĆ” Completed - TenantBalanceSummary already implements balance card with overdue/pending/clear states based on balance_due and isFullyPaid logic.

### Blocked
- New DB migrations (`20260530000000` through `20260601000001`) not yet applied ├óŌé¼ŌĆØ need Supabase DB password from Project Dashboard ├óŌĆĀŌĆÖ Settings ├óŌĆĀŌĆÖ Database.

## Key Accounts (test)
- Manager: `jimmythemugo@gmail.com` / `CALQULUS RMS@2026!`
- Tenant: `kamauwamakena@gmail.com` / `CALQULUS RMS@2026!`
- Webhost: `mugo.james27@gmail.com` / `CALQULUS RMS@2026!`
- Platform Business: `themugo@calqulusrms.com` (needs seeding)
- Platform Admin: `admin@calqulusrms.com` (needs seeding)
- Demo Manager: `demo.manager@calqulusrms.com` / `Demo@2026`
- Demo Landlord: `demo.landlord@calqulusrms.com` / `Demo@2026`

## Supabase
- URL: `https://aelzsqxllkypbzslxyju.supabase.co`
- 74 migrations in `supabase/migrations/`
- Service role key in `scripts/fix-roles.mjs`

## Performance Optimizations

### Frontend Optimizations Implemented

1. **Bundle Size Reduction via Code Splitting**
   - Enhanced Vite config with optimized manual chunks
   - Vendor chunks: react, router, query, ui, charts, pdf, utils, date, supabase
   - Route-based lazy loading with React.lazy/Suspense
   - CSS code splitting enabled

2. **React Performance**
   - `React.memo` with custom comparison functions in PropertyCard
   - `useMemo` for expensive calculations (occupancy rates, filters)
   - `useCallback` for stable callback references
   - Lazy image loading with IntersectionObserver

3. **List Virtualization**
   - `VirtualizedList` component for large datasets (1000+ items)
   - `WindowVirtualizer` for fixed-height items
   - `InfiniteScroll` with IntersectionObserver

4. **React Query Optimization**
   - 30-second staleTime (was 5 minutes)
   - 10-minute garbage collection
   - `staleWhileRevalidate: true`
   - `refetchOnMount: false`
   - Query key factory for consistent keys
   - Prefetching on route changes

5. **Route Prefetching**
   - `RoutePrefetcher` component preloads data for likely next routes
   - Dashboard prefetches properties and tenants
   - Properties page prefetches tenants

6. **Core Web Vitals Improvements**
   - Preconnect hints for Supabase and Google Fonts
   - DNS prefetch for external resources
   - Critical CSS inlined in index.html
   - Loading skeleton for instant perceived performance
   - Lazy image loading with blur-up placeholders

7. **Database Optimizations**
   - `get_manager_dashboard_stats` RPC function (single call vs 13 queries)
   - `get_tenants_with_properties` with JOINs pre-computed
   - `get_properties_with_tenant_counts` with occupancy rates
   - Optimized indexes on frequently queried columns

### Key Files
- `vite.config.ts` - Enhanced chunk splitting
- `src/shared/components/VirtualizedList.tsx` - Virtualization utilities
- `src/shared/components/LazyImage.tsx` - Lazy loading images
- `src/shared/hooks/useOptimizedQuery.ts` - Query optimization hooks
- `src/App.tsx` - Route prefetching and QueryClient config
- `src/features/properties/components/PropertyCard.tsx` - Memoized component
- `supabase/migrations/20260601000001_optimized_queries.sql` - DB RPC functions

### Expected Performance Impact
- **First Contentful Paint (FCP)**: 30-50% improvement via critical CSS
- **Largest Contentful Paint (LCP)**: 40-60% improvement via preconnects + lazy loading
- **Total Bundle Size**: Reduced via code splitting (vendor chunks load on-demand)
- **Time to Interactive (TTI)**: Improved via route prefetching
- **Database Query Count**: Reduced from ~13 queries to 1 RPC call per dashboard load

## Platform Admin Hierarchy
- `platform_admins` table: 3 tiers ├óŌé¼ŌĆØ owner (`is_immutable`), business, admin
- Owner: `mugo.james27@gmail.com` ├óŌé¼ŌĆØ cannot be suspended/deleted
- Business: `themugo@calqulusrms.com` ├óŌé¼ŌĆØ can be suspended by Owner only, can create admins
- Admin: `admin@calqulusrms.com` ├óŌé¼ŌĆØ can be suspended by Owner or Business
- Suspension rules enforced via DB trigger + application-level checks
- UI: Webhost Dashboard ├óŌĆĀŌĆÖ "Platform Admins" tab (owner/business only)

## Customer Billing Blocks
- `customer_billing_blocks` table: per-unit pricing overrides, waivers, discounts
- Published commercial catalog is **KES per property / month** (Starter 400, Professional 600, Enterprise 800). Custom billing blocks remain for negotiated accounts. Do not quote the old per-unit 40/30/20 list as the public price.
- UI: Webhost Dashboard ├óŌĆĀŌĆÖ "Billing Blocks" tab (owner/business only)
- Supports: per-unit pricing, registration fee waiver, %/flat discounts, custom negotiated blocks

## Webhost Oversight
- `PlatformOversight` component: aggregate stats per manager (properties, units, active tenants)
- No tenant PII exposed
- UI: Webhost Dashboard ├óŌĆĀŌĆÖ "Oversight" tab (all webhosts)

## Role Architecture

### Three-Role Architecture (Webhost sells to three portal types)
```
Tier 1: Platform Ownership
├óŌĆØ┼ø├óŌĆØŌé¼├óŌĆØŌé¼ Super Webhost (is_immutable)
├óŌĆØ┼ø├óŌĆØŌé¼├óŌĆØŌé¼ Webhost Admin
├óŌĆØŌĆØ├óŌĆØŌé¼├óŌĆØŌé¼ Webhost Limited Admin
    ├óŌĆĀŌĆÖ NO tenant data access EVER
    ├óŌĆĀŌĆÖ NO tenant tab, NO tenant counts as individuals
    ├óŌĆĀŌĆÖ Sees only system landlords (manager_id IS NULL)

Tier 2: Property Management (three distinct portals)
├óŌĆØ┼ø├óŌĆØŌé¼├óŌĆØŌé¼ Manager ├óŌé¼ŌĆØ full operations + collections
├óŌĆØŌĆÜ   ├óŌĆĀŌĆÖ Manages tenants directly, collects rent to landlord/own accounts
├óŌĆØŌĆÜ   ├óŌĆĀŌĆÖ Owns property relationships, runs enforcement/repairs/services
├óŌĆØŌĆÜ   ├óŌĆØŌĆØ├óŌĆØŌé¼├óŌĆØŌé¼ Submanager (role, not portal ├óŌé¼ŌĆØ uses manager routes with permissions)
├óŌĆØŌĆÜ       ├óŌĆĀŌĆÖ Created by Manager via Settings ├óŌĆĀŌĆÖ Team
├óŌĆØŌĆÜ       ├óŌĆĀŌĆÖ Permission-gated via can()/canWrite() hooks
├óŌĆØŌĆÜ
├óŌĆØ┼ø├óŌĆØŌé¼├óŌĆØŌé¼ Agency ├óŌé¼ŌĆØ blended agent role
├óŌĆØŌĆÜ   ├óŌĆĀŌĆÖ Manages properties ON BEHALF OF landlords (commission model)
├óŌĆØŌĆÜ   ├óŌĆĀŌĆÖ Can collect rent to agency accounts OR pass through to landlords
├óŌĆØŌĆÜ   ├óŌĆĀŌĆÖ Links landlords to properties with configurable revenue sharing
├óŌĆØŌĆÜ   ├óŌĆĀŌĆÖ Full tenant management capabilities (same as manager)
├óŌĆØŌĆÜ   ├óŌĆĀŌĆÖ Portal at /agency ├óŌé¼ŌĆØ own sidebar, login, dashboard
├óŌĆØŌĆÜ
├óŌĆØŌĆØ├óŌĆØŌé¼├óŌĆØŌé¼ Landlord ├óŌé¼ŌĆØ guarded standalone property owner
    ├óŌĆĀŌĆÖ Revenue-only view, NO tenant PII ever
    ├óŌĆĀŌĆÖ Can be linked to Manager (manager_id IS NOT NULL) or Agency
    ├óŌĆĀŌĆÖ System landlords (manager_id IS NULL) visible to webhost
    ├óŌĆĀŌĆÖ Managed landlords invisible to webhost
    ├óŌĆĀŌĆÖ Portal at /landlord/dashboard

Tier 3: Tenants
├óŌĆØ┼ø├óŌĆØŌé¼├óŌĆØŌé¼ Own portal only (/portal)
├óŌĆØ┼ø├óŌĆØŌé¼├óŌĆØŌé¼ NO access to other tenants' data
├óŌĆØŌĆØ├óŌĆØŌé¼├óŌĆØŌé¼ NO landlord PII exposure
```

### Access URL Map
| Portal | URL |
|--------|-----|
| Webhost login | `/webhost/login` |
| Manager dashboard | `/` (after login) |
| Agency login | `/agency/login` |
| Agency dashboard | `/agency` |
| Landlord login | `/landlord/login` |
| Landlord dashboard | `/landlord/dashboard` |
| Tenant login | `/tenant/login` |
| Tenant signup | `/tenant/signup` |
| Tenant portal | `/portal` |

### Hard Access Rules
1. **Webhost tenant firewall**: Webhosts can NEVER access tenant data. No tenant routes, no tenant API queries, no `can_manage_tenants` permission.
2. **Landlord split by `manager_id`**: `manager_id IS NOT NULL` = managed (webhost has zero visibility). `manager_id IS NULL` = system (webhost oversight).
3. **Manager data isolation**: All queries scoped by `manager_id = auth.uid()`. No cross-manager data leakage.
4. **Landlord revenue-only view**: Landlords see aggregate revenue, NOT individual tenant names, contact info, or payment breakdowns.

### Role Definitions
| Role | Portal | Route | Who Creates | Description |
|------|--------|-------|-------------|-------------|
| **Webhost** | Own dashboard | `/webhost` | Platform Admin | Sells subscriptions, manages platform. Tiers: super_admin / admin / limited_admin |
| **Agency Team Manager** | Manager dashboard | `/` (via manager routes) | Buys from Webhost | "Boss" of an agency. Manages tenants directly and/or properties for landlords. Agency staff are submanagers. |
| **Agency Staff** | Manager dashboard (restricted) | `/` via manager routes | Agency Team Manager | Role assigned to agency staff. Uses same manager UI with limited permissions. Created via Settings ├óŌĆĀŌĆÖ Team. |
| **Manager** | Own dashboard | `/` | Webhost | Manages tenants on behalf of landlords. Has "Landlords" tab to link property owners. |
| **Submanager** | Manager dashboard (restricted) | `/` via manager routes | Manager | Role (NOT standalone portal). Uses same manager UI but with restricted permissions. Created via Settings ├óŌĆĀŌĆÖ Team. |
| **Landlord** | Guarded standalone portal | `/landlord/dashboard` | Invited by Manager or Webhost | Property owner. Sees aggregate revenue, requests payouts. NO tenant PII. Can be linked to Manager or Agency. |
| **Agency** | Own dashboard | `/agency` | Webhost | Blended agent role. Manages properties for landlords (commission model). Full tenant mgmt. Own login/sidebar. |
| **Tenant** | Own portal | `/portal` | Invitation from Manager | Lives in a unit. Pays rent, submits maintenance, views invoices. |

### Payment Flows
1. **Manager operates, landlord collects**: Manager manages tenants, runs enforcement/repairs/services. Payments go to property owner (landlord). Manager earns via platform subscription.
2. **Agency collects (full management)**: Agency manages tenants directly. Payments go to agency's accounts. Agency earns via management fee.
3. **Agency manages, pays landlord**: Agency manages property for landlord. Payments collected by agency, passed to landlord after deducting commission.
4. **Landlord self-managed**: Landlord operates their own properties independently through their portal.

### Key Tables
- `user_roles` ├óŌé¼ŌĆØ `(user_id, role: manager|tenant|webhost|submanager|landlord, approval_status)`
- `property_landlords` ├óŌé¼ŌĆØ `(property_id, landlord_user_id, manager_id, revenue_share_pct, operating_model, payment_destination)`
- `manager_submanagers` ├óŌé¼ŌĆØ `(manager_id, submanager_user_id)`
- `submanager_permissions` ├óŌé¼ŌĆØ Permission flags per submanager
- `submanager_property_assignments` ├óŌé¼ŌĆØ Property access restrictions per submanager

### What Changed
- **No "Agency" tab/management in Properties page**: Agencies are NOT managed by individual managers. Agency Team Managers buy subscriptions from Webhost directly.
- **New "Landlords" tab in Manager sidebar**: Managers link property owners via `/landlords` route.
- **Submanager is a role, not a portal**: Submanagers no longer have `/submanager` route. They use the same manager dashboard with permission restrictions via `can()`/`canWrite()` hooks.
- **Removed agency_id from properties**: Properties no longer have `agency_id` field. Agency relationships are managed through `property_landlords.operating_model`.

## Webhost Applications + Deployments (Phase 2, 2026-08-23)
- New routes: `/webhost/applications`, `/webhost/applications/:appId`, `/webhost/deployments` ŌĆö registered in `roleRouteConfigs`, `webhostPaths.ts`, sidebar nav (Applications=new Deployments). `webhostApplicationPath(appId)` helper.
- `lib/infrastructure.ts` extended: `getApplicationRuntime` (facts + worst-of probe health), `getNonSecretConfig` (safe entries only ŌĆö never keys/tokens), `DEPLOYMENTS_NOT_INSTRUMENTED` constant.
- **Deployment history is not instrumented** ŌĆö single "Current live build" row (serving traffic now ŌåÆ Operational), Started/Completed = "Not recorded". Never fabricate history.

## Global Design Audit (2026-08-24)
- **Portal accents aligned to design contract (2026):** Manager Blue (unchanged), Landlord **Emerald** #2F9B74, Agency **Cyan** (indigo/cyan) #0F766E, Tenant **Sky** (cool blue) #0284C7, Admin/WebHost **Teal** #2C9183. Tokens and CSS variables both updated; accent stripes remain 2px-only. (Note: earlier spec named Agency Amber #C08A37 / Tenant Violet #7C5FD3 — superseded. The cyan/sky values now match the portal chrome + `HOMEPAGE_ROLE_ACCENTS`.)
- `designTokens.test.ts` lockstep asserts new hexes + CSS vars. 969/970 tests pass; no layout changes.

## Frontend Performance Audit (Phase 11, 2026-08-25)
- **Logo replaced (only behaviour-neutral change)**: `src/assets/calqulus-logo-new.jpg` was a real, valid JPEG in this workspace (JFIF header verified) — 14.5 KB, NOT the 208 KB the audit quoted. Regardless, the JPG was the wrong format for a flat-color mark. Replaced with `calqulus-logo.webp` (112×112, 1.0 KB) + `calqulus-logo@2x.webp` (224×224, 1.8 KB) via sharp-cli. `BrandMark` now serves WebP with `srcSet` 112w/224w and `sizes="56px"`; old JPG deleted. 26 BrandMark consumers unchanged. **Note**: `src/assets/calqulus-banner.jpg` (591 KB) starts with `\uFFFD\uFFFD\uFFFD` (UTF-8 replacement chars) before the Exif marker — it is CORRUPT in the workspace and unreferenced by any code. Left untouched; needs a clean re-export from the design source.
- **Audit findings (kept, no premature optimization)**: fonts already self-hosted woff2 (`font-display: swap`, latin + latin-ext); lucide-react icons tree-shaken per-file (146 files); zero unused-import lint errors; 101 lazy routes in `app/routes.ts`; heavy vendor chunks (charts 127 KB gz, pdf 145 KB gz) already manual-chunked AND excluded from entry preload in `vite.config.ts`; PropertyDetail (876 lines) is a lazy route chunk (43.7 KB gz) — splitting further is cosmetic; React Query 30s staleTime + route prefetch already in place; LazyImage exists for lists (PropertyCard/PropertyTableRow use `loading="lazy"`).
- **Numbers**: entry `index-*.js` 151.1 KB / 44.1 KB gz (unchanged); CSS 230 KB / 31.9 KB gz (unchanged); logo payload 14.5 KB → 1.0 KB (1.8 KB on 2x displays). Precache 810.89 KiB.
- **Remaining bottlenecks — resolved in Phase 12 (2026-08-25)**:
  1. **230 KB CSS** — verified correct as-is. Tailwind v4 already purges to used utilities; 31.9 KB gz single sheet is the cache-optimal shape (splitting fragments caching). No change.
  2. **vendor-charts (127 KB gz)** — now split further: `MaintenanceBudgetDashboard` (recharts consumer inside the collapsible "Reports and budget" details on the manager Maintenance page) is `React.lazy` + `Suspense`, so recharts is no longer pulled by the Maintenance route chunk. Maintenance route 44.98→38.14 KB (11.13→10.15 KB gz); budget dashboard is its own 8.51 KB chunk loaded on expand. All other recharts consumers are already lazy routes/components (RevenueChart/OccupancyChart lazy in Dashboard; landlord/webhost pages are lazy routes).
  3. **Corrupt `calqulus-banner.jpg`** — diagnosed: the file is UTF-8 replacement-character mangled (133,602 `EF BF BD` sequences, zero `FF D8`/`FF D9` markers) — it is NOT a recoverable JPEG, it was corrupted by a text-encoding round-trip somewhere upstream. Unreferenced by any code; **deleted** (git history retains it if a clean re-export ever replaces it).
  4. **Flaky `resendVerification.test.tsx`** — root cause: "does not start a cooldown when the send fails" asserted the button was enabled immediately after the mock resolved; the failed-send path (catch → errorToast → finally setIsSending(false)) spans extra microtasks, so under full-suite CPU contention the assertion raced the finally block. Fixed test-side (component logic was already correct): final assertion wrapped in `waitFor`. Verified: 6/6 consecutive full-suite runs green (was failing ~2/3).
- Gates: unit 1148 passed / 1 skipped (6 consecutive full runs); E2E (a11y + responsive) 25 passed; lint 0 errors; typecheck + build clean.
- **Remaining-bottlenecks review (Phase 12b, 2026-08-25)**: (1) **230 KB CSS stays** — verified with an actual lightningcss re-minify of the built sheet: 229,975→234,262 bytes (gz 32.0→32.1 KB, WORSE). Tailwind v4's own Oxide minifier is already optimal and lightningcss rewrites modern color syntax; 60 "unreferenced" custom properties are false positives (read at runtime by `deriveBrandPalette` etc.). Splitting still rejected (fragment caching). (2) **vendor-charts waterfall removed on the manager dashboard**: `RoutePrefetcher` warms `import("@/features/dashboard/components/RevenueChart")` via `requestIdleCallback` (timeout 2000) with a 500 ms `setTimeout` fallback — the lazy chart mount then finds the chunk cached instead of starting a network fetch after stats arrive. Startup never blocked; other routes untouched (vendor-charts still absent from the entry modulepreload list). (3) Still no Lighthouse-chasing changes. Locked by `src/test/chartWarmup.test.ts` (4). Suite: 1152 passed / 1 skipped.
- **Public icon sweep (Phase 12c, 2026-08-25)**: `public/pwa-512x512.png` 24.1→10.3 KB, `pwa-192x192.png` 8.8→3.6 KB, `apple-touch-icon.png` 8.2→3.7 KB — palette-quantized PNG re-encode via sharp (mean channel diff 0.008 vs original, visually identical, dimensions/alpha preserved). Unreferenced duplicate `public/calqulus-logo-new.png` (byte-identical to old pwa-512) deleted. Manifest maskable safe zone verified: the navy tile bleeds to edges while the CI mark sits at ≥26.6% padding (spec needs 10%). Precache 811.15→764.70 KiB (-46.4 KiB, -1 entry).

## Tenant Portal Entry Redesign (Phase 4: Tenant, 2026-08-26)
- `/tenant/login` rebuilt on NEW `TenantPortalChrome.tsx` (TenantPortalShell + TenantHomePreview + internal PortalSwitcher/CompactPortalFooter) — residential home-service entry: navy-deep + residential photo at 20% under navy veil, TENANT PORTAL eyebrow, "Your home, connected.", 5-item capability strip (Rent/Payments/Maintenance/Lease/Property services, small cyan icons), white auth card ("Welcome home." / "Sign in to manage your home and property services."), ILLUSTRATIVE TENANT VIEW preview (Kilimani Court Apartment 3B → KES 35,000 due 01 Sep UPCOMING → 1 open request → Lease active), "Need something fixed?" + "Secure tenant access" lines, 4-portal switcher with Tenant visibly selected (aria-current, cyan chip). All auth logic (handlers, biometric, ensureSignedInRole, Forgot dialog, both invitation paths) preserved verbatim; no backend change; TenantAuth/TenantSelfRegister untouched.
- **Accent**: cyan `#0284C7` identity + `#0369A1` for small text on light surfaces (axe: #0284C7 = 4.09:1 < 4.5). New `btn-tenant` CSS utility in index.css. `TenantDeskPreview.tsx` deleted; dead `PortalAuthShell`/`OtherPortalsGrid`/`AuthLegalFooterLinks` removed from `AuthHeroChrome.tsx` (AuthLoadingScreen + types kept for RegisterExperience). Tests: `agencyTenantAuthShell.test.tsx` removed → `tenantAuthShell.test.tsx` (7). Stale e2e updated (app.spec tenant hero; a11y.spec tenant heading).
- **Sandbox QA gotcha**: with `DISABLE_HMR=true` the vite watcher is off and transforms go stale — restart the dev server after edits; always run with `VITE_ENABLE_DEV_ACCESS=false` to see the real login page.
- Gates: lint 0 errors (11 pre-existing warnings) · tsc clean · unit 1171 passed / 1 skipped · build clean (precache 764.53 KiB) · axe 0 violations · 0px overflow 1440→375 · all links/keyboard verified.

## Master Homepage Implementation (2026-08-25)
- **Approved design reproduced faithfully; structure trimmed to the approved compact order**: Hero → "Everything you need. One workspace." (8 capability tiles) → "Built for every property." (3 photo cards) → "One system. Every role." (compact role strip) → "One property. Every operation." (8-step lifecycle) → compact trust row → deep-navy final CTA. **Removed surplus sections**: PropertyCarousel (sample portfolio cards), ProductShowcase (finance/maintenance alternating rows) and their config (`PORTFOLIO_PROPERTIES`, `SHOWCASES`) + `PropertyOperationsVisual`/`FinancialOperationsVisual`/`MaintenanceVisual` — the full dashboard now appears exactly once (hero), per spec.
- **Approved message hierarchy**: eyebrow "Property operations, connected" / h1 "Run your properties. Without the chaos." / sub "CALQULUS brings properties, tenants, leases, billing, payments and maintenance into one focused operational system." CTAs: "Start managing" → `/auth?tab=signup`, "See how it works" → `#how-it-works`. Final CTA: "Ready to run your portfolio with more control?" + Get started / Sign in on deep navy.
- **Real Kenyan property photography** (Unsplash License, locally bundled WebP via sharp, 960×640 cover-cropped): `src/assets/marketing/property-{residential,commercial,office}.webp` + 480px thumbs (hero env + preview card + CTA). Sources: The Alma Nairobi + Nairobi development (Cytonn Photography), Nairobi high-rise (Isaac Mugwe). Registry: `src/features/marketing/propertyImages.ts`. `ArchitecturalSurface` now accepts `imageSrc` + `loading` — CSS skyline remains the fallback. ~274 KB total, all lazy except the 23 KB eager hero thumb.
- **Homepage role accents** (`HOMEPAGE_ROLE_ACCENTS` in publicConfig): Manager #2F6FED, Landlord #0F8A6A, Agency #0F766E, Tenant #0284C7 — deliberately distinct from in-app portal accents; used ONLY as 3px top bars + small icon tiles on the role strip (navy + white carry the page).
- **Collections chart polished**: shared `CollectionsChart` in ProductPreview — rounded-top bars, latest week solid primary with % label, W1–W7 ticks, hairline grid.
- **Tests updated to lock the approved design**: `publicLanding.test.tsx` (hero hierarchy, role-strip routes, compact structure, removed-sections-stay-gone, single dashboard visual, navy CTA) and `e2e/homepage-executive.spec.ts` (new h1 + footer tagline "Run every property from one place.").
- **E2E environment note**: full `npx playwright test` (217 chromium tests) has 61 pre-existing failures in this sandbox at baseline — IDENTICAL failure set with these changes (diff-verified, only the renamed spec title differs). Playwright's webServer runs with dev access ON, so `/` renders the manager dashboard, not the landing page — homepage/a11y specs fail environmentally, not from code. For visual QA of the public homepage run `VITE_ENABLE_DEV_ACCESS=false npm run dev`.
- Gates: lint 0 errors/11 warnings · tsc clean · unit 1151 passed/1 skipped · build clean · desktop 1440px + mobile 390px screenshots verified.

## Homepage Visual Polish — approved-design alignment (2026-08-25)
- **Replication, not redesign**: the structure and message hierarchy stay exactly as approved; this pass only elevates imagery/graphs/typography/spacing/icons/micro-interactions and trims clutter. Net diff −64 lines ("communicate more with less").
- **Header**: primary nav trimmed to the approved set — Platform / Solutions / Pricing (+ Sign in / Get started). "How it works" and the Resources dropdown removed from the header (hero secondary CTA still anchors `#how-it-works`).
- **Footer**: columns are now the approved four — Platform / Solutions / Company / Legal (Resources column removed); bottom bar keeps copyright + English (KE) only.
- **Icon language (spec §12)**: Properties=Building2, Units=LayoutGrid (grid), Tenants=Users, Leases=FileText (document), Billing=Receipt, Payments=CreditCard (payment), Maintenance=Wrench, Reporting=BarChart3 — applied to capability tiles + lifecycle + preview mini-sidebar. Role strip icons: Manager=LayoutDashboard, Landlord=TrendingUp, Agency=Users, Tenant=Home.
- **Collections chart polish (ProductPreview)**: fixed-height bar area with real percentage heights, hairline grid, per-column axis line, latest value in a pill, hover deepen on history bars; property summary now carries an occupancy chip (92% = 22/24 units) + subtle image zoom; mini-sidebar billing icon now Receipt.
- **Micro-interactions**: PropertyTypeSlider images get a restrained `group-hover:scale-[1.045]` 700 ms zoom (motion-safe only); role strip "visual" sub-line shortened so it never truncates ("Property operations, end to..." bug fixed); lifecycle note "Onboard with invitations" → "Invite and onboard" (no more ellipsis at lg grid).
- **Tests updated to lock the approved trim**: `publicConfig.test.ts` (nav = Platform/Solutions), `publicLanding.test.tsx` (nav order). Suite: 1151 passed / 1 skipped; lint 0 errors (11 pre-existing warnings); tsc clean; build clean (precache 763.04 KiB). Responsive verified via playwright-core + system chromium: 0 px horizontal overflow at 1280/768/390, zero console errors, all links internal/hash/mailto. E2E full suite still environmentally blocked in this sandbox (no Playwright browsers preinstalled).

## Final Frontend Certification (Phase 12 QA, 2026-08-25)
- Full audit report: `FRONTEND_FINAL_QA.md` — **VERDICT: PASS** (one product; zero failures).
- Fixed in-phase (colour consistency only, no redesign): webhost `BillingAnalytics.tsx` + `PropertyTypeAnalytics.tsx` chart internals still carried a dark-mode leftover (#1e293b tooltips, bright purple #7c3aed border, #374151 grids, #9ca3af ticks) on white cards → converted to the token convention (`hsl(var(--card|border|muted-foreground|foreground))`) every other chart already uses.
- Known non-blocking warnings (documented, need product decision — do NOT "fix" silently): ReceiptSettings default receipt colour `#22c55e`; PropertyCollectionStatement Excel-mimic palette (document renderer); BillingAnalytics `text-warning` decoration; manager-facing pg_cron hint with `<SERVICE_ROLE_KEY>` placeholders in RentCollectionSummary; 🎉 in M-Pesa success toast; 11 pre-existing eslint warnings.
- Gates at certification: lint 0 errors · tsc clean · 1152 passed / 1 skipped · E2E 25 passed · build clean (precache 764.70 KiB).

## Responsive + Accessibility Certification (Phase 10, 2026-08-25)
- **Verified, not redesigned**: the existing certification suites were run and extended. `e2e/responsive-certification.spec.ts` now covers all 8 required widths (1920/1440/1280/1024/768/480/390/360) across 11 design-preview portal screens + 5 login pages (zero horizontal overflow), dialogs inset at 360px, and **tenant touch targets Ōēź44px** asserted at Ōēż480px. `e2e/a11y.spec.ts` runs axe (wcag2a/aa, critical+serious = 0) on homepage/design-preview/all 5 logins + skip-link keyboard focus + dialog labelling + table column headers.
- **Fixes (all axe-flagged colour contrast on the public homepage)**: `PublicFooter` `text-white/68`ŌåÆ`/75` (tagline) and `text-white/48`ŌåÆ`/75` (legal bar) ŌĆö footer bg is mid-navy `#31577E`, not deep navy. `PortalExperiences` "View portal" links now mix accent 50% (was 72%) with navy-deep ŌåÆ Ōēź4.5:1 on the tinted card backgrounds for every portal accent. `DesignPreview` swatch list keyed by `label` (was `hex` ŌĆö navy-deep/navy-mid share `#31577E`, duplicate key warning).
- **Already conformant, kept**: `prefers-reduced-motion` global kill-switch in index.css; Button min-h-11 default (44px touch); Table `overflow-x-auto` (no 10-column squeeze); status never colour alone (dot+icon+text, statusBadge tones); dialog focus management via Radix.
- Results: E2E chromium 91 passed / 116 skipped (credential-gated); unit 1148 passed / 1 skipped; lint 0 errors; typecheck + build clean. Note: `resendVerification.test.tsx` "does not start a cooldown when the send fails" is flaky under full-suite parallelism (passes in isolation, passes on re-run) ŌĆö not Phase 10 related.

## Component Quality Audit (Phase 9, 2026-08-24)
- **Audit answer: the kit is the standard.** `ui/button` (primary/destructive/outline/secondary/ghost/link + loading), `ui/field` (label/helper/error anatomy on `CALQULUS_FIELD`), `ui/badge` semantic tones + `lib/statusBadge.ts` tone mappers, `ui/table` (label headers, hover, `data-[state=selected]`), `ui/empty-state`/`ui/error-state`/`ui/loading-state`, `ui/search`, `ui/pagination` + `ui/table-pager`, `ui/card`. Icons: lucide-react only, sizes via `CALQULUS_ICON` tokens.
- **Duplication removed**: 14 feature screens rendered raw `py-12 text-center` empty blocks. Converted to shared `EmptyState` (Services, Marketplace, VacationNotices, PropertyCollectionStatement, ActivityLog, ManagerManagement, SystemLandlordManagement, LandlordBilling, RentCollectionSummary, LandlordLinksManager, TenantInbox, TenantPortableHistory, ManagerPaymentHistory, ManagerPlatformBilling). TenantInbox error path ŌåÆ shared `ErrorState` with real `refetch` retry. Markup-only; no query/API changes.
- **Locked by test**: `src/test/componentAuditPhase9.test.ts` (14) ŌĆö button hierarchy, Field anatomy, statusBadge tones + badge variants, table chrome, converted screens, single icon family, no second library (MUI/AntD/Chakra/react-icons/iconify banned). Suite: 1148 passed / 1 skipped; lint 0 errors (11 pre-existing warnings); typecheck clean; build OK.

## Admin + WebHost Desk (Phase 8, 2026-08-24)
- One security model, two identities on `/webhost`: **control-plane** (WebHost ŌĆö teal accent, Applications/Deployments/Domains/Services/Health/Logs) and **admin** (platform control ŌĆö indigo accent, Organizations/Users/Subscriptions/Audit/Security). `webhostSurface(pathname)` + `ADMIN_SURFACE_ACCENT` in `lib/webhostPaths.ts`; `--calqulus-indigo: #4658C9` token in index.css. WebhostLayout applies `--portal-accent` override on admin surfaces + breadcrumb "WebHost ŌĆ║"/"Admin ŌĆ║".
- **Sidebar grouped**: CONTROL PLANE / ADMINISTRATION / ACCOUNT (`NAV_GROUPS` in WebhostLayout).
- **Secrets fix**: `ActivityLog` + `SecurityAuditLogs` previously rendered raw `JSON.stringify(metadata)` ŌĆö now use `stringifyMasked` from `lib/secrets.ts` (table cells, detail dialog, and search filter). `ErrorLogsTab` now imports shared `isSecretKey` (duplicated regex removed).
- Status vocabulary Operational/Warning/Degraded/Down with dot + icon + text (never colour alone) was already correct via `ServiceStatusCell` ŌĆö locked by test.
- Authorization untouched: all `/webhost/*` routes still `protected: true`; WebhostPermissionGate gates (`can_manage_managers`/`can_manage_billing`/`can_view_activity_logs`) unchanged; guest users see "You do not have permission".
- Tests: `src/test/adminWebhostPhase8.test.ts` (17) ŌĆö indigo/teal tokens, surface split, nav groups, masked viewers, canonical statuses, routes still protected, no fabricated deployments. Suite: 1134 passed / 1 skipped.

## Tenant Service Portal (Phase 7, 2026-08-24)
- Tenant stays a service portal, never an enterprise dashboard. Answers: where do I live, what do I owe, when is it due, can I pay, do I have a maintenance issue, where are my documents.
- Header (`TenantLayout`): CALQULUS wordmark + Notifications (`TenantNotificationBell`) + Profile link. Header cluster shows whenever `userRole` resolves (dev guest has role without `user`).
- Home (`TenantHome`): greeting ŌåÆ Your home (property/unit) ŌåÆ Amount due + due date ŌåÆ dominant full-width **PAY RENT** painted with portal accent violet (`bg-[var(--portal-accent)]`), then shortcut row + recent activity. No charts/KPI grids/filters; single column `max-w-xl`.
- Mobile nav labels: Home/Bills/Fix/Docs/Me ("Bills" renamed from "Pay").
- Maintenance (`TenantMaintenance`): full-width "Report a problem" first, then Active/Past lists with issue/unit/status/date/updates.
- Payments (`PaymentHistory` + `TenantBillsHub`): amount/due date/status/history/receipt; removed manager-facing copy ("Manager keys plug in at Settings ŌåÆ Payments").
- Tests: `src/test/tenantPortalPhase7.test.ts` (13) ŌĆö nav, header, PAY RENT accent, no charts, report-primary maintenance, payments columns, no manager internals, service-only routes. Older `responsiveCertification.test.ts` contract updated to new PAY RENT / Bills strings. Suite: 1117 passed / 1 skipped.

## Onboarding Completion + Activation (Phase 10, 2026-08-24)
- **Audit**: Manager/Landlord/Agency onboarding pages each had a thin "complete" step (single check icon + one line + dashboard button). Facts were already real backend queries ŌĆö kept.
- **Shared completion experience**: `src/features/onboarding/components/OnboardingCompletion.tsx` + pure model `src/features/onboarding/lib/completion.ts` (`buildCompletionModel`, per-role `*CompletionItems` + `*Recommendations`).
- **Reflects ACTUAL backend state ŌĆö never a false checkmark**: each item's `done` comes from real facts (company_settings.company_name, properties count, property_landlords client links, portfolio draft, verifiedEmail). Incomplete items render "Needs attention ŌĆö what remains" in a warning row. Success ring is green only when `allDone`, primary/accent otherwise. No confetti, no excessive animation; navy+white card, role accent inherited from the portal surface.
- **Per role**: Manager ŌĆö Account created / Email verified / Organization created / Portfolio configured / Property added ŌåÆ "You're ready to run your properties." Primary "Open Manager Dashboard" (`/`), secondary "Add another property" (`/properties`); recs: Add tenants, Configure billing, Invite your team. Landlord ŌĆö Account/Profile/Property linked ŌåÆ `/landlord/dashboard` + `/landlord/portfolio`. Agency ŌĆö Account/Agency profile/Portfolio/First client/First property ŌåÆ `/agency` + `/agency/properties`; recs prioritize missing client/property.
- **Recommendations capped at 3** in `buildCompletionModel` ŌĆö never a giant checklist; missing-item actions prioritized first.
- Tests: `src/test/onboardingCompletion.test.ts` (14) ŌĆö allDone only when verified, no false checkmarks, attention copy, 3-rec cap, per-role facts mapping + route prefixes. Suite: 1063 passed / 1 skipped.

## WebHost Operator Onboarding (Phase 9, 2026-08-24)
- **Audit**: WebHost is NOT public registration ŌĆö verified no `webhost/signup|register` route exists anywhere in `routes.ts`. Phase 8 flow extended to full operator tier; Phase 8 gap closed: accepted admins previously got `user_roles` + `admin_permissions` but NO `platform_admins` row (no operator tier).
- **Migration `20260824000003_webhost_operator_phase9.sql`** (mirrored into `apply-live-p1-rpcs.sql`): `admin_invitations.admin_type` (`business|admin` CHECK ŌĆö **'owner' can never be granted via invitation**; exactly one immutable owner). `validate_admin_invitation_token` re-created to also return `admin_type` (DROP + CREATE required for return-type change). **Must be applied to live DB.**
- **send-admin-invitation**: accepts `adminType` (`'business'` else defaults `'admin'`), persists on invitation, audit metadata includes tier.
- **accept-admin-invitation**: seeds `platform_admins` server-side (tier from invitation, never client; `is_immutable: false`; business ŌåÆ can_create_admins/billing/platform_settings) + aligns `admin_permissions` (`business` ŌåÆ `admin` level + billing/webhost creation; `admin` ŌåÆ `limited_admin`). platform_admins upsert is safe under service_role (no FORCE RLS on the table).
- **UI**: `/webhost/invite` card now shows "Operator access: Business/Admin operator" (`adminTierLabel` helper in `adminInvitation.ts`).
- **Secrets hygiene verified**: `lib/secrets.ts` (`isSecretKey`/`maskSecrets`/`stringifyMasked`) + `getNonSecretConfig` (infrastructure.ts) ŌĆö no credential-shaped key or value reaches any screen during onboarding or ops views.
- **Session expiry**: Supabase Auth handles expiry; `AuthContext` resolves via getSession/getUser + onAuthStateChange/SIGNED_OUT; `WebhostAuth` re-verifies via `ensureSignedInRole(['webhost'])` server-side on every login; all webhost routes `protected: true` in the webhost roleRouteConfig only.
- Tests: `src/test/webhostOperatorOnboarding.test.ts` (20) ŌĆö no public signup route, no client role/tier params, owner-ungrantable, platform_admins server-side seeding, secrets masking (10 credential key shapes + getNonSecretConfig), session expiry handling, unauthorized access (manager config has no webhost components). Suite: 1049 passed / 1 skipped.
- **Deploy note**: paste Phase 9 SQL into live SQL Editor; redeploy `send-admin-invitation` + `accept-admin-invitation`.

## Admin Invitation Flow (Phase 8, 2026-08-24)
- **Audited first ŌĆö no public admin registration exists or was added.** Existing admin auth kept: `WebhostAuth.tsx` (login-only, `ensureSignedInRole(['webhost'])` server re-check) + `platform_admins` hierarchy (owner/business/admin, RLS, immutable-owner trigger) + `admin_permissions` + `bootstrap-webhost` (one-time, dev-only, service-role+secret gated) + `protect_user_roles_changes()` trigger (blocks self-assign of webhost/platform_admin).
- **Gap closed**: `WebhostManagement.createWebhost` previously did client-side `signUp` + direct `user_roles` insert + plaintext password in a form. Now invitation-first: `send-admin-invitation` (webhost-only via middleware + owner/business/super_admin permission, audit-logged, supersedes pending invites, refuses emails that already hold webhost) creates an `admin_invitations` row (secure UUID token, 72h expiry, single-use, RLS webhost-only) and emails `/webhost/invite?token=ŌĆ”`.
- **Acceptance** (`accept-admin-invitation`, service-role): token is the credential ŌĆö never a client-supplied role. Invitee sets own password (Ōēź10 chars, never seen by the inviter); auth user bound to the invited email with `email_confirm: true` (identity verified); role granted server-side as fixed `'webhost'`; baseline `admin_permissions` = `limited_admin`; mark-used atomic (`status='pending'` guard); idempotent already-claimed success via `user_roles`; audit-logged.
- **Migration `20260824000002_admin_invitation_phase8.sql`** (mirrored into `apply-live-p1-rpcs.sql`): `admin_invitations` table + `validate_admin_invitation_token` (pending+unexpired only, inviter_name) + PII-free `admin_invitation_token_state` (pending/expired/used/revoked/invalid). Both RPCs granted to anon+authenticated. **Must be applied to live DB.**
- **UI**: `/webhost/invite` ŌåÆ `AdminInviteAccept.tsx` ŌĆö CALQULUS ADMIN branded (platform_admin/teal surface, restricted badge), invitation card (Admin email + Invited by only), invitee password setup, MFA nudge on success, distinct expired/used/revoked/invalid screens. Route registered in all public lists + webhost role config + adminDomainRoutes. `WebhostManagement` dialog now "Invite CALQULUS ADMIN" (no password field, no permission editor at creation ŌĆö elevation after acceptance).
- Pure helpers in `src/features/auth/lib/adminInvitation.ts` (state mapping, email match, Ōēź10-char password bar, summary builder ŌĆö never token/status).
- Tests: `src/test/adminInvitation.test.ts` (28) ŌĆö valid/invalid/expired/used/revoked tokens, unauthorized email, Ōēź10-char password bar, refresh+back stability, summary builder, plus static server-side security invariants (server-side role grant, no client role param, atomic mark-used, audit logging, webhost-only issuance, RLS, no public admin signup route). Suite: 1029 passed / 1 skipped.
- **Deploy note**: redeploy edge functions `send-admin-invitation` + `accept-admin-invitation`; paste migration into live SQL Editor.

## Tenant Invitation + Registration (Phase 7, 2026-08-24)
- **Audited first ŌĆö no parallel system added.** Live flow stays: `tenant_invitations` + `validate_invitation_token` RPC + `send-tenant-invitation` + `create-tenant-account` + `/tenant/invitation` ŌåÆ `TenantAuth.tsx`. Legacy `tenant_invites`/`accept-tenant-invite` edge function is unused by the app ŌĆö left untouched.
- **Server is now authoritative** (`create-tenant-account` `invitationToken` path): token is the credential (not caller role ŌĆö fixes the 401/403 invited tenants hit post-signUp). Property/unit/manager/rent resolved from the invitation row server-side; client-supplied IDs ignored. Auth user email must match the invited email (`invitation_email_mismatch`, 403). Expired ŌåÆ 410 `invitation_expired`; used ŌåÆ 410 `invitation_used` unless the same user already claimed (idempotent summary via `user_roles.tenant_id` ŌĆö refresh/back-safe). Mark-used is server-side, guarded by `status='pending'`.
- **Migration `20260824000001_tenant_invitation_phase7.sql`** (mirrored into `supabase/sql/apply-live-p1-rpcs.sql`): `validate_invitation_token` now returns `inviter_name` (company_settings.company_name ŌåÆ profiles.full_name ŌåÆ 'Your property manager') + `phone`; new PII-free `invitation_token_state(token)` ŌåÆ pending/expired/used/invalid. Both granted to anon+authenticated. **Must be applied to live DB before the new UI works.**
- **TenantAuth invitation flow**: "You're invited to access your property account." + Property/Unit/Invited-by card (org name only ŌĆö manager email/phone no longer fetched or shown to token holders). Email read-only (pre-associated). Distinct expired/used/invalid screens via `invitation_token_state`. Post-signup: session ŌåÆ confirmation screen (Property/Unit/rent/deposit from server summary) + "Enter Tenant Portal"; no session ŌåÆ verification screen (previously dead code, now wired). Self-registration (accounting mode) unchanged.
- Pure helpers in `src/features/auth/lib/tenantInvitation.ts` (state mapping, email match, summary builders ŌĆö lease figures only when set, never fabricated).
- Tests: `src/test/tenantInvitation.test.ts` (21) ŌĆö valid/expired/used/invalid tokens, wrong-email binding, refresh+back stability, summary builders, plus static security invariants on the edge function + migration. Suite: 1001 passed / 1 skipped.
- **Deploy note**: edge function `create-tenant-account` must be redeployed; migration must be pasted into the live SQL Editor.

## Agency Onboarding (Phase 6, 2026-08-24)
- `/agency/onboarding` rebuilt on **AgencyLayout** (navy + white desk, 2px cyan `#0F766E` accent bar, cyan only on small icons ŌĆö never fills). Previously it mounted the generic manager `Layout` (blue accent, wrong sidebar).
- Journey (8 steps, locked by test): Account ŌåÆ Verification ŌåÆ Agency profile ŌåÆ Portfolio setup ŌåÆ First client ŌåÆ First property ŌåÆ Team ŌåÆ Complete. Steps in `src/features/onboarding/components/agency/AgencyOnboardingSteps.tsx`.
- **Portfolio setup** (new step): portfolio focus (residential/commercial/mixed) + default collection model ŌĆö options are a strict subset of real `property_landlords.operating_model` values (`agency_collects_full_management`, `agency_collects_pays_landlord`, `agency_manages_fee_from_landlord`). Persisted to `company_settings.brand_config.onboarding.portfolio` via read-modify-write (`saveOnboardingConfig` in the page; never clobbers `firstClientName` or `company_name`). Optional ŌĆö "Skip for now".
- **First client**: architecture links clients per property (`property_landlords`), so onboarding saves the owner name as a draft note (`brand_config.onboarding.firstClientName`) and points to `/agency/clients`. "Skip for now" allowed.
- **Team**: optional invite via `supabase.auth.signUp` (submanager role, manager_id = agency user).
- Completion derived from real facts only (`deriveAgencyCompletedSteps` pure helper): `company_settings.company_name` ŌåÆ profile, portfolio draft ŌåÆ portfolio, `property_landlords` count ŌåÆ clients, `properties` count ŌåÆ property. account/verification/team/complete are navigation steps ŌĆö never auto-completed.
- **Entry point**: `AgencyDashboard` shows a "Finish setting up your agency" banner when the book is empty (0 clients, 0 properties).
- Profile name now prefills from `company_settings`; Back buttons actually go back (`goBack`), not forward.
- Tests: `src/test/agencyOnboarding.test.ts` (11) ŌĆö journey order, unique ids, route registration, operating-model alignment, draft parsing, completion mapping, amber token lock. Suite: 980 passed / 1 skipped.

## Webhost Operations (Phase 3, 2026-08-23)
- New route `/webhost/operations`: Domains (real domain+protocol, SSL=protocol uppercase, expiry "Not available"), Monitoring (healthy/warning/degraded/down counts from probes), Services (probe states + `dataUpdatedAt` as last check), Logs (dense mono table from `activity_logs` where `entity_type='log'`).
- Structured logs are written by the observability logger as `{level}:{component}:{action}` with the LogEntry in `metadata`. Parsed in `lib/operations.ts`; non-structured rows are dropped, never fabricated. Live logs only persist when a session exists.
- `lib/secrets.ts` (new shared): `isSecretKey` regex lifted from ErrorLogsTab; `maskSecrets`/`stringifyMasked` always redact secret-shaped keys before display. Reuse it for any log/audit viewer.

## Webhost Infrastructure Control Center (Phase 1, 2026-08-23)
- `platform_admin` portal accent is now **Teal** (`#2C9183`, CSS var `--calqulus-teal-deep`; lighter step `--calqulus-teal: #3BB7A6`). Tests assert this value.
- `AdminDashboard.tsx` = infrastructure control center: navy system-status band (worst-of probes), compact stat strip, Service health table (Operational/Warning/Degraded/Down from `lib/infrastructure.ts`), Applications table (real build/runtime facts), Alerts + Infrastructure activity from `activity_logs` (tenant firewall via `withoutTenantEntities`), Users & access strip.
- **No invented hosting data**: deployments, servers, DNS, and SSL certs have no runtime source ŌĆö the page states they are not instrumented. `DeploymentReleaseManager` (shared/components/ops) is hardcoded fake UI ŌĆö do not mount it.
- Status mapping: healthyŌåÆOperational, degradedŌåÆDegraded, unhealthyŌåÆDown, unavailableŌåÆWarning. Pure helpers in `src/features/webhost/lib/infrastructure.ts` (tested in `adminDesk.test.ts`).

## Frontend Refinement Phase 5 ŌĆö Landlord Portal (2026-08-24)
- **Identity**: white + deep navy foundation; emerald `#2F9B74` sparingly ŌĆö 2px `PortalAccentBar`, navy summary band stripe/label, "Net" chart bars only. Nav active stays blue wash (`deskNavClass`), status colors stay semantic.
- **Pure model** `src/features/landlord/lib/portfolioMetrics.ts`: `collectionRate` (0 when nothing billed, capped 100), `netShare`, `arrearsTone` (money is neutral; only arrears>0 ŌåÆ destructive), `buildAttentionItems` (arrears ŌåÆ maintenance ŌåÆ payouts ŌåÆ leases), `LANDLORD_TREND_COLORS` (collected=navyPrimary `#173650`, net=emerald; **never success green for money**), `LANDLORD_PROPERTY_TABS` = performance ŌåÆ units ŌåÆ maintenance ŌåÆ documents (no tenants tab ŌĆö PII firewall).
- **Dashboard** (`LandlordDashboard.tsx`): deep-navy "Your portfolio" summary band (collected-vs-billed emerald progress + Net-to-you figure) + 6-cell divide-x stat strip (Properties, Units, Occupancy, Collection rate, Outstanding, Net to you) ŌĆö deliberately NOT the manager StatCard grid. Then Attention, Income & collection trend, Recent transactions, Property performance, Activity.
- **Portfolio** (`LandlordPortfolio.tsx`): same totals strip above property cards; net share neutral semibold.
- **Property detail** (`LandlordPropertyDetail.tsx`): performance-first tabs; new Documents tab queries `landlord_documents` by `property_id` + `is_visible`; fixed chart legend bug (both swatches were `bg-success`) and wrong `hsl(var(--teal))` fill (teal is platform-admin identity).
- **Doc type map** moved to `lib/documentTypes.ts` (fast-refresh rule); `LandlordDocuments` download href fixed to `file_url ?? document_url`.
- **Financial statement**: net/balance figures no longer `text-success`; 6-month net bar uses emerald accent.
- Tests: `src/test/landlordPortalPhase5.test.ts` (18) ŌĆö pure helpers + source invariants (no `text-success` money, no manager actions on dashboard, no tenant PII fields in detail). Suite: 1090 passed / 1 skipped. Preview verified on dev server port 12000 (empty states ŌĆö no Supabase env in sandbox).

## Frontend Refinement Phase 6 ŌĆö Agency Portal (2026-08-24)
- **Identity**: navy + white with cyan sparingly (portal accent). Money is never green; the portal accent (cyan) is reserved for the attention status chip + thin performance bars + small icon accents (`text-[var(--portal-accent)]`); the chart "Outstanding" line uses the semantic warning hue, never success green.
- **Pure model** `src/features/agency/lib/agencyPortfolio.ts`: `agencyClientStatus` (pending ŌåÆ invitation pending; outstanding>0 ŌåÆ attention; else active), `agencyClientStatusChipClass` (portal accent only for attention; active/pending neutral ō **never success green**), `agencyCollectionRate(collected, outstanding)` (0 when nothing billed), `buildAgencyAttentionItems` (arrears ŌåÆ leases ŌåÆ unlinked), `AGENCY_TREND_COLORS` (navy-mid collected / warning amber outstanding), `AGENCY_CLIENT_TABS` order (overview ŌåÆ portfolio ŌåÆ financial ŌåÆ maintenance ŌåÆ activity ŌåÆ documents).
- **Client detail**: new route `/agency/clients/:id` ŌåÆ `AgencyClientDetail.tsx` (status chip + email, six tabs; pending-invitation synthesised IDs `pending:<propertyId>` resolve to the single building). Documents tab queries `landlord_documents` by `manager_id` + `landlord_user_id` (RLS `manager_manages_landlord_documents` ŌĆö backend permissions unchanged). Activity tab reuses `ManagerActivityLog` (scoped `manager_id = auth.uid()`). Maintenance tab counts open requests across the client's buildings. Unknown client ID ŌåÆ "not linked to your agency" guard.
- **ManagerLandlords refactor**: link-management extracted to chrome-free `src/features/landlord/components/LandlordLinksManager.tsx`; `ManagerLandlords.tsx` page keeps manager `Layout` and delegates. **Fixes the nested-manager-Layout embed** on `AgencyClients` (manager sidebar rendered inside the agency desk whenever a client existed).
- **Clients table** per spec: Client / Properties / Units / Occupancy / Collections / Status; rows link to client detail. Plus the "Property links" section (LandlordLinksManager).
- **Portfolio**: totals strip (Properties, Units, Occupancy, Collected this month, Outstanding [destructive when >0], Clients) + performance-bar column (portal-accent width vs max collected) ŌĆö table-based, no card overload.
- **Dashboard**: stat strip (Clients, Properties, Units, Occupancy, Collections) ŌåÆ Needs attention (arrears/leases/unlinked + open maintenance count) ŌåÆ Portfolio activity chart (navy collected vs amber outstanding + legend) ŌåÆ Client portfolio performance ŌåÆ Property performance (top 5) ŌåÆ Recent activity.
- Tests: `src/test/agencyPortalPhase6.test.ts` (13) ŌĆö status mapping, portal-accent-only chip, collection rate, attention ordering, tab lock, route registration, no-nested-manager-Layout invariant, no `text-success`/`text-green` money. Suite: 1104 passed / 1 skipped; one pre-existing flake (`resendVerification` cooldown race) reproduces 1-in-5 on clean main ŌĆö unrelated.
- Previews captured: before (dashboard/clients/portfolio) and after (dashboard with property performance + recent activity, portfolio, client detail guard) on dev server port 12000 (empty states ŌĆö no Supabase env in sandbox).

## Key Decisions
- **Three-role architecture**: Webhost sells to three portal types ├óŌé¼ŌĆØ Manager (full ops+collections), Agency (blended agent role), Landlord (guarded standalone, no tenant PII).
- **Agency is a separate portal** at `/agency` with own login, sidebar, and dashboard. Manages properties on behalf of landlords (commission model) and/or collects rent directly.
- **Landlord split by `manager_id`**: `manager_id IS NOT NULL` = managed landlord (visible only to manager, webhost has zero visibility). `manager_id IS NULL` = system landlord (under webhost oversight).
- **Submanager is a role, not a portal**: Submanagers use the same manager dashboard with restricted permissions via `can()`/`canWrite()` hooks. Created by Manager or Agency Team Manager in Settings ├óŌĆĀŌĆÖ Team.
- **Manager-enters-all-data model** (no smartphone required for tenant): manager fills name, email, phone, property, unit, rent, deposit upfront. Tenant only accepts + sets password.
- **Phone on invitation**: `tenant_invitations.phone` column added, pre-filled in `TenantAuth.tsx`.
- **Payment flows**: Manager operates/landlord collects OR agency collects(pays landlord after commission) OR landlord self-managed ├óŌé¼ŌĆØ configured via `property_landlords.operating_model`.

## Mockup References
- `calqulus_authority_structure.html`: defines hard role hierarchy tiers, access URL map, firewall rules.
- `dashboard_previews.html`: shows Webhost sidebar (Overview, Managers, Properties, Billing, Tiers, Contracts, Security, Error Logs), Landlord property cards with occupancy bars, Tenant hero balance card.
- `calqulus_full_platform_v2.html`: exact Manager sidebar layout (Dashboard, Leases, Tenants, Invites, Vacation Notices, Billing, Water Billing, Statements, Maintenance, Reports, Settings) + Tenant portal nav (Home, Pay Rent, Maintenance, Documents, Vacation Notice).

## Next Steps
1. Paste `supabase/sql/apply-live-p1-rls.sql` then `apply-live-p1-rpcs.sql` into the live SQL Editor (file contents, never `_base_schema.sql`).
2. Deploy Edge Function `health-check` with `verify_jwt = false`.
3. Prove one invoice ŌåÆ payment ŌåÆ receipt on a demo account.
4. Confirm PITR is on before further live DDL.
5. Do not add lab/SOC2/ISO product surfaces.

## Relevant Files
- `src/features/webhost/pages/WebhostDashboard.tsx`: needs full rebuild ├óŌé¼ŌĆØ remove tenants, add unlinked landlords, match sidebar mockup.
- `src/features/landlord/pages/LandlordDashboard.tsx`: rebuild to show property cards with occupancy/revenue bars, no tenant PII.
- `src/shared/components/layout/Sidebar.tsx`: trim manager nav to match `calqulus_full_platform_v2.html`.
- `src/app/routes.ts`: block `/tenants` and `/portal` for webhost role.
- `src/features/properties/pages/Properties.tsx`: agency code already removed; manager property grid is flat.
- `src/features/landlord/pages/ManagerLandlords.tsx`: newly created ├óŌé¼ŌĆØ manage landlord links per property.
- `src/features/properties/components/PropertyAuthorityPanel.tsx`: operating model config (payment destination per landlord type).
- `src/features/landlord/components/LandlordTeamSettings.tsx`: submanager team mgmt.
- `src/shared/hooks/useRBAC.ts`: permission gating for submanager role.
- `src/features/auth/AuthContext.tsx`: role detection, `submanagerPermissions`.
- `supabase/migrations/20260523000000_operating_model_authority.sql`: operating model on `property_landlords`.
- `supabase/functions/send-tenant-invitation/index.ts`: stores `phone` on invitation, sends email/SMS/WhatsApp.
- `src/features/tenants/components/InviteTenantDialog.tsx`: accepts `preSelectedPropertyId` for property-scoped invites.

## Known Issues
- `manager_profiles` table created by migration 14 ├óŌé¼ŌĆØ NOT in `_base_schema.sql`
- `zod` v4 installed ├óŌé¼ŌĆØ `formatValidationErrors` uses `error.issues` (not `error.errors`)
- 8 outdated major deps remain: `tailwindcss 3├óŌĆĀŌĆÖ4`, `date-fns 3├óŌĆĀŌĆÖ4`, `react-day-picker 8├óŌĆĀŌĆÖ10`, `recharts 2├óŌĆĀŌĆÖ3`, `react-resizable-panels 2├óŌĆĀŌĆÖ4`, `eslint 9├óŌĆĀŌĆÖ10` + plugins
- E2E tests credential-gated via env vars
- `activity_logs` RLS requires `actor_id = auth.uid()` ├óŌé¼ŌĆØ direct inserts return 403; use `rpc('log_activity')` instead
- New migrations (`20260530000000_platform_admin_hierarchy.sql`, `20260530000001_customer_billing_blocks.sql`) must be run against Supabase project
- Platform admin accounts (owner/business/admin) need initial seeding in `platform_admins` table + `user_roles` + `admin_permissions`

## Vercel
- Auto-deploys from GitHub `main` branch
- `vercel.json` configures SPA rewrites + security headers
- CSP allows Supabase, Sentry, Stripe
- Production deploy is driven by `.github/workflows/deploy-production.yml` (NOT just Vercel auto-deploy): `deploy-vercel` job runs `vercel pull --yes` ŌåÆ `vercel build --prod --yes` ŌåÆ `vercel deploy --prebuilt --prod --yes`.
- **Required GitHub repo secrets for deploy to work:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (Settings ŌåÆ Secrets and variables ŌåÆ Actions). A `Verify Vercel secrets present` guard fails fast + names each missing secret before running the CLI. These secrets must ALSO be mapped into a step's `env:` block to be readable by `printenv` ŌĆö GitHub Actions does NOT auto-expose secrets as env vars.
- The deploy job writes `.vercel/project.json` from `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` so the project is linked in CI even without a committed `.vercel/`.
- `DEPLOY_URL` is exposed as a job output and used by the `health-check` job (with a ~90s retry loop); `environment.url` is set from it.
- **Vercel project env vars (dashboard):** `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` must be set on the Vercel project or `vercel build` produces an app that can't reach Supabase. `.vercel/.env.build` is populated by `vercel pull`.
- Once secrets are set, re-run the failed deploy job: `gh run rerun <RUN_ID> --repo Themugo/CALQULUS-PMS --failed`.

## CI/CD Audit (2026-08-10)
- **The app IS deploying successfully via Vercel's NATIVE GitHub integration.** Every push to `main` triggers a `vercel[bot]` "Production" deployment (GitHub Deployments API, creator=`vercel[bot]`) that completes. The GitHub Actions `deploy-production.yml` `deploy-vercel` job is **redundant** with the native integration and is the source of the "Vercel deploy failure" the user saw (it fails on missing `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` secrets, while native Vercel still deploys fine). Architectural decision needed: keep the Actions deploy (adds health-check/E2E/rollback + a `environment: production` approval gate) OR drop it and rely on native Vercel (simpler, no secrets needed).
- Deployments are behind **Vercel Deployment Protection** (Vercel Authentication): both preview and production `*.vercel.app` URLs 302ŌåÆ`vercel.com/sso-api` when curled without a bypass secret. Set a Protection Bypass secret (Vercel ŌåÆ Settings ŌåÆ Deployment Protection) for automated/CI access, or disable protection for production.
- The custom domain `www.calqulus.site` is LIVE and serves the production app (HTTP 200). The old `app.calqulusrms.com` domain does NOT resolve.
- `deploy-production.yml` Performance Audit (Lighthouse) job previously failed with `CHROME_INTERSTITIAL_ERROR` because it ran `npm run preview` without building first; now builds with placeholder Supabase env + readiness poll before Lighthouse.
- `monitor.yml` Deployment Monitor: all 7 jobs pass. `Performance Monitoring` and `Uptime Check` curl calls now target `https://www.calqulus.site` (live domain) with `--max-time`/`--connect-timeout` + `|| echo` fallbacks so a transient outage warns instead of aborting. `Rollback Health` has `actions/checkout` (was `fatal: not a git repository`).
- `dependabot-auto-merge.yml` `check-missed-prs` job had `if: github.event_name == 'schedule'` but no schedule trigger ŌåÆ always skipped. Added daily `schedule: 0 6 * * *` (PR #10) so the fallback actually runs.
- Local `npm run verify` (lint + typecheck + 578 tests + build + audit + audit:prod) passes end-to-end.
- `.vercel/project.json` is intentionally NOT committed (linked at deploy time from secrets OR by native integration).
- **Dev server port is 3000** (vite.config.ts `server.port: 3000` overrides Vite's 5173 default). `playwright.config.ts` webServer correctly uses 3000. The earlier "5173" note elsewhere is stale.
- `.env.example` was AI Studio/Cloud Run boilerplate (`GEMINI_API_KEY`, `APP_URL`); replaced with accurate Vercel+Supabase template (PR #11).
- App runtime is hardened: `client.ts` has placeholder detection + full Supabase noop-proxy fallback; `App.tsx` wraps in `ErrorBoundary`+`Suspense`; all 63 lazy-loaded routes resolve to real files; prod `dist/index.html` asset refs all exist. No white-screen risk with missing env.
- CSP/COEP headers in `vercel.json` don't break anything currently used (Google Fonts/GA are only preconnect/dns-prefetch hints, not actually loaded; Sentry is npm-imported in-page).

## Sentry
- DSN in `.env.local` (gitignored)
- Free Dev plan
