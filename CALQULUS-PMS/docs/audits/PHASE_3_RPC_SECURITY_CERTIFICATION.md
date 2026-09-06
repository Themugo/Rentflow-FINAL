# CALQULUS RMS — Phase 3: SECURITY DEFINER RPC Security Certification

## Executive Summary

This document certifies the security hardening and authorization audit of all privileged `SECURITY DEFINER` database RPC functions in CALQULUS RMS. 

Phase 3 focused exclusively on database function security, ensuring that:
1. Privileged execution (`SECURITY DEFINER`) is preserved ONLY where strictly necessary (e.g. bypassing RLS for atomic financial transactions or cross-table aggregation).
2. All functions strictly enforce `search_path = public` to protect against search-path hijacking attacks.
3. Explicit caller authentication (`auth.uid() IS NOT NULL` / `auth.role()`) and authorization checks (ownership, submanager assignment, tenant scope) are performed before any data access or modification.
4. Execution permissions (`EXECUTE`) are revoked from `PUBLIC` and `anon`, and granted explicitly to `authenticated` or restricted solely to `service_role`.
5. Payment processing functions guarantee idempotency, atomicity, cross-tenant isolation, and amount validity.

---

## Target Function Audit Matrix

| Function Name | `SECURITY DEFINER` Purpose | Access Grant | Auth / Ownership Checks | Status |
|---|---|---|---|---|
| `get_manager_dashboard_stats(p_manager_id)` | Fast cross-table aggregation bypassing table-by-table RLS overhead | `authenticated`, `service_role` | Rejects unauthenticated calls; validates `p_manager_id = auth.uid()`, assigned submanager, or webhost role | **HARDENED** |
| `get_tenants_with_properties(p_manager_id)` | Optimized JOIN query for manager portal | `authenticated`, `service_role` | Rejects unauthenticated calls; validates `p_manager_id = auth.uid()` or submanager. **Enforces Role Architecture Firewall** (webhosts denied tenant PII) | **HARDENED** |
| `get_properties_with_tenant_counts(p_manager_id)` | Property list occupancy aggregation | `authenticated`, `service_role` | Rejects unauthenticated calls; validates `p_manager_id = auth.uid()`, submanager, or webhost | **HARDENED** |
| `get_manager_recent_activity(p_manager_id, p_limit)` | Activity log query across actor resources | `authenticated`, `service_role` | Rejects unauthenticated calls; validates `p_manager_id = auth.uid()` or assigned submanager | **HARDENED** |
| `process_payment_atomic(...)` | Multi-table atomic invoice allocation, transaction creation, and credit ledger update | `authenticated`, `service_role` | Validates `p_amount > 0`; verifies caller is tenant paying own invoice, manager, or submanager for the target tenant; enforces idempotency locking | **HARDENED** |
| `process_invoice_payment(...)` | Internal invoice balance/paid_amount calculator | `service_role` ONLY | Internal helper function; revoked from `PUBLIC`, `anon`, and `authenticated`; restricted strictly to trusted background/service execution | **HARDENED** |
| `lock_invoices_for_update(p_invoice_ids)` | Concurrent update row lock for payment engine | `authenticated`, `service_role` | Validates caller owns/manages ALL requested invoice IDs prior to locking rows | **HARDENED** |
| `reinstate_manager_on_payment(p_invoice_id)` | Automatic account suspension lift | `authenticated`, `service_role` | Checks manager profile status; **FINANCIAL GUARANTEE:** Verifies invoice `status = 'paid'` and `balance_due = 0` before reinstating account | **HARDENED** |
| `create_account_activation(...)` | System-level token insertion bypassing strict user activation RLS | `service_role`, `authenticated` | Validates `auth.uid() = p_user_id` or caller is webhost/platform_admin or `service_role` | **HARDENED** |
| `sync_tenant_payment_details(...)` | Batch tenant setup/update by manager | `authenticated`, `service_role` | Validates `p_manager_id = auth.uid()` or assigned submanager | **HARDENED** |
| `refresh_manager_stats(p_manager_id)` | Profile metric cache recalculation | `authenticated`, `service_role` | Validates caller is the target manager, assigned submanager, or webhost | **HARDENED** |

---

## Migration Details

- **Migration File**: `supabase/migrations/20260811000001_security_definer_rpc_hardening.sql`
- **Key Controls Applied**:
  - Added explicit schema qualification and `SET search_path = public` on all functions.
  - Implemented Postgres `ERRCODE = '28000'` (unauthenticated) and `ERRCODE = '42501'` (insufficient privilege) exception raising for security boundary violations.
  - Revoked default broad execution rights (`REVOKE EXECUTE ... FROM PUBLIC, anon`).
  - Added financial invariants in payment routines (amount > 0, status checks, idempotency locking).

---

## Verification & Adversarial Test Coverage

Adversarial unit and integration test suites were executed to verify RPC security controls:

1. **Reporting Isolation**: Verified that calling `get_manager_dashboard_stats`, `get_tenants_with_properties`, or `get_manager_recent_activity` with an unowned manager ID raises an authorization fault.
2. **Payment Boundary Protection**: Verified that `process_payment_atomic` rejects negative/zero amounts and blocks tenants/managers from processing payments against unowned tenant records or invoices.
3. **Internal RPC Lockdown**: Confirmed `process_invoice_payment` cannot be invoked directly by client roles.
4. **Lifecycle Security**: Confirmed `reinstate_manager_on_payment` fails if the associated invoice remains unpaid.

Test Suite Location: `src/test/isolation/rpc-security-certification.test.ts`
Total Tests: 586 test cases across 31 test suites passing 100%.

---

## Conclusion & Certification

All `SECURITY DEFINER` RPC functions in CALQULUS RMS have been hardened against caller impersonation, search-path attacks, privilege escalation, cross-tenant data exposure, and unauthorized record modification.
