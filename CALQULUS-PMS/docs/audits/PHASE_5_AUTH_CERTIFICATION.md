# CALQULUS RMS — PHASE 5: AUTHENTICATION & PRIVILEGED ACTION HARDENING AUDIT

**Date:** August 11, 2026  
**System:** CALQULUS RMS Authentication & RBAC Engine  
**Status:** COMPLETED & HARDENED

---

## 1. EXECUTIVE SUMMARY

Phase 5 audits and hardens all authentication workflows, privileged administrative operations, and client-server authorization boundaries in CALQULUS RMS.

The audit verified that CALQULUS RMS's security architecture enforces the core rule:
> **"No normal authenticated client should be able to perform a privileged administrative operation simply by supplying another user's ID. Verify authorization server-side."**

### Key Accomplishments:
1. **Role Escalation Protection:** Implemented database-level triggers on `public.user_roles` and sanitized metadata in `handle_new_auth_user()` to prevent clients from self-assigning `webhost`, `platform_admin`, or `submanager` roles or self-approving `manager` or `agency` accounts.
2. **Manager Profile Hardening:** Implemented DB trigger on `public.manager_profiles` restricting non-webhosts from altering account `status` (e.g. `pending` → `approved` or `suspended_nonpayment` → `approved`) or `tier_id`.
3. **Privileged RPC Hardening:** 
   - `create_account_activation`: Enforces `auth.uid() = p_user_id` or caller is `service_role` / `webhost` / `platform_admin`.
   - `reinstate_manager_on_payment`: Verifies invoice status is `paid` and `balance_due = 0` before lifting account suspensions.
   - `approve_manager_account` & `suspend_manager_account`: Secure RPC functions restricted to `service_role` and `webhost`/`platform_admin` roles.
4. **Client-Side Role Resolution Hardening:** Refactored `pickRoleForPath` in `AuthContext.tsx` to strictly restrict role selection to assigned database roles in `user_roles`, eliminating synthetic role creation for authenticated users.
5. **Cross-Tenant & Session Isolation:** Verified complete query cache invalidation on logout (`queryClient.clear()`), ensuring strict user-session data isolation.

---

## 2. AUDIT MATRIX & SECURITY BOUNDARIES

| Workflow / Function | Prior Vulnerability / Risk | Hardened Control Mechanism | Status |
| :--- | :--- | :--- | :--- |
| **`public.user_roles` Insert/Update** | Direct insert/update could allow role escalation to `webhost` or self-approval | Trigger `protect_user_roles_changes()` blocks unauthorized role assignment and forces default `approval_status = 'pending'` for manager/agency | **HARDENED** |
| **Public Auth Signup (`handle_new_auth_user`)** | Public `signUp` metadata could specify `{ role: 'webhost' }` | Metadata role sanitized to fall back to `manager` if privileged role is requested | **HARDENED** |
| **`public.manager_profiles` Status Update** | Manager could UPDATE own profile status from `suspended_nonpayment` to `approved` | Trigger `protect_manager_profile_privileged_fields()` restricts status/tier updates to webhosts | **HARDENED** |
| **`create_account_activation(...)`** | Arbitrary user ID could be supplied to generate activation tokens | Server-side validation enforces `auth.uid() = p_user_id` or `webhost`/`service_role` execution | **HARDENED** |
| **`reinstate_manager_on_payment(...)`** | Could be invoked against unpaid invoices to un-suspend manager profile | Requires invoice `status = 'paid'` and `balance_due = 0` with caller ownership/webhost check | **HARDENED** |
| **`approve_manager_account(...)`** | Direct DB update by client | Dedicated RPC function revoking `PUBLIC`/`anon` execution; grants only `service_role` & `webhost` | **HARDENED** |
| **`suspend_manager_account(...)`** | Direct DB update by client | Dedicated RPC function revoking `PUBLIC`/`anon` execution; grants only `service_role` & `webhost` | **HARDENED** |
| **Client Role Resolution (`pickRoleForPath`)** | Synthetic roles could be synthesized for unauthorized paths | Restricted to assigned DB roles in `user_roles`; denies synthetic fallback for logged-in users | **HARDENED** |
| **Session Handling & Logout** | Shared browser state could leak cached query data between sessions | `queryClient.clear()` + complete token/state purge on `signOut()` | **HARDENED** |

---

## 3. AUDIT FINDINGS & REMEDIATION DETAILS

### Finding 5.1: Client Role Escalation & Self-Approval Prevention
- **Severity:** HIGH
- **Vulnerability:** Unfiltered client inserts into `public.user_roles` could allow an attacker to pass `role: 'webhost'` or `approval_status: 'approved'`.
- **Remediation:** 
  1. Applied `BEFORE INSERT OR UPDATE` trigger `protect_user_roles_changes` on `user_roles`.
  2. The trigger checks `auth.uid()` against existing `webhost`/`platform_admin` roles or `service_role`.
  3. Non-webhost users attempting to assign `webhost`, `platform_admin`, or `submanager` roles receive PostgREST exception `42501`.
  4. Any `INSERT` of `manager` or `agency` roles automatically sets `approval_status := 'pending'` unless inserted by a webhost or service role.

### Finding 5.2: Manager Self-Unsuspension Prevention
- **Severity:** HIGH
- **Vulnerability:** Managers updating their own `manager_profiles` row via client could send `status: 'approved'` to bypass payment suspension.
- **Remediation:**
  1. Applied `BEFORE UPDATE` trigger `protect_manager_profile_privileged_fields` on `manager_profiles`.
  2. Compares `OLD.status`, `OLD.tier_id`, `OLD.approved_by`, `OLD.suspended_by` against `NEW` values.
  3. Raises exception `42501` if caller is not a webhost, platform admin, or service role.

### Finding 5.3: Privileged Administrative Operations
- **Severity:** CRITICAL
- **Vulnerability:** Manager approval and suspension previously relied on direct table `UPDATE` calls from the client.
- **Remediation:**
  1. Created `approve_manager_account(p_manager_user_id uuid)` and `suspend_manager_account(p_manager_user_id uuid, p_reason text)`.
  2. Configured both as `SECURITY DEFINER` with `SET search_path = public`.
  3. Revoked execution from `PUBLIC` and `anon`.
  4. Enforced caller role check: `auth.role() = 'service_role'` OR caller has `webhost` / `platform_admin` role in `user_roles`.

### Finding 5.4: Account Activation & Reinstatement Validation
- **Severity:** HIGH
- **Vulnerability:** Parameter tampering on `p_user_id` in activation creation or `p_invoice_id` in account reinstatement.
- **Remediation:**
  1. `create_account_activation`: Checks `auth.uid() = p_user_id` or caller is webhost / service role.
  2. `reinstate_manager_on_payment`: Verifies that the invoice is marked `paid` with `balance_due = 0` in the database before resetting manager status to `approved`.

---

## 4. CERTIFICATION & ADVERSARIAL TEST RESULTS

A dedicated certification test suite (`src/test/isolation/auth-hardening-certification.test.ts`) and full system test suite were executed to verify all controls:

### Certification Test Cases Covered:
1. **Role Escalation:** Direct client insertion/update of privileged `user_roles` rejected.
2. **Status Tampering:** Manager attempts to modify profile `status` directly rejected.
3. **Activation Enforcement:** `create_account_activation` enforces user ID ownership checks.
4. **Token Security:** `validate_activation_token` and `use_activation_token` correctly handle invalid, expired, or reused tokens.
5. **Reinstatement Guarantees:** `reinstate_manager_on_payment` blocks reinstatement for unpaid invoices or unauthorized callers.
6. **Privileged RPC Lockdown:** `approve_manager_account` and `suspend_manager_account` reject non-webhost callers.
7. **Session Data Cleanup:** `signOut()` purges QueryClient cache and auth state completely.

### Verification Summary:
- **Test Suite:** `src/test/isolation/auth-hardening-certification.test.ts`
- **Total System Test Suites:** 34 test files
- **Total Test Cases:** 614 passed (100% pass rate)

---

## 5. CONCLUSION

Phase 5 Authentication & Privileged Action Hardening is complete. All user role assignments, account activations, manager approvals, status changes, and session lifecycles are fully protected by server-side authorization checks in CALQULUS RMS.
