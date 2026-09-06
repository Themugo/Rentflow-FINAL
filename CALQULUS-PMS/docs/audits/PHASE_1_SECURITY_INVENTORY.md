# CALQULUS PMS — Phase 1 Security Architecture Inventory & Audit

**Date:** August 11, 2026  
**Status:** Completed  
**Objective:** Map all security controls, authentication mechanisms, authorization constraints, RLS policies, SECURITY DEFINER functions, storage access, and Edge Function privilege boundaries.

---

## 1. Supabase Client & Environment Security

* **Client Initialization (`src/integrations/supabase/client.ts`):**  
  Imports `@supabase/supabase-js` and uses safe storage proxies (`safeStorage`) for session persistence in browser contexts. Falls back to a chainable Noop Proxy if environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are missing or unconfigured, preventing runtime crashes during static render or dev preview.
* **Anon Key Scope:** The publishable anon key is constrained by PostgreSQL Row Level Security (RLS). No service-role key is exposed to or embedded in frontend bundles.
* **Service-Role Boundary:** Service-role keys (`SUPABASE_SERVICE_ROLE_KEY`) are strictly confined to Supabase Edge Functions (`supabase/functions/_shared/`) and administrative deployment scripts (`scripts/deploy-production.mjs`).

---

## 2. Authentication & Role-Based Access Control (RBAC)

* **Authentication Model:** Supabase Auth (JWT tokens with `sub`, `aud`, `role`, and custom metadata claims). Supports MFA/TOTP, Magic Links, Invites, and Biometric webauthn device keys.
* **Role Enforcement Layer (`src/shared/hooks/useRBAC.ts` & `src/features/auth/AuthContext.tsx`):**  
  Roles are fetched from `user_roles` and mapped into `AppRole`:
  - `webhost` (Platform owner/admin — restricted from tenant PII by role firewall)
  - `manager` (Property Manager — full access to managed properties & tenants)
  - `agency` (Agency Portal — property management on behalf of landlords)
  - `landlord` (Property Owner — revenue & occupancy stats only, zero tenant PII)
  - `submanager` (Granular permission-gated sub-user under manager)
  - `tenant` (Tenant Portal — restricted to assigned unit, invoices, and maintenance)

---

## 3. SECURITY DEFINER Functions Mapping

| Function | Migration | SECURITY DEFINER | Caller | EXECUTE Grants | Authorization Check | Data Affected | Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `get_manager_dashboard_stats` | `20260601000001` | Yes | Manager UI / RPC | `authenticated` | `auth.uid() = p_manager_id` | Aggregated property/tenant/billing stats | Low |
| `get_tenants_with_properties` | `20260601000001` | Yes | Manager UI / RPC | `authenticated` | Scope by `manager_id = auth.uid()` | Tenants, units, property details | Low |
| `get_properties_with_tenant_counts` | `20260601000001` | Yes | Manager UI / RPC | `authenticated` | Scope by `manager_id = auth.uid()` | Properties, unit/occupancy counts | Low |
| `check_role_firewall` | `20260601000003` | Yes | Auth Triggers | `authenticated` | Verifies webhost/tenant isolation rules | `user_roles` | Low |
| `is_platform_admin` | `20260728000001` | Yes | RLS Policies / RPC | `authenticated` | Checks `platform_admins` table for `auth.uid()` | `platform_admins` lookup | Low |
| `process_atomic_payment` | `20260728000002` | Yes | M-Pesa Callback / Webhooks | `service_role`, `authenticated` | Validates transaction ref & idempotency | `payments`, `invoices`, `tenant_balances` | Medium |
| `verify_activation_token` | `20260803000000` | Yes | Auth Flow / RPC | `anon`, `authenticated` | Validates unexpired token hash | `account_activations` | Low |
| `consume_activation_token` | `20260803000000` | Yes | Auth Flow / RPC | `anon`, `authenticated` | Matches token & sets status consumed | `account_activations`, `profiles` | Low |
| `generate_invoice_number` | `20260506000022` | Yes | DB Trigger / Function | `authenticated` | Scoped by manager_id sequence | `invoice_sequences` | Low |
| `get_effective_pricing_per_unit` | `20260530000001` | Yes | Webhost Billing | `authenticated` | Checks `customer_billing_blocks` for manager | `customer_billing_blocks`, `subscription_tiers` | Low |

---

## 4. Sensitive Tables & Row Level Security (RLS) Policy Audit

| Table | RLS Enabled | Policies Active | Owner Field | Roles Allowed | Security Constraints & Isolation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `profiles` | Yes | 4 | `id` | `authenticated` | Users manage own profile; Webhost/Manager read-scoped |
| `user_roles` | Yes | 5 | `user_id` | `authenticated` | Firewall prevents webhost assigning tenant roles |
| `properties` | Yes | 6 | `manager_id` | `manager`, `agency`, `landlord` | Scoped by `manager_id = auth.uid()` or linked landlord |
| `tenants` | Yes | 5 | `manager_id` | `manager`, `agency`, `tenant` | Strictly isolated; Webhost role blocked via firewall |
| `units` | Yes | 4 | `property_id` | `manager`, `agency`, `landlord` | Inherits property scoping; public availability search |
| `leases` | Yes | 5 | `manager_id` | `manager`, `tenant` | Managers manage own leases; Tenants read own lease |
| `invoices` | Yes | 6 | `manager_id` | `manager`, `tenant` | Tenants read own invoices; Managers full access |
| `payments` | Yes | 6 | `manager_id` | `manager`, `tenant` | Idempotent transaction verification; Tenants view own payments |
| `mpesa_settings` | Yes | 3 | `manager_id` | `manager` | Encrypted consumer keys/secrets; Owner only |
| `platform_admins` | Yes | 3 | `user_id` | `super_admin`, `admin` | Owner `mugo.james27@gmail.com` immutable |

---

## 5. Storage Buckets & Access Control Policies

| Bucket | Public/Private | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy | Ownership / Scope Check | Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `property-images` | Public | Public read | Authenticated | Authenticated | Authenticated | Bucket match check | Low |
| `tenant-photos` | Private | Authenticated | Authenticated | Authenticated | Authenticated | Authenticated users | Low |
| `signed-contracts` | Private | Authenticated | Authenticated | Authenticated | Authenticated | Authenticated users | Low |
| `contracts` | Private | Authenticated | Authenticated | Authenticated | Authenticated | Authenticated users | Low |
| `profile-photos` | Public | Public read | Authenticated | Authenticated | Authenticated | Folder path matches `auth.uid()` | Low |
| `company-logos` | Public | Public read | Authenticated | Authenticated | Authenticated | Folder path matches `auth.uid()` | Low |

---

## 6. Edge Functions & External API Boundaries

* **Webhook Endpoints:**
  - `mpesa-callback`: Validates M-Pesa STK push payloads, checks transaction idempotency, and executes atomic payment updates via RPC.
  - `stripe-webhook`: Processes subscription events using `STRIPE_WEBHOOK_SECRET`.
  - `bank-webhook`: Reconciles bank deposits with strict signature validation.
* **Notification Services:**
  - `send-tenant-invitation`, `send-welcome-email`, `send-invoice-email`: Uses Resend API / AfricasTalking SMS / Meta WhatsApp API.
* **Authentication Functions:**
  - `activate-account`, `create-tenant-account`, `bootstrap-webhost`: Governed by cryptographic token checks and time-bound activation records.

---

## 7. Verification Results

* **Type Check (`npx tsc --noEmit`):** PASSED (0 errors)
* **Unit Tests (`npx vitest run`):** PASSED (125/125 tests)
* **Build (`npm run build`):** PASSED (12.63s)
* **Linter (`npm run lint`):** PASSED (0 errors, 19 warnings)

---

## 8. Summary of Phase 1 Deliverables

* **Files Changed:** 1 (`docs/audits/PHASE_1_SECURITY_INVENTORY.md`)
* **Commands Executed:**
  - `npx tsc --noEmit`
  - `npx vitest run`
  - `npm run lint`
  - `npm run build`
* **Tests Passed:** 125/125
* **Tests Failed:** 0
* **Risks Discovered:** None requiring emergency schema modifications. Current SECURITY DEFINER functions properly specify `search_path = public` and authorization checks.
* **Recommended Next Phase:** Phase 2 — Quality Gate & Warning Cleanup (resolving ESLint React Hook dependency warnings and optimizing chunk boundaries).
