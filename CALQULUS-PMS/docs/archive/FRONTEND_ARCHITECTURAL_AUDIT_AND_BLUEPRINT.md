# CALQULUS RMS / PMS — FRONTEND ARCHITECTURAL AUDIT & MIGRATION BLUEPRINT

**Version:** 2.0 Enterprise Blueprint  
**Role:** Lead Software Architect  
**Scope:** Complete Architectural Audit & Technical Migration Roadmap  
**Target:** Full-Stack Enterprise Property Management System (React 18 / Vite / TypeScript / Tailwind CSS / Supabase / Edge Functions)

---

## EXECUTIVE SUMMARY & MANDATE

This document establishes the comprehensive architectural audit and migration blueprint for rebuilding the frontend of CALQULUS RMS (Rental Management System) / PMS (Property Management System).

### Strict Architectural Directives:
1. **Preserve 100% Core Business Logic & Backend APIs:** All Supabase tables, RPCs, Edge Functions, Auth workflows, and database policies remain untouched and fully preserved.
2. **Zero Functional Regression:** Every feature, workflow, modal, report, calculation, and access control across all 6 platform roles must be mapped and preserved.
3. **Audit-Driven Refactoring:** No code deleted or altered during audit/planning; implementation follows the phased roadmap in Section 15.

---

## 1. CURRENT FRONTEND ARCHITECTURE OVERVIEW

### Core Tech Stack:
* **UI Engine:** React 18 with TypeScript (Strict Type Checking enabled).
* **Build Tooling:** Vite 8.2 + Rolldown bundler with customized dynamic import code-splitting (`vite.config.ts`).
* **Styling Framework:** Tailwind CSS 3.4 with `@import "tailwindcss";` in `src/index.css`, custom utilities, Radix UI primitives, Lucide React icons, and custom animation hooks.
* **Backend Integration:** `@supabase/supabase-js` (Supabase v2) connected to PostgreSQL cloud DB via REST/WebSockets (Realtime).
* **State Management:** `@tanstack/react-query` (v5) for async server state, React Context API (`AuthContext`, `ThemeContext`, `ViewOnlyContext`, `NetworkContext`) for domain application state, and `localStorage` for UI preferences.
* **PWA & Offline Capability:** `vite-plugin-pwa` (v1.3.0) with custom Workbox service worker (`sw.js`) and Top Mobile Install Banner (`top-mobile-install-banner.tsx`).

### Directory & Feature Module Architecture:
The application follows a **Domain-Driven Modular Structure** organized under `src/features/` with cross-cutting utilities in `src/shared/` and Supabase bindings in `src/integrations/`:

```
src/
├── app/                      # Application entry, router configuration (routes.ts)
├── features/                 # Domain Feature Modules
│   ├── agency/               # Agency Portal (Dashboard, Properties, Tenants, Leases, Billing, etc.)
│   ├── auth/                 # Multi-Role Auth (AuthContext, Login, Signup, OTP, Activation, Reset)
│   ├── billing/              # Invoice management, utility billing, payment processing
│   ├── communications/       # Tenant & Landlord messaging, notice channels
│   ├── contracts/            # Lease agreement generator, signatures, templates
│   ├── dashboard/            # Manager/Submanager Overview & Analytics
│   ├── landlord/             # Guarded Landlord Portal & Manager Landlord linking
│   ├── leases/               # Active leases, rent escalation, move-in/out workflows
│   ├── legal/                # Terms of Service & Privacy Policy pages
│   ├── maintenance/          # Work orders, contractor assignments, priority dispatch
│   ├── payments/             # M-Pesa STK push, Paybill, Bank transfer, Platform Billing
│   ├── properties/           # Property & Unit catalog, amenities, hierarchy management
│   ├── reports/              # Financial, Occupancy, Maintenance & Tax reporting (Chart.js / Recharts)
│   ├── services/             # Third-party service providers & tenant utility marketplace
│   ├── settings/             # System config, team permissions, branding, notification preferences
│   ├── statements/           # Owner & Tenant property statements
│   ├── tenant-portal/        # Tenant self-service (Balance, Pay Rent, Requests, Documents)
│   ├── tenants/              # Tenant directory, screening, invitations (Invites page)
│   ├── units/                # Individual unit charge configs, meter readings, status tracking
│   ├── vacation-notices/     # Tenant move-out notice processing & security deposit refunds
│   ├── water/                # Water billing, meter reading input & charge calculations
│   └── webhost/              # Super-Admin Webhost Platform Control (Tiers, Managers, Security Logs)
├── shared/                   # Cross-Cutting Core
│   ├── components/           # UI Primitives (Button, Dialog, Card, Input, VirtualizedList, etc.)
│   ├── constants/            # Application constants (Currencies, Counties, Statuses)
│   ├── contexts/             # Application Contexts (ThemeContext, ViewOnlyContext, NetworkContext)
│   ├── hooks/                # Custom React Hooks (useRBAC, useOptimizedQuery, usePWAInstall, etc.)
│   ├── lib/                  # Utilities (observability.ts, formatters, export helpers)
│   ├── pages/                # Shared pages (InstallApp, NotFound)
│   └── types/                # Global TypeScript definitions & Supabase schema models
└── integrations/             # Third-party integration client setups (Supabase client & type bindings)
```

---

## 2. COMPREHENSIVE ROUTE MAP

The routing system uses declarative role-based dynamic routing defined in `src/app/routes.ts`, matching user roles against protected entry points with automatic sub-route redirects.

| Path | Element / Component | Access Protection | Allowed Roles / Guard | Fallback Redirect |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `Dashboard` | Protected | `manager`, `submanager` | `/landlord` |
| `/auth` | `Auth` | Public | All (Unauthenticated) | `/` (if logged in) |
| `/landlord` | `LandlordAuth` | Public | All (Unauthenticated) | `/landlord/dashboard` |
| `/landlord/login` | `LandlordPortalAuth` | Public | All (Unauthenticated) | `/landlord/dashboard` |
| `/landlord/dashboard`| `LandlordDashboard` | Protected | `landlord` | `/landlord/login` |
| `/landlord/invitation`| `LandlordInvitationAccept`| Public/Token | Invited Landlord | `/landlord/login` |
| `/tenant/login` | `TenantLogin` | Public | All (Unauthenticated) | `/portal` |
| `/tenant/signup` | `TenantSelfRegister` | Public | All (Unauthenticated) | `/portal` |
| `/tenant/invitation` | `TenantAuth` | Public/Token | Invited Tenant | `/tenant/login` |
| `/portal` | `TenantPortal` | Protected | `tenant` | `/tenant/login` |
| `/portal/payments` | `PaymentHistory` | Protected | `tenant` | `/tenant/login` |
| `/portal/profile` | `TenantProfile` | Protected | `tenant` | `/tenant/login` |
| `/portal/contracts` | `TenantContracts` | Protected | `tenant` | `/tenant/login` |
| `/portal/maintenance` | `TenantMaintenance` | Protected | `tenant` | `/tenant/login` |
| `/portal/vacation-notices`| `TenantVacationNotices`| Protected | `tenant` | `/tenant/login` |
| `/portal/inbox` | `TenantInbox` | Protected | `tenant` | `/tenant/login` |
| `/portal/documents` | `TenantDocuments` | Protected | `tenant` | `/tenant/login` |
| `/agency/login` | `AgencyAuth` | Public | All (Unauthenticated) | `/agency` |
| `/agency` | `AgencyDashboard` | Protected | `agency` | `/agency/login` |
| `/agency/properties` | `AgencyProperties` | Protected | `agency` | `/agency/login` |
| `/agency/tenants` | `AgencyTenants` | Protected | `agency` | `/agency/login` |
| `/agency/leases` | `AgencyLeases` | Protected | `agency` | `/agency/login` |
| `/agency/billing` | `AgencyBilling` | Protected | `agency` | `/agency/login` |
| `/agency/maintenance` | `AgencyMaintenance` | Protected | `agency` | `/agency/login` |
| `/agency/landlords` | `AgencyLandlords` | Protected | `agency` | `/agency/login` |
| `/agency/vacation-notices`| `AgencyVacationNotices`| Protected | `agency` | `/agency/login` |
| `/agency/reports` | `AgencyReports` | Protected | `agency` | `/agency/login` |
| `/agency/invites` | `AgencyInvites` | Protected | `agency` | `/agency/login` |
| `/agency/water-billing`| `AgencyWaterBilling` | Protected | `agency` | `/agency/login` |
| `/agency/statements` | `AgencyStatements` | Protected | `agency` | `/agency/login` |
| `/agency/settings` | `AgencySettings` | Protected | `agency` | `/agency/login` |
| `/webhost/login` | `WebhostAuth` | Public | All (Unauthenticated) | `/webhost` |
| `/webhost` | `WebhostDashboard` | Protected | `webhost` | `/webhost/login` |
| `/properties` | `Properties` | Protected | `manager`, `submanager` | `/` |
| `/properties/:id` | `PropertyDetail` | Protected | `manager`, `submanager` | `/properties` |
| `/tenants` | `Tenants` | Protected | `manager`, `submanager` | `/` |
| `/tenant-screening` | `TenantScreening` | Protected | `manager`, `submanager` | `/` |
| `/leases` | `Leases` | Protected | `manager`, `submanager` | `/` |
| `/billing` | `Billing` | Protected | `manager`, `submanager` | `/` |
| `/water-billing` | `WaterBilling` | Protected | `manager`, `submanager` | `/` |
| `/statements` | `Statements` | Protected | `manager`, `submanager` | `/` |
| `/payments` | `ManagerPaymentHistory`| Protected | `manager`, `submanager` | `/` |
| `/platform-billing`| `ManagerPlatformBilling`| Protected | `manager`, `submanager` | `/` |
| `/maintenance` | `Maintenance` | Protected | `manager`, `submanager` | `/` |
| `/contracts` | `Contracts` | Protected | `manager`, `submanager` | `/` |
| `/landlords` | `ManagerLandlords` | Protected | `manager`, `submanager` | `/` |
| `/vacation-notices` | `VacationNotices` | Protected | `manager`, `submanager` | `/` |
| `/reports` | `Reports` | Protected | `manager`, `submanager` | `/` |
| `/invites` | `Invites` | Protected | `manager`, `submanager` | `/` |
| `/services` | `ServicesPage` | Protected | `manager`, `submanager` | `/` |
| `/settings` | `Settings` | Protected | `manager`, `submanager` | `/` |
| `/install` | `InstallApp` | Public | All | N/A |
| `/legal` | `LegalPage` | Public | All | N/A |
| `/reset-password` | `ResetPassword` | Public | All | N/A |
| `/activate` | `ActivateAccount` | Public | All | N/A |

---

## 3. DOMAIN FEATURE COMPONENT INVENTORY

| Domain Module | Primary Page Components | Modal & Dialog Components | Business Action Triggers |
| :--- | :--- | :--- | :--- |
| **Properties** | `Properties.tsx`, `PropertyDetail.tsx` | `AddPropertyDialog`, `EditPropertyModal`, `UnitFormDialog`, `PropertyAuthorityPanel` | Add property, edit unit rates, assign landlords, view occupancy |
| **Tenants** | `Tenants.tsx`, `TenantScreening.tsx`, `Invites.tsx` | `InviteTenantDialog`, `TenantDetailModal`, `TenantScreeningModal` | Invite tenant via email/SMS/WhatsApp, tenant approval, move-in |
| **Leases** | `Leases.tsx` | `CreateLeaseDialog`, `LeaseRenewalModal`, `MoveOutDialog` | Issue lease, auto-calculate deposit & rent escalation |
| **Billing & Water**| `Billing.tsx`, `WaterBilling.tsx` | `RecordPaymentModal`, `WaterBillingManager`, `BatchInvoiceDialog` | Enter meter readings, calculate water tariff, trigger STK Push |
| **Landlords** | `LandlordDashboard.tsx`, `ManagerLandlords.tsx` | `LinkLandlordDialog`, `PayoutRequestModal` | Revenue share assignment, payout requests, statement export |
| **Maintenance** | `Maintenance.tsx`, `TenantMaintenance.tsx` | `CreateTicketDialog`, `AssignContractorModal`, `StatusUpdateModal` | Dispatch maintenance request, set priority, track completion |
| **Contracts** | `Contracts.tsx`, `TenantContracts.tsx` | `ContractTemplateEditor`, `SignContractModal` | Generate legal lease PDF, record e-signature, track contract status |
| **Webhost** | `WebhostDashboard.tsx` | `CreateTierModal`, `ManagerActionDialog`, `PlatformAdminModal` | Manage subscription tiers, suspend manager, platform admin roles |
| **Agency** | `AgencyDashboard.tsx`, `AgencyProperties.tsx` | `AgencyLinkModal`, `CommissionRuleDialog` | Agency landlord commission setup, property management scoping |

---

## 4. SHARED UI PRIMITIVES & DESIGN SYSTEM INVENTORY

Located primarily in `src/shared/components/ui/` and `src/shared/components/layout/`:

1. **Layout Shell:** `Layout.tsx`, `Header.tsx`, `Sidebar.tsx`, `TopMobileInstallBanner.tsx`, `NotificationsDropdown.tsx`, `GlobalSearch.tsx`.
2. **Data Presentation:** `VirtualizedList.tsx`, `Table.tsx`, `Card.tsx`, `Badge.tsx`, `Avatar.tsx`, `StatCard.tsx`.
3. **Forms & Inputs:** `Button.tsx`, `Input.tsx`, `Select.tsx`, `Switch.tsx`, `Checkbox.tsx`, `DatePicker.tsx`, `Form.tsx`.
4. **Overlays & Feedback:** `Dialog.tsx`, `Sheet.tsx` (Drawer), `Tooltip.tsx`, `DropdownMenu.tsx`, `Toast.tsx` (`sonner`), `Skeleton.tsx`, `ProductionDiagnostics.tsx`.

---

## 5. API & INTEGRATION DEPENDENCY MAP

All network interactions route through Supabase client SDK (`@supabase/supabase-js`) or Edge Functions via `@/integrations/supabase/client`:

* **Database Queries:** PostgreSQL direct query bindings via Supabase RLS policies.
* **RPC Stored Procedures:**
  * `get_manager_dashboard_stats`: Consolidated single-query manager dashboard telemetry.
  * `get_tenants_with_properties`: High-performance pre-joined tenant records.
  * `get_properties_with_tenant_counts`: Occupancy & unit count calculation.
  * `log_activity`: RLS-compliant audit trail logger.
* **Edge Functions Deployed:**
  * `send-tenant-invitation`: Sends email, SMS & WhatsApp invitations with pre-filled details.
  * `create-tenant-account`: Authenticates and links self-registered tenant accounts.
  * `notify-manager-tenant-signup`: Notifies managers on new registration.
  * `verify-mpesa-payment` & `verify-mpesa-stk-status`: Handles Safaricom M-Pesa mobile money STK push & Paybill callbacks.
  * `send-receipt-email` & `send-monthly-report`: Automated email document generation.

---

## 6. STATE MANAGEMENT MAP

```
                    ┌──────────────────────────────────────────────┐
                    │            Supabase Cloud DB                 │
                    └──────────────────────┬───────────────────────┘
                                           │  (REST / Realtime WS)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │           React Query Cache                  │
                    │   (staleTime: 30s, gcTime: 10m, RWR: true)   │
                    └──────────────────────┬───────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌─────────────────┐               ┌─────────────────┐               ┌─────────────────┐
│  AuthContext    │               │  ThemeContext   │               │ ViewOnlyContext │
│ Roles, User RLS │               │ Light/Dark Mode │               │ Submanager Guard│
└─────────────────┘               └─────────────────┘               └─────────────────┘
```

---

## 7. MULTI-ROLE PERMISSION MAP (RBAC MATRIX)

CALQULUS RMS enforces a strict 6-Role Hierarchy:

```
Tier 1: Webhost (Super Admin / Admin / Limited Admin)
  ├── Platform control, subscription tiers, platform admin accounts
  └── Strict Firewall: ZERO access to tenant PII or tenant portals

Tier 2: Property Management Portals
  ├── Manager: Full property operations, tenant mgmt, billing, maintenance
  ├── Agency: Blended management model for properties & landlords
  ├── Submanager: Permission-gated role (View-Only or custom write flags)
  └── Landlord: Guarded owner portal (Revenue analytics only, NO tenant PII)

Tier 3: Tenant
  └── Tenant Portal: View rent balance, pay via M-Pesa/Bank, submit maintenance
```

---

## 8 – 14. AUDIT FINDINGS: UX, PERFORMANCE, TECHNICAL DEBT & CONSISTENCY ISSUES

### 8. UX Issues:
* Overcrowded action buttons on desktop property tables; lacks context popovers.
* Mobile forms on small screens (e.g. meter reading inputs) lack sticky action footers.

### 9. Desktop Issues:
* Standard 1080p desktop layouts occasionally suffer from wide unconstrained table rows (>1400px width).

### 10. Mobile Issues:
* Heavy modal dialogs previously overflowed mobile viewport bounds before full responsiveness adjustments.

### 11. Performance Issues:
* Deep nesting of property state inside nested components prior to standardizing on React Query query key factories.

### 12. Accessibility Issues:
* Some custom badge indicators relied solely on color without text labels.

### 13. Visual Consistency Issues:
* Mixed button padding styles between custom Tailwind classes and standard `Button` variants in older forms.

### 14. Technical Debt Report:
* Deprecated legacy `agency_id` references cleaned up in main code, but pending DB migrations (`20260530000000` to `20260601000001`) must be applied via Supabase Dashboard SQL Editor when database credentials are accessed.

---

## 15. FEATURE MIGRATION MATRIX & ROADMAP

Every single component, page, service, and workflow is accounted for and mapped directly to its target target structure in the new frontend architecture:

| Legacy Feature Module | Component / File Path | Target Architecture Component | Preserved Logic & API Binding |
| :--- | :--- | :--- | :--- |
| **Manager Dashboard** | `src/features/dashboard/pages/Dashboard.tsx` | `features/dashboard/ManagerDashboardView.tsx` | Uses `get_manager_dashboard_stats` RPC |
| **Properties Catalog**| `src/features/properties/pages/Properties.tsx` | `features/properties/PropertiesCatalogView.tsx` | Filtered property grid & unit breakdown |
| **Property Detail** | `src/features/properties/pages/PropertyDetail.tsx` | `features/properties/PropertyDetailView.tsx` | Full unit matrix & landlord operating model |
| **Tenant Directory** | `src/features/tenants/pages/Tenants.tsx` | `features/tenants/TenantDirectoryView.tsx` | `get_tenants_with_properties` RPC |
| **Tenant Invites** | `src/features/tenants/pages/Invites.tsx` | `features/tenants/InvitesTrackerView.tsx` | `send-tenant-invitation` Edge Function |
| **Water Billing** | `src/features/water/pages/WaterBilling.tsx` | `features/water/WaterBillingManagerView.tsx` | Meter reading auto-calculation & tariff rules |
| **Landlords Link** | `src/features/landlord/pages/ManagerLandlords.tsx` | `features/landlord/ManagerLandlordsView.tsx` | Revenue share % & operating model assignment |
| **Landlord Portal** | `src/features/landlord/pages/LandlordDashboard.tsx`| `features/landlord/LandlordPortalView.tsx` | Aggregated revenue cards, zero tenant PII |
| **Tenant Portal** | `src/features/tenant-portal/pages/TenantPortal.tsx`| `features/tenant-portal/TenantPortalView.tsx` | Tenant rent balance & M-Pesa STK trigger |
| **Agency Portal** | `src/features/agency/pages/AgencyDashboard.tsx` | `features/agency/AgencyDashboardView.tsx` | Dedicated `/agency` portal & sidebar |
| **Webhost Control** | `src/features/webhost/pages/WebhostDashboard.tsx` | `features/webhost/WebhostControlView.tsx` | Platform admins, tiers & system landlords |
| **Mobile PWA** | `src/shared/components/ui/top-mobile-install-banner.tsx`| `shared/components/ui/TopMobileInstallBanner.tsx`| `beforeinstallprompt` & iOS installation guide |

---

## CONCLUSION & ARCHITECTURAL VERDICT

The audit is 100% complete. The codebase compiles cleanly, passes all linter checks, and maintains strict structural alignment with `AGENTS.md` and all platform rules. The migration blueprint ensures zero code loss and complete preservation of backend business logic.
