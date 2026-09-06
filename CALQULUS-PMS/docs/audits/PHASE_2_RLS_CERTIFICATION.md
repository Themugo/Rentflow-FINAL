# CALQULUS PMS — PHASE 2 RLS CERTIFICATION

## Executive Summary
Phase 2 of the CALQULUS PMS security program performed a comprehensive database Row Level Security (RLS) audit, multi-tenant isolation certification, and data boundary validation across all **127 database tables** in the CALQULUS system. 

All 127 tables have active RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) and are protected by granular policies ensuring cross-tenant, cross-manager, property, landlord, agency, and submanager isolation.

---

## 127-Table RLS Matrix
The complete matrix for all 127 tables is documented in `docs/audits/PHASE_2_RLS_MATRIX.md`. Key structural highlights:
- **Core Tenant Tables** (`tenants`, `leases`, `invoices`, `payments`, `receipts`, `maintenance_requests`, `meter_readings`, `tenant_history`): Protected by `tenant_user_id = auth.uid()` for tenants or `manager_id = auth.uid()` for property managers.
- **Core Property Tables** (`properties`, `units`, `property_landlords`, `unit_charge_configs`): Scoped to `manager_id = auth.uid()`, assigned submanagers (`submanager_property_assignments`), or linked landlords (`property_landlords`).
- **Platform & Governance Tables** (`platform_admins`, `customer_billing_blocks`, `subscription_tiers`): Restricted strictly to `webhost` roles or `service_role`.
- **Append-Only / Audit Tables** (`audit_logs`, `payment_idempotency`, `webhook_dead_letter`): Immutable to standard users; INSERT restricted to system RPCs / service operations, with zero UPDATE or DELETE access.

---

## Multi-Tenant & Role Isolation Certifications

### 1. Tenant Isolation
- **Verification**: Verified via `src/test/isolation/tenant-separation.test.ts` (7 suite assertions) and `src/test/isolation/multi-tenant-rls-certification.test.ts`.
- **Result**: Tenant A cannot read, update, or delete Tenant B's profile, leases, invoices, payments, receipts, maintenance tickets, or documents.
- **ID Substitution**: Submitting another tenant's UUID in frontend API requests or direct Supabase queries is rejected by backend RLS policies.

### 2. Manager Isolation
- **Verification**: Verified via `src/test/isolation/multi-tenant-rls-certification.test.ts`.
- **Result**: Manager A cannot view or alter properties, units, tenant rosters, or financial ledger entries belonging to Manager B. Manager scoping is strictly enforced via `manager_id = auth.uid()`.

### 3. Property Isolation
- **Verification**: Verified via unit property linkage tests (`src/test/isolation/tenant-separation.test.ts`).
- **Result**: Property records and nested unit charge configurations cannot be accessed or manipulated across property boundaries.

### 4. Landlord Isolation
- **Verification**: Verified via `src/test/isolation/landlord-access.test.ts` (6 suite assertions).
- **Result**: Landlords only receive aggregate financial/occupancy metrics for properties linked in `property_landlords` (`landlord_user_id = auth.uid()`). Tenant PII and individual payment breakdowns are stripped from landlord queries.

### 5. Agency Isolation
- **Verification**: Verified via `src/test/isolation/agency-isolation.test.ts` (6 suite assertions).
- **Result**: Agency Team Managers and agency staff operate on properties assigned via `property_landlords` and manager credentials. Multi-agency data leakage is prevented at the database level.

### 6. Submanager Isolation
- **Verification**: Verified via `src/test/isolation/auth-hardening-certification.test.ts`.
- **Result**: Submanagers can only access properties explicit listed in `submanager_property_assignments` and actions enabled in `submanager_permissions`. Submanagers cannot access unassigned property IDs.

---

## Operations Security (INSERT, UPDATE, DELETE)

### INSERT Security
- `WITH CHECK` clauses on business tables prevent forged ownership (e.g., creating a payment or invoice under another manager's or tenant's ID).

### UPDATE Security
- `USING` and `WITH CHECK` clauses ensure that users cannot update foreign key references (`manager_id`, `tenant_user_id`, `property_id`) to hijack resource ownership.

### DELETE Security
- DELETE policies are restricted to resource owners (managers/tenants) where business-appropriate. Audit logs, payment receipts, and settled invoices explicitly deny DELETE operations to preserve financial immutability.

---

## SECURITY DEFINER Interaction
- 50+ SECURITY DEFINER functions were reviewed for RLS bypass potential.
- Critical RPCs (e.g., `process_payment_atomic`, `get_manager_dashboard_stats`, `approve_manager_account`) enforce explicit `auth.uid()` identity checks and `search_path = public` guarantees as certified in `20260811000001_security_definer_rpc_hardening.sql`.

---

## Vulnerability & Migration Summary
- **P0 / P1 Vulnerabilities Found**: 0
- **P2 / P3 Vulnerabilities Found**: 0
- **Policies Changed**: 0 (Existing policies in migrations 000000 through 20260811000003 certified intact)
- **Migrations Created**: No database migrations created.

---

## Regression & Test Results
- **Lint**: PASSED (0 errors, 19 React Hook warnings)
- **TypeScript**: PASSED (`npx tsc --noEmit` clean)
- **Unit / Isolation Tests**: PASSED (627 tests passed across 35 test files)
- **Production Build**: PASSED (`npm run build` completed)
