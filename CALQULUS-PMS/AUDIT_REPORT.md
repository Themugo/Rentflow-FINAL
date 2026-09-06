# CALQULUS PMS — Codebase Audit Report

**Date:** 2026-08-06
**Scope:** Full repository — application source (`src/`), infrastructure (`k8s/`, `helm/`, `terraform/`), scripts, and documentation.
**Method:** Automated import-graph reachability analysis (every file traced from real entry points — `src/main.tsx`, `src/App.tsx`, and every test file), copy-paste duplicate detection (`jscpd`), and manual review of routing config and navigation calls.

This replaces the eight prior ad-hoc audit reports that had accumulated in the repo root (now moved to `docs/archive/` for history). Those reports repeatedly claimed "enterprise-grade" features and 98-100/100 production-maturity scores while, as this audit shows, a large fraction of the code they described was never actually wired into the running application. This report reflects what is verifiably true of the code as of this commit.

## Summary of changes in this pass

| Category | Action | Scale |
|---|---|---|
| Dead/unreachable source files | Deleted | 199 files, ~84,000 lines |
| Duplicate binary asset | Deleted (`src/assets/calqulusrms-logo.png`, byte-identical to `calqulus-logo-new.png`) | 1 file |
| Committed test-run artifacts | Deleted + gitignored (`playwright-report/`, `test-results/`) | 60 files, ~6.3 MB |
| Wrong route | Fixed | 1 bug |
| Duplicate PDF-export logic | Refactored into shared helper | 3 files, ~150 duplicated lines removed |
| Stale root-level audit docs | Archived to `docs/archive/` | 8 files |

## 1. Dead code (the big finding)

Using a full import-graph reachability scan (not just "is this file imported by one other file" but a true breadth-first walk from `main.tsx`/`App.tsx`/all test files), **199 source files (~84,000 lines, roughly 40% of `src/`) were never reachable from anything the application or its test suite actually executes.** They were also cross-checked against `supabase/functions/`, `scripts/`, `e2e/`, and every `.md` file in the repo — zero references anywhere outside themselves.

These files are almost entirely self-contained "enterprise" modules that were written to match items on `ENTERPRISE_ROADMAP.md` but never connected to any route, component, edge function, or test:

- `src/compliance/**` — SOC2, ISO27001, privacy, penetration-testing, legal-audit, data-retention modules
- `src/analytics/**` — fraud detection, predictive maintenance, tenant LTV, occupancy forecasting, portfolio risk
- `src/lib/chaos/**`, `src/lib/disaster-recovery/**` — chaos engineering / DR simulation frameworks
- `src/lib/ai/**` — lease extraction, OCR receipt ingestion, risk scoring, vacancy prediction
- `src/lib/accounting/**` (incl. `erp/`) — full double-entry ERP layer (trial balance, depreciation, IFRS/GAAP alignment, tax engine)
- `src/lib/marketplace/**`, `src/marketplace/**`, `src/operators/**` — marketplace/ecosystem integrations and a Kubernetes-operator stub
- `src/lib/performance/**`, `src/lib/offline/**`, `src/lib/mobile/**`, `src/lib/security/**`, `src/lib/tracing/**`, `src/lib/metrics/**`, `src/lib/mfa/**`, `src/lib/rate-limit/**`, `src/lib/alerts/**`, `src/lib/workflows/**`
- `src/features/webhost/api/**` and the matching dashboard components in `src/features/webhost/components/**` (Contractor Marketplace, Financial Partners, Insurance Marketplace, Utility Providers, Workflow Orchestration, all six compliance dashboards, Platform Oversight/Management, Property Type Analytics, Tenant LTV)
- Whole unused shared component families: `src/shared/components/{ai,branding,commercial,ecosystem,mobile,ops,propertyos,table,workflow,communication}/**`, plus `FilterFramework`, `GlobalSearch`, `UniversalToolbar` in `layout/`
- 21 unused shadcn/ui primitives (`calendar`, `carousel`, `chart`, `command`, `context-menu`, `drawer`, `form`, `sidebar`, `toggle-group`, etc.) that were scaffolded but never used by any page
- Misc.: `src/features/billing/types.ts` (superseded, unreferenced), `src/integrations/supabase/supabase-extensions.ts`, `src/shared/types/{index,common}.ts`, `src/shared/lib/{accessibility,localization}.ts`, `src/shared/contexts/NetworkContext.tsx`, `src/features/contracts/components/TenantContractsView.tsx` (also a duplicate of `ContractsTable.tsx`, see below)

All 199 files were deleted. This is safe by construction: reachability analysis proves nothing in the shipped app or test suite imports them, so nothing else changes behaviorally.

### Flagged but NOT deleted — genuine feature gaps

A smaller set of unreached files looked like real, nearly-finished product features rather than speculative scaffolding (they reference actual DB tables used elsewhere, have no "enterprise buzzword" naming, and have obvious UI slots they belong in). These were left in place, since wiring them in requires product/UX decisions this audit shouldn't make unilaterally:

- `ContractEditor.tsx`, `TemplateManager.tsx` (contract creation/editing UI — `Contracts` page currently has no edit/create flow)
- `ManagerQuickActions.tsx`, `OnboardingWizard.tsx` (dashboard — no onboarding flow currently shown to new managers)
- `InstalmentPlanDialog.tsx`, `paymentLogger.ts` (billing — installment plans aren't offered anywhere yet)
- `DepositDeductionDialog.tsx`, `TenantTransferDialog.tsx` (tenant management — no UI trigger for either flow)
- `tenantStatementPdf.ts`, `depositStatementPdfExport.ts`, `invoiceCsvExport.ts` (export utilities with no "Export" button wired to them)
- `useAdminPermissions.ts`, `useFeatureAccess.ts`, `FeatureGate.tsx`, `AdminPermissionsEditor.tsx`, `PlatformAdminManagement.tsx` (a coherent permissions/feature-flag subsystem, unused by the webhost dashboard)

**Recommendation:** either wire these into their obvious parent pages, or delete them in a follow-up if they're intentionally shelved.

## 2. Wrong route

`src/shared/pages/InstallApp.tsx` — after a successful PWA install, the "Open App" button called `navigate("/dashboard")`. No such route exists anywhere in `src/app/routes.ts` (only `/dashboard/accountant`, `/dashboard/maintenance`, etc. exist as sub-routes); it fell through to each role's catch-all and either 404'd or silently redirected away from the intended destination. **Fixed to `navigate("/")`**, which is the actual dashboard route for manager/submanager roles.

All other navigation targets (`Sidebar.tsx` links, every `navigate()`/`<Link to>` call in `src/`) were cross-checked against the route table — no other mismatches found.

## 3. Duplicate code

`jscpd` found 136 exact-clone pairs. The two most significant, in code that's actually used:

- **`TenantContracts.tsx` (tenant portal page) vs. `TenantContractsSection.tsx`** — 158 duplicated lines, the largest clone in the codebase. Both independently implement contract listing/viewing/signing for a tenant. **Not auto-refactored** in this pass: merging them touches live signature/upload flows in two different role contexts, and correctness can't be verified without manual QA against a running Supabase instance. Flagged for a follow-up dedicated to this one change.
- **PDF export header boilerplate** across `invoicePdfExport.ts`, `receiptPdfExport.ts`, and `maintenanceReportPdfExport.ts` (currency formatter, company-settings fetch, and — for the first two — the full company-logo header block) — **fixed**: extracted into `src/shared/lib/pdf/companyPdfHeader.ts` (`createCurrencyFormatter`, `fetchCompanySettings`, `drawCompanyPdfHeader`). All three files now import the shared implementation instead of maintaining separate copies. Output is byte-for-byte the same; only the code location changed.
- `ISO27001ComplianceDashboard.tsx` / `SOC2ComplianceDashboard.tsx`, several `lib/accounting/erp/*` and `lib/security/*` clones — moot, these files were part of the dead-code deletion above.

## 4. Repo hygiene

- `playwright-report/` and `test-results/` (60 files, ~6.3 MB, including screenshots/videos from **failed** test runs) were committed to git despite `.gitignore` already excluding `dist/`, `build/`, `coverage/`. Removed from tracking and added to `.gitignore`.
- `src/assets/calqulusrms-logo.png` was a byte-identical duplicate of `src/assets/calqulus-logo-new.png`, unreferenced anywhere. Deleted.
- Eight overlapping root-level audit reports (`SYSTEM_AUDIT_REPORT*.md`, `FULL_SYSTEM_AUDIT_JUNE_2026.md`, `SILENT_FAILURE_AUDIT_JUNE_2026.md`, `ENTERPRISE_AUDIT_REPORT.md`, `COMPREHENSIVE_AUDIT_REPORT.md`, `DATABASE_SECURITY_AUDIT_REPORT.md`, `FRONTEND_ARCHITECTURAL_AUDIT_AND_BLUEPRINT.md`) moved to `docs/archive/` and superseded by this single report.

## 5. Infrastructure (k8s/helm/terraform)

The actual deployment path for this app is Vercel (`vercel.json` at repo root). The `k8s/`, `helm/`, and `terraform/` directories describe a parallel Kubernetes/Helm/Terraform deployment that shows no evidence of ever having been applied, and the Helm chart plus `k8s/operators/rentflow-{cr,crd}.yaml` reference a `rentflow` operator (`src/operators/rentflow-operator.ts`, now deleted as dead code) — a naming leftover inconsistent with the rest of the app, which is branded `calqulusrms` everywhere else. Nothing was deleted here (unlike dead frontend code, idle infra-as-code doesn't affect the running app or bundle size), but it's worth a decision: either finish and rename this deployment path, or remove it to stop it from misleading future audits the way the `.md` reports did.

## What wasn't changed

No `supabase/migrations/`, `supabase/functions/`, or database schema was touched. No dependency versions changed. No behavior of any currently-reachable page changed except the one route fix above.
