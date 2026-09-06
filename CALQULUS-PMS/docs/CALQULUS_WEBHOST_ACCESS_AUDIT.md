# CALQULUS WebHost Access Audit

**Date:** 2026-08-23 · **Scope:** WebHost/Admin operator authentication only. **No public registration created. No security weakened.**

## Architecture (existing)

### Operator creation (invitation-controlled)
- **First operator:** `bootstrap-webhost` edge function — **dev-only**, requires `BOOTSTRAP_SECRET` + service-role Bearer, refuses after first webhost exists. Linked from the login page footer ("First time? Run the bootstrap-webhost edge function").
- **Additional operators:** `PlatformAdminManagement` (`/webhost/settings` → Platform Admins) creates the account server-side via `supabase.auth.signUp` + `user_roles` (role=webhost) + `admin_permissions` + `platform_admins`. **Only Owner/Business can create operators**; RLS on `platform_admins` enforces tier boundaries.

### Operator authentication
- **`/webhost/login`** (`WebhostAuth.tsx`): operator-only login. `ensureSignedInRole(['webhost'])` reads `user_roles` from the DB — wrong-role users are routed to their correct portal instead of the desk.
- **MFA:** `WebhostAccountSecurity.tsx` reads `supabase.auth.mfa.listFactors()`; TOTP enrolment is supported via `user_mfa_secrets`.
- **Session:** Supabase JWT (1h default) in localStorage; `user_sessions` tracks device/session; sign-out calls `signOut()` and clears the session.

## Security posture (verified)

| Control | Status |
|---|---|
| No public WebHost registration | ✅ `/webhost/login` has no signup link; accounts are created by existing operators or the dev-only bootstrap |
| Server-side authorization | ✅ `ensureSignedInRole(['webhost'])` reads `user_roles` from the DB; role is never trusted from the client |
| Role escalation blocked | ✅ `handle_new_auth_user` trigger sanitizes signup metadata; RLS blocks `platform_admins` writes for non-owners |
| Wrong-role redirect | ✅ Manager → `/`, Tenant → `/portal`, Landlord → `/landlord/dashboard` instead of the operator desk |
| MFA supported | ✅ Supabase Auth MFA API + `user_mfa_secrets` |
| Tenant PII firewall | ✅ `withoutTenantEntities` on all operator queries |
| Infrastructure secrets masked | ✅ `lib/secrets.ts` masks secret-shaped keys in logs/config; operator desks show "No live probe" where none exists rather than fabricating |
| CALQULUS ADMIN clearly labelled | ✅ "CALQULUS · Platform Administration" + "Restricted Access — Authorized Personnel Only" |

## Test evidence (this phase)

- **Unauthorized access:** `/webhost` redirects to `/webhost/login` (verified).
- **Wrong password:** stays on `/webhost/login` (verified — no redirect into the desk).
- **No public signup:** the login card has no "create account" path.
- **Operator desk after authorized login:** all `/webhost/*` pages render with the teal accent and tenant-firewall notices intact.

## Gaps (documented, not fixed)

1. No in-app TOTP enroll/disable UI on Webhost settings beyond factor listing — same gap as Phase 8.
2. No session-timeout UI on the desk; expiry follows the Supabase default.
3. `bootstrap-webhost` writes the first operator in the browser console pattern — acceptable as a dev-only bootstrap, but production operators should be created via the owner flow once the first owner exists.

## Recommendation (not implemented)

No changes needed. Operator access is invitation-controlled, server-side authorized, RLS-enforced, MFA-capable, and secrets never reach the desk.
