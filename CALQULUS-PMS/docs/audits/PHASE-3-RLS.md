# Phase 3 — RLS & Multi-Tenant Security Certification

**Date:** 2026-08-22
**Method:** Local replay of all 79 migrations on `supabase/postgres` (Docker `calqulus-pg`), then behavioral RLS tests executed as the real `authenticated` role with JWT claims set (`request.jwt.claim.sub`), exactly as PostgREST does in production.
**Scope:** Table-level RLS coverage, permissive-policy audit, policy recursion defects, cross-manager and cross-tenant isolation, landlord-invitation token leak.

## Verdict: PASS (local certification) — live remediation SQL pending application

All findings below were reproduced, fixed, and re-verified against a fresh replay of
all 79 migrations (79/79 pass).

---

## 1. RLS coverage audit

- **127/127 public tables have RLS enabled** (force-disabled nowhere).
- **0 tables without at least one policy** after the fixes below.

## 2. Permissive policy lockdown (migration `20260822000000_rls_permissive_policy_lockdown.sql`)

Baseline audit found 13 policies with `qual = true` (any row readable/writable by any authenticated user). Disposition:

- **10 dropped/locked down** — including the `landlord_invitations` public-read leak (any signed-in user could enumerate all pending landlord invitation tokens and accept invitations).
- **3 intentionally retained as public reads** (reference/marketplace data): `kenya_water_companies`, `property_tier_limits`, `provider_reviews`.

### Landlord invitation leak → token-gated RPCs

`LandlordInvitationAccept.tsx` previously read `landlord_invitations` directly, which forced the overly-permissive policy. Replaced with:

- `get_landlord_invitation_by_token(p_token)` — SECURITY DEFINER, returns only non-sensitive invitation fields for the exact token.
- `accept_landlord_invitation(p_token)` — SECURITY DEFINER, validates token/expiry/status, rejects email mismatch, upserts `property_landlords` and `user_roles`, marks invitation accepted. Idempotent re-accept only for the user who already holds the property link; any other user replaying a spent token is rejected.

Also fixed a latent client bug: the `user_roles` upsert used `onConflict: 'user_id'` but the unique key is `(user_id, role)` — would have failed at runtime.

## 3. Critical: RLS policy infinite recursion (two cycles)

Any authenticated query over affected tables hard-failed with
`ERROR 42P17: infinite recursion detected`. Two independent cycles found and fixed:

1. **user_roles ↔ tenants** — `user_roles.manager_reads_tenant_roles` subqueried `tenants`; tenant policies (`tenant_reads_own_record`, etc.) subquery `user_roles` back. Fixed by replacing the policy's raw subqueries with SECURITY DEFINER helpers `my_manager_tenant_ids()` / `my_manager_submanager_ids()` (owner read bypasses RLS, breaking the cycle, semantics unchanged).
2. **tenants ↔ units** — `tenants.tenants_select` EXISTS-subqueries `units`; `units."Tenants can view their own unit"` and `units.tenant_reads_own_unit` subquery `tenants` back. Fixed with SECURITY DEFINER `my_tenant_unit_ids()` (built on existing definer `caller_tenant_ids()`).

## 4. Critical: `invoices_select` poisoned by `auth.users` read

Migration `20260601000000` added an `invoices_select` policy whose tenant branch ran
`SELECT email FROM auth.users WHERE id = auth.uid()`. The `authenticated` role has no
privilege on `auth.users`, so **every tenant read of the invoices table errored out**
(`permission denied for table users`). Rewritten to use the SECURITY DEFINER
`caller_tenant_ids()` role link instead of email matching.

## 5. Signup-path / seed-path NOT NULL violations (base schema defaults)

The `auth.users → handle_new_auth_user()` trigger path failed on fresh databases because
trigger-inserted rows (`profiles`, `user_roles`, `manager_profiles`) hit NOT NULL columns
without defaults — i.e. signup was broken for any DB built from migrations alone
(live DB presumably has dashboard-side defaults that migrations never captured).

Fixed in `20230101000000_base_schema.sql`:

- 69 audit `created_at`/`updated_at` columns: `DEFAULT now()`.
- `manager_profiles`: defaults mirror the intended definition in migration
  `20260506000014` (whose `CREATE TABLE IF NOT EXISTS` is skipped when the base table
  exists first — see Phase 2 duplicate-definition findings): `status='pending'`,
  `subscription_tier='starter'`, `max_properties=5`, `max_units=50`, `billing_day=1`,
  `platform_rate=500`, `billing_method='mpesa'`, counts `=0`. The tier CHECK constraint
  from migration 14 is intentionally **not** carried over — migration 18 later adds
  `lite`/`pro` tier keys it would reject.
- `properties`: `occupied=0`, `revenue=0`, `status='active'`, `units=0` defaults.

## 6. Behavioral isolation tests (evidence)

Runnable scripts in `supabase/tests/rls/` (each wrapped in BEGIN/ROLLBACK):

| Test | Result |
|------|--------|
| `landlord_invitation_rpc.sql` | Token lookup works; unauthenticated accept rejected; email-mismatch accept rejected; accept creates `property_landlords` + approved `landlord` role + marks accepted; idempotent re-accept for owner; spent token replayed by a different user rejected; direct `SELECT` on `landlord_invitations` permission-denied |
| `cross_manager_isolation.sql` | Manager A sees only own property (Manager B's invisible); INSERT with another manager's `manager_id` blocked by RLS WITH CHECK |
| `tenant_isolation.sql` | Tenant A sees only own invoice (`INV-A-001`) and only own tenant record |
| `tenant_read_matrix.sql` | Tenant self-read of `user_roles`, `tenants`, `invoices` all succeed (previously: recursion / permission errors) |
| `manager_read_matrix.sql` | Manager reads: 1 property, 1 tenant, 1 unit, 1 invoice (own only); sees 2 `user_roles` rows (own manager role + own tenant's role) |

## 7. Harness improvements

`supabase/tests/harness/000_local_replay_shim.sql` now grants hosted-style default
table privileges to `authenticated`/`anon` (hosted Supabase does this via platform
defaults outside migrations), so RLS behavior tests match production. Migration
`20260506000022c`'s `REVOKE ... FROM anon` is preserved and still applies.

## 8. Gate check

| Gate | Result |
|------|--------|
| `replay-migrations.sh` | 79/79 pass |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 904 passed / 1 skipped (905) |
| Permissive `qual=true` policies | 3, all intentional public reference reads |
| RLS coverage | 127/127 tables enabled, ≥1 policy each |
| Cross-manager / cross-tenant isolation | verified in-DB |

## 9. Not certified (out of scope / pending)

- **Live application**: fixes exist only as migration `20260822000000_rls_permissive_policy_lockdown.sql`; the live Supabase project must still receive it (paste into SQL Editor or `supabase db push`). Live anon `tenants` REST 42P17 from earlier audits remains until `supabase/sql/apply-live-p1-rls.sql` is applied.
- **Webhost tenant firewall** at the RLS layer (webhost policies exist per-table; no dedicated negative test matrix yet).
- Storage bucket policies and edge-function auth paths — Phases 8–10.
