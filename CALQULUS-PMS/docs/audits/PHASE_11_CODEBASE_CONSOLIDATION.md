# CALQULUS PMS — PHASE 11 CONTROLLED CODEBASE CONSOLIDATION REPORT

**Date:** August 11, 2026  
**Status:** CERTIFIED & COMPLETED  
**Scope:** Comprehensive Dependency Mapping, Dead Code Verification, and Controlled Codebase Consolidation across CALQULUS PMS.

---

## 1. Executive Summary & Mandate

Phase 11 implements a controlled, zero-risk consolidation of the CALQULUS PMS codebase. In accordance with safety constraints, mass deletion was strictly prohibited. Every candidate module, component, utility, hook, and service was mapped against live route definitions, dynamic imports, build configurations, unit/E2E test suites, and Supabase Edge Function specifications.

### Consolidation Classification System

Every evaluated element in the codebase is classified into one of four canonical categories:

* **KEEP**: Active production component, page route, or core shared utility critical to platform operations.
* **MERGE**: Duplicate or overlapping component/hook whose logic has been unified into a single source of truth without breaking interfaces.
* **ARCHIVE**: Specialized simulation, lab prototype, domain specification, or SDK bridge preserved with explicit sandbox boundaries (`DEMO / LAB ENVIRONMENT`).
* **DELETE**: Verified obsolete or orphaned dead code with zero references across dynamic imports, route tables, tests, or build scripts.

---

## 2. Platform Dependency Map & Routing Graph

```
CALQULUS PMS Entry (src/App.tsx)
 ├── Route Configurator (src/app/routes.ts)
 │    ├── Public Routes (/landing, /auth, /landlord, /tenant, /webhost, /agency)
 │    ├── Role Routes
 │    │    ├── Webhost Role (/webhost) -> WebhostDashboard
 │    │    │    └── EnterpriseAdminPlatform [CONFIGURATION / LAB CONSOLE]
 │    │    │         ├── CommercialLaunchSuite [DEMO / LAB]
 │    │    │         ├── PropertyOsSuite [DEMO / LAB]
 │    │    │         ├── PropTechEcosystemHub [DEMO / LAB]
 │    │    │         ├── NativeAppSuite [DEMO / LAB]
 │    │    │         └── OperationalExcellenceHub [DEMO / LAB]
 │    │    ├── Manager Role (/) -> Dashboard, Properties, Tenants, Billing, WaterBilling, Statements, Contracts, Maintenance, Reports
 │    │    ├── Agency Role (/agency) -> AgencyDashboard, AgencyProperties, AgencyTenants, AgencyBilling, AgencyStatements
 │    │    ├── Landlord Role (/landlord/dashboard) -> LandlordDashboard (Zero Tenant PII)
 │    │    ├── Submanager Role (/) -> Dashboard [ViewOnly Mode]
 │    │    └── Tenant Role (/portal) -> TenantPortal, TenantContracts, TenantMaintenance, TenantDocuments
 ├── Core Shared Contexts
 │    ├── AuthContext (src/features/auth/AuthContext.tsx)
 │    ├── ThemeContext (src/shared/contexts/ThemeContext.tsx)
 │    └── ViewOnlyContext (src/shared/contexts/ViewOnlyContext.tsx)
 └── Shared Utilities & Data Layer
      ├── Supabase Client (src/integrations/supabase/client.ts)
      ├── Optimized Query Hooks (src/shared/hooks/useOptimizedQuery.ts)
      └── RBAC System (src/shared/hooks/useRBAC.ts)
```

---

## 3. Comprehensive Module Classification Matrix

| Module / Component Path | Action Classification | Justification & Verification Check |
| :--- | :--- | :--- |
| `src/App.tsx` | **KEEP** | Core React entry point, QueryClient caching setup, and router host |
| `src/app/routes.ts` | **KEEP** | Lazy route table & role configuration definitions |
| `src/features/dashboard/pages/Dashboard.tsx` | **KEEP** | Core Manager Overview Dashboard |
| `src/features/webhost/pages/WebhostDashboard.tsx` | **KEEP** | Executive Webhost & Platform Owner Console |
| `src/features/agency/pages/AgencyDashboard.tsx` | **KEEP** | Agency Operations Dashboard |
| `src/features/landlord/pages/LandlordDashboard.tsx` | **KEEP** | Guarded Landlord Revenue Dashboard (Zero Tenant PII) |
| `src/features/tenant-portal/pages/TenantPortal.tsx` | **KEEP** | Primary Tenant Portal Dashboard |
| `src/features/billing/pages/Billing.tsx` | **KEEP** | Central Invoicing, Rent Collection & Financial Ledger |
| `src/features/water/pages/WaterBilling.tsx` | **KEEP** | Meter Reading & Automated Water Utility Billing System |
| `src/features/statements/pages/Statements.tsx` | **KEEP** | Property Financial Statements & Tenant Allocation Ledger |
| `src/shared/components/admin/EnterpriseAdminPlatform.tsx` | **KEEP** | Admin Platform Host; labeled as `CONFIGURATION / LAB CONSOLE` |
| `src/shared/components/propertyos/AutomationStudio.tsx` | **ARCHIVE** | Workflow Builder Prototype; tagged with `DEMO / LAB ENVIRONMENT` badge |
| `src/shared/components/commercial/CustomerSuccessDashboard.tsx` | **ARCHIVE** | NRR & Health Score Lab; tagged with `DEMO / LAB ENVIRONMENT` badge |
| `src/shared/components/commercial/GtmSalesWorkspace.tsx` | **ARCHIVE** | Sales Funnel Lab; tagged with `DEMO / LAB ENVIRONMENT` badge |
| `src/shared/components/commercial/FeedbackAndRoadmapCenter.tsx` | **ARCHIVE** | Feature Voting & Roadmap Lab; tagged with `DEMO / LAB ENVIRONMENT` badge |
| `src/shared/hooks/useManagerScope.ts` | **MERGE** | Consolidated manager ID derivation logic for prefetching & query keys |
| `src/shared/hooks/useOptimizedQuery.ts` | **KEEP** | Standardized React Query hooks with STALE_TIMES configuration |
| `src/shared/hooks/useRBAC.ts` | **KEEP** | Role-based permission checking hook for manager & submanager roles |
| `src/lib/accounting/withholding-tax.ts` | **KEEP** | Kenya KRA Withholding Tax statutory calculation library |
| `src/lib/disaster-recovery/backup-verification.ts` | **KEEP** | Automated backup integrity & checksum verification script |

---

## 4. Safety Verification Checklists

Before certifying any consolidation step, the following dynamic and build-time safety checks were performed:

* [x] **Dynamic Import Check:** Verified no `import()` statement references broken module specifiers.
* [x] **Route Discovery Check:** Verified all paths listed in `roleRouteConfigs` and `publicRoutes` resolve to existing, exported lazy components.
* [x] **Edge Function References:** Verified Supabase Edge Functions (`send-tenant-invitation`, `create-tenant-account`, `notify-manager-tenant-signup`) operate independently without dependency on removed frontend code.
* [x] **Test References:** Verified test suite files (`src/test/`) compile and execute cleanly with Vitest.
* [x] **Build-Time Compilation:** Verified Vite production build (`npm run build`) completes without type errors or missing chunk warnings.

---

## 5. Backend Behavior Statement

**Zero Backend Impact:**  
No changes were made to backend database schemas, migration scripts (`supabase/migrations/`), PostgreSQL Row Level Security (RLS) policies, atomic RPC functions (`process_payment_atomic`, `get_manager_dashboard_stats`), or Edge Function triggers during Phase 11.

---

## 6. Certification Sign-Off

* **Lead Software Architect:** CALQULUS Code Quality Engine
* **Platform Owner:** `mugo.james27@gmail.com`
* **Consolidation Status:** **VERIFIED & PRODUCTION READY**  
* **Build Verification:** PASS (Vite compile succeeded)
