# CALQULUS Tenant Invitation & Registration Audit

**Date:** 2026-08-23 · **Scope:** existing tenant invitation flow only — no parallel system created.

## Architecture (existing)

**Two paths exist:**

1. **Email-link invitation (primary)** — `/tenant/invitation?token=…` → `TenantAuth.tsx`
   - Manager runs `send-tenant-invitation` edge function → writes `tenant_invitations` row (token, email, property, unit, expires_at, invited_by, monthly_rent, house_deposit, water_deposit)
   - Tenant clicks the emailed link → `validate_invitation_token(token_value)` RPC (SECURITY DEFINER, server-side) validates `status='pending'` + `expires_at > now()`
   - Server-side fields (property, unit, rent, deposit) are read from the DB via the RPC — never trusted from the client
   - Sign-up goes through `create-tenant-account` edge function which gets `invited_by`, `property_id`, `unit`, rent, and deposits from the validated invitation — never from query params
   - Invitation marked `status='used'` + `used_at` after account creation
   - `notify-manager-tenant-signup` notifies the manager

2. **Code-based invitation (secondary)** — `/tenant/signup` → `TenantSelfRegister.tsx`
   - Invite code (`invite_code`) against `tenant_invitations` (pending, matching code)
   - Pre-fills email, unit, property from the row
   - Creates auth user + marks invitation accepted

## Security posture (verified)

| Control | Status |
|---|---|
| Server validates invitation ownership | ✅ `validate_invitation_token` is SECURITY DEFINER — RLS can't be bypassed |
| Property/unit IDs not trusted from client | ✅ RPC returns server-side rows |
| Single-use | ✅ `status='used'` + `used_at` after creation; RPC only returns `pending` |
| Time-limited | ✅ `expires_at > now()` filter in the RPC |
| Email pre-associated | ✅ prefilled from invitation; cannot be edited to another person without failing `invite_code`/`token` match |
| No tenant PII on other portals | ✅ tenant firewall in webhost queries |

## UX posture (verified)

- Invitation summary card shows: Property, Unit, invited-by contact (manager name/email/phone), lease terms are NOT shown in the invitation page (they're created server-side in `create-tenant-account`).
- Self-registration fallback: if no token, the page offers a self-registration ("Accounting mode") path.
- Verification: email confirmation link shown after signup ("Check Your Email" screen with resend "try again").
- Mobile-first: single-column max-w-md card, no multi-column layout.

## Test evidence (this phase)

- **Invalid token:** `/tenant/invitation?token=invalid-token-123` falls through to self-registration with the "Invalid Invitation" toast — no crash, no PII exposed. (Verified in browser.)
- **Valid/expired/used tokens:** server-side checks already in the RPC (`status='pending'` + `expires_at > now()`); client shows the same "invalid or expired" message — indistinguishable by design.
- **Refresh/back navigation:** token re-validated on mount; no stale invite rendered.

## Gaps (not fixed — documented)

1. `invited_by` is `text` in `tenant_invitations` but treated as uuid in some code paths — a type drift to resolve in a schema phase (not this phase).
2. The code-based path (`TenantSelfRegister`) uses a separate `invite_code` column; the email-link path uses `token`. Both are valid, but two invitation formats exist — the spec is fine with that as long as they don't compete.
3. `TenantSelfRegister`'s step indicator is a custom layout, not the shared step pill — visually consistent but not code-shared.

## Recommendation (not implemented)

Keep the email-link flow as primary. The code-based flow can stay for SMS-only delivery. No parallel system needed.
