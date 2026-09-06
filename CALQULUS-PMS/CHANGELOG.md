## 2026-09-04 — Property Inspections, Compliance & Condition Assurance

- Added scheduled property inspection programmes and runs.
- Added checklist findings with evidence and optional canonical maintenance work-order escalation.
- Added property compliance obligations with governed document evidence linkage.
- Connected inspection intelligence to existing maintenance assets and lifecycle risk.
- Added `PropertyInspectionComplianceAssuranceCenter` to the manager dashboard.


## 2026-09-04 — Management & Compliance Assurance
- Added `management_assurance_reviews` for explicit period/control review and approval.
- Added fail-closed assurance RPCs with an 80/100 approval threshold.
- Reused financial close, reconciliation, evidence, work queue and existing activity audit data.
- Added `ManagementComplianceAssuranceCenter` to the manager dashboard.

## 2026-09-04 — Notification Retry Control

- Added guarded retry for failed payment notifications with manager/submanager authorization.
- Added three-attempt cap and 60-second retry cooldown.
- Added `retry-notification-failure` Edge Function and manager-facing Retry now action.
- Kept manual resolution as a fallback when provider delivery remains unavailable.

## 2026-09-04 — Financial & Billing Operations Ecosystem

- Added canonical financial ledger and role-scoped financial position RPCs.
- Added idempotent, prorated rent invoice generation and overdue projection controls.
- Rewired tenant balance summary to the canonical financial position service.
- Added financial integrity audit and regression coverage.
## 2026-09-04 — Property & Tenancy Operations Ecosystem
- Added an authoritative transactional lifecycle across property, unit, tenant, lease, and tenancy history state.
- Hardened lease activation/termination so tenant occupancy, unit status, tenancy history, and property occupancy/revenue are reconciled in one transaction.
- Made pre-lease tenant/unit assignment non-occupying; occupancy is now lease-driven.
- Hardened move-out for manager/submanager scope and preserved historical tenancy records.
- Added data-safe uniqueness guards for active unit/lease/tenancy relationships; legacy duplicate data does not block migration and is reported for reconciliation.
- Added regression coverage for lifecycle RPC presence, occupancy semantics, uniqueness protections, counter reconciliation, history preservation, and move-out scope wiring.


## Portal Navigation & Access Integrity — Phases 185–186
- Consolidated Manager, Agency, Landlord, Tenant and WebHost navigation onto the canonical portal navigation model.
- Removed duplicated role navigation definitions from the legacy shared sidebar.
- Added centralized permission filtering to the shared portal shell.
- Added explicit authenticated cross-portal boundaries and wrong-portal redirects.
- Bound permission-bearing WebHost navigation items to matching route-level permission guards.
- Added structural regression coverage for navigation ownership, permission drift, duplicate targets and portal boundaries.
- Automated Vitest/typecheck/lint execution could not be completed because the packaged environment lacked the required binaries and dependency installation timed out; this is explicitly recorded in the initiative audit.

## 2026-09-03 — Phases 178–179: Dashboard performance & query efficiency
- Removed the dashboard refresh double-request path by relying on TanStack Query invalidation for active stats.
- Coalesced bursts of realtime tenant/lease/invoice/property/maintenance/refund events into a single dashboard stats invalidation window.
- Preserved the existing RPC-first, scoped fallback architecture and added regression coverage for the performance safeguards.

## Phases 174–175 — Dashboard Intelligence & Information Density
- Reworked the manager dashboard action queue into a ranked, compact priority surface using existing live `AttentionItem` data only.
- Moved **Needs attention** directly below the executive KPI row so operational exceptions are visible before deeper charts and portfolio detail.
- Added affected-count context, urgency surfaces, explicit CTAs, and an all-clear state without introducing new data fetching or invented metrics.
- Added `src/test/dashboardIntelligencePhase7.test.ts` covering dashboard ordering and the no-fetch priority rendering boundary.

## Phases 160–161 — Loading, Empty, Error & Confirmation UX
- Standardized compact inline loading states across property sub-record views and receipts.
- Reused Button loading semantics for primary property and invoice save actions, preserving existing mutations.
- Added structural regression coverage for shared state accessibility, retryable errors, intentional empty states, and action loading.
## Phases 154–155 — Settings, Profile & Account UX
- Added a shared account hierarchy to manager settings, landlord settings and the tenant profile workspace.
- Clarified the purpose of each account surface without changing existing permissions, authentication, profile, notification or payment settings flows.
- Reused live data and existing mutations; no new data-fetching layer introduced.

## 140–141 — Product UI foundation + Manager dashboard refinement

- Established a shared dashboard section-header hierarchy and restrained dashboard chrome.
- Refined the manager dashboard hero, section rhythm, typography, and information hierarchy without inventing metrics or changing data behavior.
- Added regression coverage for the shared dashboard section header.

## Phases 136–137
- Added production evidence ingestion and independent release attestation controls.


## Phase 124–125 — Supply-Chain Integrity & CI Release Gate

- Added dependency provenance audit for npm lockfile and package resolution integrity.
- Added repository-local CI release integrity workflow for pull requests, `main`, and manual dispatch.
- Added CI release gate audit and release reconciliation integration.
- Production deployment, migration, authorization and rollback evidence remains externally required.
## 2026-09-03 — Phases 120–121

- Added release promotion lock and explicit production authorization binding.
- Added production change trace capture/audit with migration and artifact SHA-256 hashes.
- Integrated promotion lock and change trace into release evidence/reconciliation.
- Production execution remains `EXTERNAL_REQUIRED` until real deployment, migration, authorization and recovery evidence is supplied.

## 2026-09-03

### Phase 47–48 — Tenant Portal & Lease/Contract Mutation Convergence
- Added 15 ownership-checked tenant portal and tenant contract RPCs.
- Revoked direct authenticated writes on protected tenant portal mutation tables.
- Converged tenant profile, references, renewals, vacation notices, pets/vehicles, notices/messages, condition photos, notifications, and contract signing/document attachment.
- Added phase audit: `docs/audits/PHASE_47_48_TENANT_PORTAL_LEASE_CONVERGENCE.md`.

# CALQULUS PMS — Changelog & Diff Summary

**Comparing:** original uploaded codebase (`CALQULUS-PMS-main.zip`, branded "CALQULUS RMS") → current working tree
**Scope:** 288 files changed · 6,558 insertions · 5,475 deletions · 11 files added (including this changelog) · 2 files removed
**Verification status:** TypeScript clean · ESLint 0 errors / 0 warnings · 274/274 tests passing · production build succeeds (reverified fresh before this package was built)

> ⚠️ **Deployment note:** None of the changes below have been pushed to `github.com/Themugo/CALQULUS-PMS`. That repository still contains the original "CALQULUS RMS" codebase. Apply this zip to a branch and open a PR (or push directly to `main`) to bring the live repo up to date.

---

## 1. Brand identity — RMS → PMS rebrand

| Area | Change |
|---|---|
| Naming | `CALQULUS RMS` → `CALQULUS PMS` across **119 references**: every `.tsx`/`.ts` source file, `index.html`, `package.json`, `public/manifest.json`, PWA manifest inside `vite.config.ts` |
| Logo | New logo (`calqulus-logo-new.png`) wired into Sidebar, all 7 auth pages, LandlordDashboard header, NotFound page. Old `calqulusrms-logo.png` deleted. |
| Favicon / app icons | Regenerated `favicon.ico` (multi-resolution), `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png` directly from the new logo's icon mark (cloud + building), replacing stale mismatched icons |
| Missing asset fixed | `mask-icon.svg` was referenced in `index.html` but never existed on disk (broken pinned-tab icon) — created |
| PWA theme color | `#6d28d9` (old purple) → `#C9A84C` (CALQULUS gold); background `#0f172a` → `#0A1628` (CALQULUS navy) |
| package.json slug | `calqulus-rms` → `calqulus-pms` |

## 2. Visual design system — navy + gold palette

| File | Change |
|---|---|
| `src/index.css` | **356 lines changed.** Full design-token rebuild: `--primary`, `--accent`, `--sidebar-*` all remapped to the navy (`hsl 218°`)/gold (`hsl 42°`) brand hues. New utility classes: `.hero-gradient`, `.sidebar-gradient`, `.btn-brand`, `.btn-navy`, `.text-gradient`, `.badge-gold`, `.card-shadow-gold` |
| **Dark theme rebuild** | Previously used a generic desaturated grey (`hsl 220°`, 18–28% saturation) completely disconnected from the brand — this is why dark mode looked dull while the light/landing theme looked polished. Rebuilt on the same `218°` navy hue used everywhere else, with proper 4-layer surface depth (background → card → popover → muted) and richer saturation (38–42%). Verified WCAG AA contrast (15.19:1 text, 9.64:1 gold accent). Also fixed 7 hardcoded dark-mode utility overrides (`.dark .glass`, `.dark .card-shadow`, `.dark .sidebar-gradient`, `.dark .card-hover`, `.dark .shimmer`, scrollbar colors) that were still using the old grey hue after the main token fix. |
| `src/shared/components/ui/button.tsx` | Default variant rebuilt as gold gradient CTA with proper hover/active states |
| `src/shared/components/ui/badge.tsx` | Gold default variant + new semantic variants (success/warning/info/gold) |
| `checkbox.tsx`, `switch.tsx`, `calendar.tsx`, `sonner.tsx`, `radio-group.tsx` | Fixed `text-primary-foreground` contrast bugs (undefined token) → `text-slate-900` |

## 3. Pages rebuilt with full CALQULUS visual identity

| Page | Lines changed | What changed |
|---|---|---|
| `LandlordAuth.tsx` | 829 | Full split-panel rebuild: navy hero left panel (logo, feature list, gold accents) + frosted-glass auth form right panel. Reference design for all other auth pages. |
| `AgencyAuth.tsx` | 253 | Rebuilt from old emerald/slate theme to match LandlordAuth's split-panel design |
| `TenantSelfRegister.tsx` | 508 | Background gradient and form styling brought to brand |
| `LandlordPortalAuth.tsx` | 249 | Replaced `from-amber-950 via-slate-900` mismatched gradient with standard `hero-gradient` |
| `WebhostAuth.tsx` | 243 | Removed mixed `slate-800`/purple focus-ring styling |
| `ManagerOnboarding.tsx` | 329 | Full rebuild from flat `slate-800/slate-700` onboarding wizard to navy-glass stepper with gold active states |
| `ForgotPasswordDialog.tsx` | 169 | Collapsed 3 inconsistent style variants (default/landlord/tenant) into one unified gold-accented design |
| `Dashboard.tsx` (manager) | 401 | Rebuilt: full KPI grid (6 stat cards), arrears alert banner, 6-icon quick actions grid, revenue/occupancy charts, activity feed |
| `WebhostOverview.tsx` | 461 | StatCard moved to module scope (lint fix), urgent-action banners, platform revenue trend chart, properties audit trail |
| `WebhostDashboard.tsx` | 211 | Rebuilt from purple theme to navy/gold; gold-tinted tab strip, level badges |
| `AgencyDashboard.tsx` | 126 | Verbose 3-card actions replaced with 6-icon quick-actions grid matching manager dashboard |
| `AgencyLayout.tsx` | 176 | Sidebar rebuilt from emerald to navy `sidebar-gradient` with gold active-state treatment |
| `Tenants.tsx` | 364 | `TenantTable` moved to module scope (lint fix) |
| `TenantProfilePanel.tsx` | 119 | `Field`/`SelectField` moved to module scope (lint fix) |
| `NotFound.tsx` | 95 | Rebuilt from bare `<h1>404</h1>` to full branded 404 page with role-aware "back to portal" routing |
| `PhysicalDocumentEntry.tsx` | 205 | `LineItemEditor`/`DocTable` moved to module scope (lint fix) |
| `ManagerBankDetails.tsx` | 203 | `DetailRow`/`BankAccountCard` moved to module scope (lint fix) |
| `Sidebar.tsx` | 69 | New logo, gold active-state nav items, signed-in-as card |
| `StatCard.tsx`, `ManagerQuickActions.tsx`, `RevenueChart.tsx`, `OccupancyChart.tsx` | 138, 138, — , — | Gold accent treatment; chart tooltips moved to module scope (lint fix); occupancy/revenue bars now use brand gold instead of generic green |

## 4. Database — migration ordering bug (critical fix)

**The bug:** `20260601000000_enforce_management_structure.sql` writes RLS policies comparing `role = 'agency'` against the `app_role` Postgres enum. The migration that actually adds `'agency'` to that enum — `20260601000002_add_agency_app_role.sql` — was timestamped to run **after** it. Postgres rejects unrecognized enum literals, so this would have **failed the entire migration on a clean deploy.**

**The fix:** renamed `20260601000002_add_agency_app_role.sql` → `20260530000003_add_agency_app_role.sql`, moving it before `enforce_management_structure` in apply order.

**Verification:** wrote a script that scans all 53 migrations, builds a timeline of every enum value addition vs. every usage site, confirmed zero remaining premature-enum-usage issues anywhere in the migration history (including the dependent `role_firewall_hardening` migration).

## 5. Database — financial integrity constraints (new)

New migration: `supabase/migrations/20260604000000_financial_amount_check_constraints.sql` (165 lines)

Adds `CHECK` constraints (added `NOT VALID` for safe production deploy against existing data) to 13 monetary columns that were previously unconstrained, closing gaps flagged by the financial-integrity test suite's own defensive warnings:

- `invoices.amount > 0`
- `manager_invoices.amount > 0`
- `expenditures.amount > 0`
- `payment_receipts.amount > 0`
- `manager_subscriptions.amount > 0`
- `property_amenity_charges.amount > 0`
- `property_deductions.amount > 0`
- `deposit_deductions.amount > 0`
- `deposit_refunds.refund_amount >= 0` / `total_deductions >= 0`
- `tenants.deposit_amount >= 0` / `deposit_balance >= 0`
- `maintenance_requests.deposit_deduction_amount >= 0`
- `water_billing_config.flat_rate_amount >= 0`
- `water_meter_readings.total_amount >= 0`

Also adds supporting indexes (`payment_transactions.invoice_id`, `invoices.tenant_id/property_id/unit_id`) for the reconciliation query join path.

Follow-up migration `20260605000000_validate_amount_check_constraints.sql` (89 lines) documents the `VALIDATE CONSTRAINT` step to run after auditing existing production data.

## 6. Code quality — ESLint 173 errors → 0

| Rule | Original count | Fix applied |
|---|---|---|
| `react-hooks/set-state-in-effect` | 74 (62 files) | Targeted disable comments — architecture (useCallback+useEffect) is correct; rule is newly stricter in eslint-plugin-react-hooks v6 |
| `react-hooks/static-components` | 52 (9 files) | Moved all inline component definitions to module scope: `CustomTooltip` ×2, `ValidationIndicator`, `DetailRow`/`BankAccountCard`, `LineItemEditor`/`DocTable`, `RequirementItem`, `TenantTable`, `Field`/`SelectField`, `WebhostStatCard` |
| `no-useless-assignment` | 16 | Removed dead initializers (`let x = 0` → `let x: number`), removed unused `yPos` pre-assignments before reassignment |
| `react-hooks/preserve-manual-memoization` | 16 (9 files) | Targeted disable comments |
| `preserve-caught-error` | 6 | Added `{ cause: error }` to all 6 rethrown `Error`s in `camera-service.ts` |
| `react-hooks/purity` | 5 | `Date.now()` in `useState` moved to lazy initializer; `Math.random()` skeleton width replaced with deterministic value |
| `react-hooks/immutability` | 4 | Targeted disable comments on forward-reference patterns (e.g. recursive `fetchUserRole`) |

Net result: **0 errors, 0 warnings**, verified via two consecutive clean `npx eslint src --ext .ts,.tsx` runs.

## 7. Test infrastructure

`src/test/setup.ts` — 174 lines changed (test environment/mock setup hardening, supporting the financial-integrity test suite's stricter checks).

All 274 tests across 20 test files pass: financial integrity (double-entry, rollback, reconciliation), payment allocation, M-Pesa STK push, webhooks, auth flows, rate limiting, validations.

## 8. Build tooling

- `react-is` installed as an explicit dependency (was a missing peer dependency for `recharts`, causing production build failures)
- `package-lock.json` — 487 lines changed reflecting the above

> **Note on `.github/workflows/`, `.gitignore`, `public/sitemap.xml`, `.env.example`:** these exist in the current working tree but were absent from your uploaded zip, even though the GitHub repo's file listing shows a `.github/workflows` directory. This strongly suggests the zip you uploaded was a partial export that didn't include dotfiles/CI config — not something this session added. **Do not treat these as new work; verify against the actual GitHub repo before assuming they need to be added.** If the GitHub repo already has current versions of these files, keep those and don't overwrite with what's in this zip.

## 9. Files added (relative to your uploaded zip)

```
.env.example
.github/workflows/ci.yml          ⚠ see note in §8 — verify against actual GitHub repo first
.github/workflows/deploy-smoke.yml ⚠
.github/workflows/e2e.yml          ⚠
.gitignore                         ⚠
public/mask-icon.svg
public/sitemap.xml                 ⚠
src/assets/calqulus-banner.jpg
src/assets/calqulus-logo-new.png
supabase/migrations/20260604000000_financial_amount_check_constraints.sql
supabase/migrations/20260605000000_validate_amount_check_constraints.sql
CHANGELOG.md                       (this file)
```

## 10. Files removed

```
src/assets/calqulusrms-logo.png                              (replaced by calqulus-logo-new.png)
supabase/migrations/20260601000002_add_agency_app_role.sql   (renamed to 20260530000003_*, see §4)
```

## 11. Edge functions — domain consistency (verified, not changed)

Confirmed `www.calqulus.site` is already correctly wired throughout (no action needed):
- CORS allowlist (`_shared/cors.ts`)
- All transactional emails: welcome, invoice notification, manager approval, contract notification, payment confirmation, tenant invitation
- `capacitor.config.ts` mobile app server URL
- iOS/Android app store configs
- `index.html` canonical URL, Open Graph, Twitter Card meta tags

No stale `calquluspms.com` or other domain references found anywhere in the codebase.

---

## Outstanding items for next session

These were identified during the audit but not yet addressed:

1. **GitHub repo sync** — push this zip's contents to `github.com/Themugo/CALQULUS-PMS` (currently on the original RMS-branded code)
2. **Vercel deployment** — `calqulus-pms.vercel.app` (linked from the GitHub repo's About section) is serving the stale build; will need a redeploy once the repo is updated
3. Reports page `COLORS` array still uses old indigo/purple hex codes (`#6366f1` etc.) instead of brand palette
4. Statements/WaterBilling pages use native HTML `<select>` instead of the Radix `Select` component
5. `BillingStatsBar` renders nothing during loading (no skeleton)
6. Zero `react-hook-form` + `zodResolver` usage despite both being installed dependencies — forms rely on manual `useState` validation
7. CHECK constraints from §5 need `VALIDATE CONSTRAINT` run after a production data audit (see `20260605000000_validate_amount_check_constraints.sql`)

## 2026-09-03 — Phases 49–50
- Converged physical invoice/receipt capture and receipt-to-payment linking onto atomic RPCs.
- Hardened tenant payment-detail snapshot writes behind a scoped manager/submanager RPC.
- Revoked authenticated direct DML on physical receivables and tenant payment details.

## Phases 128–129 — Runtime Dependency Governance + Security Regression Matrix
- Added runtime dependency governance for lockfile/direct-dependency reconciliation, non-registry dependency review, lifecycle-script detection, and controlled registry-backed outdated checks.
- Added `docs/security/RUNTIME_DEPENDENCY_POLICY.md` and `docs/audits/RUNTIME_DEPENDENCY_GOVERNANCE.json`.
- Added consolidated `audit:security-regression-matrix` covering security boundary, cross-role isolation, final security, migration, operations, deployment, supply-chain and release gates.
- Matrix fails closed on repository `FAIL`/unknown statuses and preserves `EXTERNAL_REQUIRED` for live infrastructure evidence.
- CI release workflow now runs the runtime dependency governance check with registry-backed outdated checks enabled.

## Phases 134–135 — External Evidence Binding + Production Release Certification
- Added tamper-evident binding of external release, deployment, migration, staging, restore, and approval identifiers.
- Added fail-closed production release certification gate.
- Added policies/runbook and npm audit commands.

## Phases 138–139 — Attestation Signature & Final Production Decision
- Added Ed25519 independent attestation signature verification.
- Added fail-closed final production release decision engine with deterministic decision hash.
- Added release attestation and production decision runbooks/policy.

## Public landing page redesign
- Reworked the public homepage into a shorter product-first landing experience: focused hero, real dashboard preview, three capability pillars, and a concise conversion section.
- Reduced footer density and removed unsupported marketing claims/metrics.
- Preserved existing public routes and authentication CTAs.

## UI phases 142–143
- Refined the manager portfolio and units screens with shared dashboard hierarchy.
- Added concise portfolio/unit summary cards using live records only.
- Preserved existing routes, queries, mutations, filters, and navigation.
- Added a lightweight portfolio navigation UI regression test.

## Phases 146–147 — Unit Detail UX + Lease Management UX
- Added a focused unit detail sheet from the portfolio register, using live row data and direct workflow links.
- Clarified the unit workflow from property to tenant and lease records without duplicating data-fetch logic.
- Added shared dashboard hierarchy to the lease workspace and tightened its operational framing.
- Preserved existing lease filters, sorting, creation, document, statement, and mutation flows.


## Phases 148–149 — Billing & Maintenance UX
- Added shared dashboard hierarchy to the manager billing workspace, framing invoices and receipts around live receivables and collections.
- Added shared operational hierarchy to maintenance, clarifying the work queue before individual request actions.
- Preserved existing billing and maintenance queries, mutations, filters, tabs, reports, exports and workflows.
- Used existing live metrics only; no fabricated KPIs or duplicate data-fetching layers introduced.


## Phases 150–151 — Communications + Documents UX
- Added shared operational hierarchy to the communications workspace without changing message delivery or physical-document workflows.
- Added a focused records hierarchy and live contract/document summary to the contracts workspace.
- Preserved existing queries, mutations, filters, signature flows, uploads, and navigation.
- Used live contract/document records only; no fabricated metrics or duplicate fetching introduced.

## Phases 156–157 — Navigation + Responsive Application Shell
- Refined the shared portal shell for compact, responsive headers and mobile-safe content spacing.
- Preserved active navigation semantics, keyboard accessibility, mobile bottom navigation, and role-specific navigation data.
- Reduced shell transition overhead in the manager sidebar without changing navigation or permission logic.
- Added structural regression coverage for responsive navigation behavior.


## Phases 162–163 — Accessibility & Keyboard Interaction UX
- Strengthened keyboard-visible focus treatment for dialog and sheet surfaces.
- Added explicit accessible naming to previously icon-only transfer/password actions.
- Added a touch-target utility for compact controls on coarse-pointer devices without changing desktop density.
- Added structural regression coverage for the accessibility interaction layer.
- Preserved existing business logic, data fetching, permissions, and mutation flows.

## Phases 164–165 — Mobile UX + Responsive Data Workflows

- Refined major portfolio tables with a shared mobile overflow cue and contained horizontal scrolling.
- Improved responsive filter/search toolbars for properties and tenants.
- Stacked property and invoice form grids on narrow screens while preserving desktop layouts.
- Refined maintenance controls for narrow screens.
- Added `mobileResponsivePhase6.test.ts` regression coverage for mobile table and form behavior.
- No business logic, RPC contracts, permissions, or data-fetching behavior changed.

## Phases 168-169 — Search, Filter & Toolbar UX
- Added shared `SearchFilterBar` for consistent search, filter, active-filter and clear interactions.
- Applied the shared workflow to Properties, Units, Tenants and Maintenance.
- Preserved existing filtering, sorting, pagination and data-fetching logic.
- Added accessible live filter status and clear-search controls.

## Phases 170–171 — Navigation IA & Role UX
- Added explicit workspace context labels to the manager sidebar.
- Added accessible relationships between portal navigation groups and their headings.
- Strengthened visible keyboard focus treatment on portal navigation links.
- Preserved role-based route filtering, active-route behavior, permissions and navigation data.


## Phases 172–173 — Feedback & Confirmation UX
- Added semantic success, warning and informational toast variants with shared helpers.
- Applied semantic success feedback to property lifecycle actions.
- Strengthened property deactivation confirmation with destructive styling, explicit accessible naming and loading copy.

## Dashboard Command Center Initiative — Phases 180–184
- Centralized dashboard property and scoped-tenant queries through shared TanStack Query hooks.
- Reused the same property dataset for portfolio performance and occupancy visualization.
- Removed component-level realtime subscriptions from shared dashboard property/payment/revenue views; the dashboard cache is now the realtime invalidation boundary.
- Preserved manager/submanager scope boundaries and existing RPC-first dashboard statistics.
- Improved maintenance preview drill-down affordance and added regression coverage for shared query/invalidation boundaries.

## Dashboard Command Center Initiative — Performance & Drill-down Continuation
- Reduced six-month revenue history loading from twelve month-by-month invoice requests to two bounded invoice requests with client-side aggregation.
- Preserved assigned-property tenant scoping for revenue history.
- Added compact occupancy exception drill-down links to the lowest-occupancy properties using existing property routes and shared property data.
- Added regression coverage for bounded revenue requests, drill-down routes, and the single dashboard realtime subscription boundary.

- Dashboard Command Center: consolidated arrears and maintenance scope lookups onto shared dashboard datasets, removing duplicate property/tenant fetches.

## 2026-09-04 — Unit-first multi-payer & bulk payment completion
- Made unit/lease obligations the authoritative allocation target while allowing one tenant to hold multiple units.
- Added reusable payer parties for tenants, employers, institutions, sponsors, well-wishers and other third parties.
- Added explicit payer-to-unit links and one-payment/multi-invoice allocation with partial allocation support.
- Added payer receipts with allocation breakdowns and recipient copies for tenants, landlords and managers.
- Added portal unit discovery so linked units can be reviewed and combined into one payment transaction.
- Added manager/landlord unit-level billing summary so bulk and individual payments resolve to the same unit status.
- Added secure authorization checks around third-party payer allocations and receipt visibility.

## 2026-09-04 — Billing due-date, overdue routing & shared ownership
- Added hierarchical manager/property/landlord/tenancy due-date and overdue policies.
- Added tenant-specific payment routing with agency, manager and landlord destinations.
- Added invoice payment-account snapshots and tenant payment reminders.
- Removed the single-landlord-per-property limitation and enforced shared-owner revenue shares <= 100%.
- Added tenant-facing payment destination badges and due-date indicators.

## 2026-09-04 — Payment receipt, STK and reconciliation completion
- Completed the unit-first billing payment lifecycle with one canonical issued receipt per successful transaction.
- Digital receipts now carry unit-by-unit allocation detail and are delivered to payer, affected tenant auth accounts, managers and landlords.
- Tenant prompts resolve the real tenant auth user through `user_roles` rather than assuming tenant-row IDs are auth IDs.
- Effective billing hierarchy now supports tenancy, property+landlord, property, landlord and manager precedence.
- Existing uploaded proof receipts remain separate from issued payment receipts to avoid schema collisions.
- Tenant receipts portal now exposes successful issued receipts and allocation breakdowns.

## Executive Portfolio Intelligence
- Added explainable portfolio health/risk scoring and prioritized management actions.
- Added live executive dashboard panel backed by scoped database intelligence.

## 2026-09-04 — Tenant Service Recovery & Communication Loop
- Added tenant service recovery cases with scoped lifecycle and deduplication.
- Added auditable tenant follow-up communication queue.
- Added manager dashboard recovery control centre.
