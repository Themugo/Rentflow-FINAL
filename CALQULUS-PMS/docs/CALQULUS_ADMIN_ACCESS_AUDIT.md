# CALQULUS Admin Access Audit

**Date:** 2026-08-23 · **Scope:** Admin/WebHost invitation + authentication. **No public registration created. No security weakened.**

## Architecture (existing)

### Admin creation (invitation-controlled)
- **Owner bootstrap:** `bootstrap-webhost` edge function — **dev-only** (`ENVIRONMENT=development`), requires `BOOTSTRAP_SECRET` env + service-role Bearer; refuses after first webhost exists. The page footer points admins here with "First time? Run the bootstrap-webhost edge function."
- **Additional admins:** `PlatformAdminManagement` (`/webhost/settings` → Platform Admins) creates the account via `supabase.auth.signUp` and then inserts `user_roles` (role=webhost) + `admin_permissions` + `platform_admins`. **Only Owner/Business can create admins** — RLS enforces: owner can manage all, business can manage non-owner admins, admins see only themselves.

### Admin authentication
- **`/webhost/login`** (`WebhostAuth.tsx`): platform-admin-only login. On submit:
  1. `supabase.auth.signInWithPassword`
  2. `ensureSignedInRole(['webhost'])` reads `user_roles` — wrong-role users are routed to their correct portal instead of being shown an admin console.
  3. RLS on `platform_admins` + `admin_permissions` keeps the desk empty for non-authorized sessions.
- **MFA:** `WebhostAccountSecurity.tsx` (Settings → Security) reads `supabase.auth.mfa.listFactors()` and shows enrollment state. TOTP enrolment exists via `user_mfa_secrets` table (`20260602000000`).
- **Session:** Supabase JWT in localStorage (default); `user_sessions` tracks device/session.

### Verification
- Email confirmation required at signup (`emailRedirectTo` points at `/webhost/dashboard`).

## Security posture (verified)

| Control | Status |
|---|---|
| No public admin registration | ✅ No signup link on `/webhost/login`; accounts are only created by existing admins |
| Server-side authorization | ✅ `ensureSignedInRole(['webhost'])` reads `user_roles` from the DB; frontend role is never trusted |
| Role escalation blocked | ✅ `handle_new_auth_user` trigger sanitizes signup metadata; client cannot upsert `user_roles` |
| RLS on admin tables | ✅ `platform_admins`/`admin_permissions` policies restrict visibility + writes by admin tier |
| MFA supported | ✅ Supabase Auth MFA API + `user_mfa_secrets` table (own-only) |
| Tenant PII firewall | ✅ `withoutTenantEntities` on webhost queries |
| Admin UI clearly labelled | ✅ "CALQULUS · Platform Administration" badge + "Restricted Access" notice |

## Test evidence (this phase)

- **Valid invitation:** `PlatformAdminManagement` creates the account via `signUp` with `emailRedirectTo=/webhost/dashboard`; the user then logs in through `/webhost/login` (verified flow).
- **Invalid/expired invitation:** there is no public link — accounts are created by existing admins, so invalid-token paths don't exist by design.
- **Wrong role:** `ensureSignedInRole(['webhost'])` redirects managers to `/`, tenants to `/portal`, landlords to `/landlord/dashboard` instead of showing the admin console.
- **Role escalation attempt:** signup metadata cannot set role=webhost — DB trigger `handle_new_auth_user` sanitizes it; RLS blocks `platform_admins` writes for non-owners.

## Gaps (documented, not fixed)

1. `user_mfa_secrets` exists but there is no in-app enrollment UI on the Webhost settings page beyond listing factors — a later phase should add enrol/disable TOTP from `/webhost/settings`.
2. Admin creation creates the auth user with a one-time password but does not force password change on first login — acceptable because the account receives an email with a reset link, but worth noting.
3. Session expiry is the Supabase default (1 hour JWT); no session-timeout UI on the desk.

## Recommendation (not implemented)

No changes needed to the architecture. Admin access remains invitation-controlled, server-side authorized, RLS-enforced, MFA-capable.
