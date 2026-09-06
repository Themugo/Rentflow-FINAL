# Phase 7 — Authentication Certification

**Date:** 2026-08-22
**Method:** Reviewed the full auth surface — signup/role assignment, role resolution, activation tokens, password reset, approval gating, session handling — and audited the DB triggers/RPCs that back them against the replayed 84-migration schema.
**Scope:** Auth privilege boundaries, activation-token lifecycle, approval flow, session config.

## Verdict: PASS — 1 critical defect fixed

Auth privilege boundaries are well-hardened (role sanitization, RLS, gated RPCs,
approval flow). One critical defect — a broken activation-token insert that would have
made account creation fail — was found and fixed.

---

## 1. Auth privilege boundaries — solid

| Area | Status |
|------|--------|
| Client-side role assignment | ✅ roles come from DB trigger + gated RPC, never client upsert (privilege-escalation guarded) |
| `handle_new_auth_user` trigger | ✅ sanitizes self-assigned privileged roles (`webhost`/`platform_admin`/`submanager` → forced to `manager`) |
| `notify-new-manager-signup` edge fn | ✅ whitelist (`manager`/`agency`/`landlord`), invalid → `manager`; only emails webhosts for manager/agency |
| `user_roles` RLS | ✅ only own-role reads + webhost admin; no privileged self-assignment |
| `create_account_activation` RPC | ✅ hardened (SECURITY DEFINER + auth.uid() check + webhost/service_role gate) |
| Approval gating | ✅ pending manager/agency → `PendingApproval`; webhost approves via `user_roles` update |
| Session config | ✅ `persistSession`, `autoRefreshToken`, `detectSessionInUrl`; `onAuthStateChange` + `queryClient.clear()` on sign-out |
| Activation-token lifecycle | ✅ validate (unused + not expired) → set password → mark used |

## 2. DEFECT FIXED — activation-token insert was broken

`create-tenant-account` creates an activation token with a direct insert:

```ts
.from("account_activations").insert({ user_id: userId })  // token is auto-generated via database default
```

But `account_activations.token` and `.expires_at` are `NOT NULL` with **no column
default and no trigger**. The comment was false — the insert would fail with a not-null
violation, breaking account creation (the `INSERT ... RETURNING token` needed a token
that was never generated).

**Fix (`20260822000005`):** added secure defaults to the table:
- `token` → `encode(gen_random_bytes(32), 'hex')` (256-bit, cryptographically secure)
- `expires_at` → `now() + 24 hours` (matches the activation email's 24-hour expiry)
- `UNIQUE` index on `token` (belt-and-suspenders against collision)

Verified against the replayed schema: the exact `INSERT (user_id) RETURNING token`
now succeeds, produces a 64-char token, `expires_at > now()`, and
`validate_activation_token` resolves it to the user.

## 3. Gate check

| Gate | Result |
|------|--------|
| `replay-migrations.sh` | 84/84 pass |
| `npx tsc --noEmit` | clean |
| `npx vitest run` (full) | 904 passed / 1 skipped (905) |
| Auth isolation tests (`auth-hardening`, `rpc-security`) | 18/18 pass |
| Activation-token insert (the broken path) | now succeeds, token valid |

## 4. Not certified (out of scope / pending)

- **Live application**: `20260822000005` is a migration; the live Supabase project must
  receive it. It's a safe `ALTER COLUMN SET DEFAULT` + index — apply in a low-traffic
  window (brief lock).
- **End-to-end auth flow in a browser**: signup → email → activate → login verified at
  the DB/RPC/edge-fn layer; the full browser flow is Phase 24 E2E.
- **MFA / passwordless / OAuth providers**: not configured; out of current scope.
- **Session inactivity timeout**: Supabase JWT expiry is the effective session limit;
  no app-level inactivity logout (acceptable for a PMS, but note if a shorter timeout
  is a compliance requirement).
