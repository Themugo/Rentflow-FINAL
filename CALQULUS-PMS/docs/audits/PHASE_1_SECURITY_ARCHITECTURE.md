# CALQULUS PMS — PHASE 1 SECURITY ARCHITECTURE AUDIT

## 1. Executive Summary
CALQULUS RMS / PMS is an enterprise property management system built on React 18, Vite, TypeScript, and Supabase PostgreSQL backend with 65+ database migrations, RLS row-level security policies, and edge functions.

Phase 1 establishes a comprehensive **Security Architecture Inventory & Controlled Hardening Audit** across the 18 required categories. All baseline checks (TypeScript `tsc --noEmit`, ESLint, Vitest, npm audit, Vite production build) were executed and verified against the working codebase.

---

## 2. Current Architecture
- **Frontend Stack**: React 18 + TypeScript + Vite + Tailwind CSS + Lucide React + Motion/Framer Motion.
- **Backend Stack**: Supabase PostgreSQL + Edge Functions (Deno/TypeScript) + Realtime + Storage.
- **Role Model**: Multi-tenant 3-Tier Hierarchy:
  - **Tier 1 (Ownership)**: Webhost (`super_admin`, `admin`, `limited_admin`, `platform_admin`).
  - **Tier 2 (Property Management)**: Manager (Full Ops), Agency (Commission / Blended Agent), Submanager (RBAC role within Manager/Agency scope), Landlord (Revenue-only view, zero tenant PII).
  - **Tier 3 (End Users)**: Tenant (Isolated portal at `/portal`).
- **Build / Tooling**: Vite + Rollup/Rolldown, Vitest (125 unit tests), Playwright E2E, ESLint v9, Tailwind CSS v3.

---

## 3. Authentication
- **Authentication Engine**: Supabase Auth (`gotrue-js` client) using JWT sessions.
- **Session Handling**: Managed via `AuthContext.tsx` with automatic token refresh, `onAuthStateChange` listener, and session recovery timeout (`VITE_AUTH_TIMEOUT_MS`).
- **Auth Flows**:
  - Email/Password login (`/auth`, `/webhost/login`, `/agency/login`, `/landlord/login`, `/tenant/login`).
  - Account Activation & Invitation Token redemption (`/activate-account`, `/accept-landlord-invitation`).
  - Tenant Signup via manager invitation link (`/tenant/signup?token=...`).
- **MFA & Device Security**: `supabase/migrations/20260602000000_mfa_and_device_management.sql` provides MFA tracking and registered device session logging.
- **Privileged Actions**: Hardened in `20260811000003_auth_privileged_action_hardening.sql` using SECURITY DEFINER RPCs (`approve_manager_account`, `suspend_manager_account`, `check_submanager_permission`) requiring explicit `auth.uid()` / webhost role verification.

---

## 4. Authorization & RBAC
- **Multi-Tenant Scoping**: Manager & Agency operations scoped via `manager_id = auth.uid()`.
- **Submanager Permissions**: Managed via `submanager_permissions` and `submanager_property_assignments` tables using the `can()` / `canWrite()` hooks (`useRBAC.ts`).
- **Webhost Permissions**: Granular flags (`can_manage_managers`, `can_manage_pricing`, `can_view_audit_logs`, `can_manage_platform_admins`) checked via `useAdminPermissions.ts` and validated server-side by database policies.
- **Tenant Isolation**: Direct relationship `tenant_user_id = auth.uid()` on leases/payments/tickets. Zero access to other tenants or property financial metrics.
- **Landlord Isolation**: `landlord_user_id = auth.uid()` on `property_landlords`. Tenant PII removed from Landlord dashboards; landlords view aggregate revenue and occupancy metrics only.

---

## 5. Roles
1. `webhost` / `platform_admin`: System platform operator. Webhost role has zero tenant PII access (`20260601000003_role_firewall_hardening.sql`).
2. `manager`: Property manager with full tenant, lease, maintenance, billing, and water metering controls.
3. `agency`: Agency team manager running property operations under a commission or pass-through model.
4. `submanager`: Secondary staff assigned by Manager or Agency with scoped property and action permissions.
5. `landlord`: Property owner receiving payouts; revenue-only view.
6. `tenant`: Resident occupying a unit; paying rent, submitting tickets, viewing invoices.

---

## 6. Database Security
- **Database Engine**: PostgreSQL on Supabase (`aelzsqxllkypbzslxyju.supabase.co`).
- **Migrations**: 65 SQL migration scripts in `supabase/migrations/`.
- **Key Schema Highlights**:
  - Mandatory RLS on all business-critical tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
  - Explicit FOREIGN KEY constraints and `CHECK` constraints on financial fields (`amount >= 0`, `20260604000000_financial_amount_check_constraints.sql`).
  - Idempotency key tracking on payments (`20260506000021_payment_idempotency.sql`, `20260519000000_webhook_dead_letter_and_idempotency.sql`).

---

## 7. RLS Inventory
All primary business tables have Row Level Security enabled and active:
- `user_roles`: Scoped to `user_id = auth.uid()` for users, or `webhost` role for management.
- `properties`: Scoped to `manager_id = auth.uid()`, assigned `submanager`, or linked `landlord`.
- `units`: Inherits property scoping or direct tenant lease linkage.
- `tenants` & `leases`: Scoped to `manager_id = auth.uid()` for managers, or `tenant_user_id = auth.uid()` for tenants.
- `invoices` & `payments`: Scoped to manager for collections, tenant for payments, or landlord for revenue share summaries.
- `maintenance_requests`: Scoped to tenant (creator), assigned contractor/service provider, or property manager.
- `tenant_invitations`: Scoped by manager creator or public verification RPC (`verify_tenant_invitation_token`).
- `customer_billing_blocks` & `platform_admins`: Restricted strictly to `webhost` / `service_role`.

---

## 8. SECURITY DEFINER Functions
Inventoried SECURITY DEFINER functions in `supabase/migrations/`:
1. `get_manager_dashboard_stats(UUID)`: Hardened in `20260811000001_security_definer_rpc_hardening.sql`. Verifies `auth.uid() = target_manager_id` or `auth.role() = 'service_role'`.
2. `get_tenants_with_properties(UUID)`: Validates caller identity before returning tenant lists.
3. `get_properties_with_tenant_counts(UUID)`: Validates caller identity before returning property counts.
4. `process_payment_atomic(...)`: Atomic payment engine (`20260728000002_atomic_payment_processing.sql`). Validates invoice ownership and idempotency key before applying credit.
5. `approve_manager_account(UUID)` & `suspend_manager_account(...)`: Restricted to authenticated `webhost` or `service_role` callers (`20260811000003_auth_privileged_action_hardening.sql`).
6. `verify_tenant_invitation_token(TEXT)` & `redeem_tenant_invitation_token(...)`: Token verification functions set with explicit `search_path = public`.

---

## 9. Storage Security
Supabase Storage Buckets configured and audited in `20260526001000_core_flow_storage_buckets.sql` & `20260811000002_storage_security_hardening.sql`:
- `property-images`: Public read for property marketing; insert/update restricted to property manager.
- `tenant-photos`: Private bucket; read/upload restricted to tenant owner or property manager.
- `signed-contracts` & `contracts`: Private buckets; restricted to manager, submanager, or linked tenant.
- `maintenance-photos`: Scoped to request creator (tenant), assigned contractor, or manager.
- `receipts`: Scoped to manager or paying tenant.

---

## 10. Secrets & Environment Configuration
- `.env.example` documents `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (public anon keys).
- **Secrets Audit**: Zero production secret keys, `service_role` keys, database passwords, or payment API secret keys were exposed in client-side code (`src/`).
- `service_role` key usage in database migrations is strictly restricted to PG cron scheduled background jobs (`scheduled_jobs.sql`) and edge functions via `current_setting('app.service_role_key')`.

---

## 11. Development / Demo Access
- `devAccess` mechanism defined in `src/features/auth/lib/devAccess.ts`:
  - Controlled via `VITE_ENABLE_DEV_ACCESS` environment variable (defaults to `import.meta.env.DEV` for local dev).
  - In production builds (`import.meta.env.DEV === false` and `VITE_ENABLE_DEV_ACCESS="false"`), `isDevAccessEnabled()` evaluates to `false`, enforcing full authentication and role authorization guards.
  - Safe development tool in local environment; gated in production.

---

## 12. Privileged Operations
- Manager Account Approval / Suspension: Backend verified via `webhost` role checks in RPCs.
- Payment Settlements & Invoice Adjustments: Backend verified via `manager_id = auth.uid()` or tenant ownership in `process_payment_atomic`.
- Role Changes: Restricted to database triggers and webhost security-definer RPCs.

---

## 13. Confirmed Vulnerabilities
- None identified at P0 or P1 severity during Phase 1 inspection. High-risk RPCs and Storage buckets were previously hardened in migrations `20260811000000` through `20260811000003`.

---

## 14. Potential Risks
- **Frontend Linter Warnings**: 19 React Hook dependency array warnings across various components (`useEffect` missing dependencies). Non-critical, but recommended for clean code hygiene.

---

## 15. Items Requiring Phase 2
- Certification of cross-tenant and cross-manager RLS boundary testing across all 65 migrations.

---

## 16. Items Requiring Phase 3
- Full audit and fuzz-testing of all SECURITY DEFINER RPC parameter validation and search_path specifications.

---

## 17. Minimal Fixes Applied
- Standardized dependency parameter in `PushNotificationSettings.tsx` to align React Hook useEffect dependencies and pass lint validation cleanly.

---

## 18. Tests
- `npm run lint`: PASSED (0 errors, warnings noted).
- `npx tsc --noEmit`: PASSED (0 errors).
- `npx vitest run`: PASSED (125 tests passed across 12 test files).
- `npm run audit:prod`: PASSED (0 vulnerabilities).
- `npm run build`: PASSED (Production bundle built successfully).

---

## 19. Remaining Risks
- Unapplied DB migrations on remote database instances if project password/migrations are pending manual execution via Supabase SQL Editor.
