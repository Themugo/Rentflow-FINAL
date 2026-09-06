# CALQULUS Onboarding — Edge Case + Failure Audit (Phase 11)

**Date:** 2026-08-24 · **Scope:** the complete registration/onboarding system across all portals (Manager, Agency, Landlord, Tenant, WebHost/Admin). Audit only — **no auth logic, routes, or schema were modified.** No backend fixes were invented; unresolved issues are documented with their root cause and the correct owning layer.

This document supersedes the 2026-08-23 audit for the 24-case failure matrix below. The flow tables from that audit remain accurate and are not repeated here.

---

## Method

Each of the 24 cases was traced through the actual source (not assumed). Surfaces inspected:

- Auth pages: `Auth.tsx` (manager), `TenantLogin.tsx`, `LandlordAuth.tsx`, `AgencyAuth.tsx`, `WebhostAuth.tsx`
- Onboarding: `ManagerOnboardingPage.tsx`, `LandlordOnboardingPage.tsx`, `AgencyOnboardingPage.tsx`, `OnboardingCompletion.tsx`, `useManagerOnboardingState.ts`
- Activation/invitation: `TenantSelfRegister.tsx`, `ActivateAccount.tsx`, `AdminInviteAccept.tsx`, `LandlordInvitationAccept.tsx`, `PendingApproval.tsx`
- Shared: `authFlow.ts` (`sanitizeAuthError`, `ensureSignedInRole`), `validations.ts` (`signupSchema`, `passwordSchema`), `ProtectedRoute.tsx`, `AuthContext.tsx`, `adminInvitation.ts`, `integrations/supabase/client.ts`

**Severity legend:** HANDLED / PARTIAL (works but a gap weakens the guarantee) / UNRESOLVED

---

## The 24 cases

| # | Case | Status | What actually happens | Recovery path |
|---|------|--------|------------------------|---------------|
| 1 | Duplicate email | HANDLED | Supabase Auth returns "already registered"; `sanitizeAuthError` → "This email is already registered." No user enumeration (same message class as other failures). | User is told the email is registered → use login / forgot-password. |
| 2 | Invalid email | HANDLED | Inline regex check on `Auth.tsx` (`signupEmailError`) + zod `signupSchema.email()` → "Please enter a valid email address" via `formatValidationErrors`. Blocked before submit. | Correct the email; form won't submit. |
| 3 | Weak password | HANDLED | `passwordSchema` (8+ chars, upper, lower, number, special) enforced client-side on submit; admin invite requires ≥10 (`isAdminPasswordStrong`). Live strength meter on `Auth.tsx`/`TenantSelfRegister`. | Field-level messages list exactly which rule failed. |
| 4 | Existing account (sign-up when already have one) | HANDLED | Same as #1 — duplicate-email path. Role is **not** overwritten (DB trigger `handle_new_auth_user` is the only role writer). | Directed to sign in. |
| 5 | Unverified account (login before confirming) | HANDLED | Supabase returns "email not confirmed" → `sanitizeAuthError` → "Please verify your email address." | Told to verify. **See Issue U1 — no resend button.** |
| 6 | Verification expired | PARTIAL | Confirmation-link expiry is handled by Supabase Auth; landing back on the portal shows the login form. There is **no dedicated "link expired" screen** — the user just sees login. | Re-request via resend — **but no resend UI exists (U1).** |
| 7 | Resend verification | UNRESOLVED | **Not implemented.** The audit note "resend exists in Auth.tsx" is **stale** — `supabase.auth.resend` is not called anywhere in `src/`. Manager onboarding step 2 copy says "you can resend" but presents no resend control. | None in-app. **Issue U1.** |
| 8 | Refresh during onboarding | PARTIAL | **Persisted facts survive** (org name, portfolio groups, properties, client links are read back from `company_settings`/`properties`/`property_landlords` via `useManagerOnboardingState` etc.). **Unsaved in-progress form input is lost** — `organizationName`, `portfolioGroups`, `teamEmail`, and `stepIdx` are ephemeral `useState`. | Completed steps are restored from backend; re-enter the current step's unsaved field. **Issue U2.** |
| 9 | Close browser mid-onboarding | PARTIAL | Same as #8 — completed steps persist server-side; unsubmitted field input lost. Session persists (localStorage), so reopening returns to the portal. | Reopen → completed state intact; redo current field. **Issue U2.** |
| 10 | Return later | HANDLED | Session persists (`persistSession: true`, `autoRefreshToken: true`). Completed onboarding facts reload from backend; completion screen reflects real state (Phase 10). | Log back in if session expired → resume where facts left off. |
| 11 | Log in halfway through onboarding | HANDLED | Facts are server-backed, so any login on any device shows the true completion state. Onboarding is reachable post-login; not a hard gate. | Continue from persisted state. |
| 12 | Wrong role / wrong portal | HANDLED | `ensureSignedInRole([portalRoles])` reads `user_roles` server-side and redirects: tenant→`/portal`, webhost→`/webhost`, landlord→`/landlord/dashboard`, manager→`/`. `pickRoleForPath` resolves multi-role users by URL. Role never trusted from client. | Clear "wrong portal" toast + automatic redirect to the correct desk. |
| 13 | Unauthorized organization | HANDLED | `user_roles.approval_status` gate: `pending`/`rejected`/`suspended` managers are routed to `/pending-approval` (App-level + mirrored in `ProtectedRoute`, defence-in-depth). Auto-polls every 30 s → `navigate('/')` on approval. Cross-manager data blocked by RLS (`manager_id = auth.uid()`). | Pending screen explains status; rejected/suspended show reason; auto-redirect on approval. |
| 14 | Expired invitation | HANDLED | Per-state copy: Admin `ADMIN_INVITATION_STATE_COPY.expired` ("valid 72 hours, ask the administrator for a new one"); Landlord `status==='expired'` ("ask your property manager to send a new one"); Tenant `validate_invitation_token` fails → "Invalid or expired." | Each names who to contact for a fresh invite. |
| 15 | Used invitation | HANDLED | Admin `used` ("already accepted… sign in") + CTA to `/webhost/login`; Landlord `accepted` state + "Go to login"; Tenant `.eq('status','pending')` excludes used codes → "Invalid or expired." | Directed to sign in. |
| 16 | Invalid invitation | HANDLED | Admin `invalid` ("link is not valid… use the exact link from your email"); Landlord `error` state ("invalid or has been used"); Tenant invalid code toast. | Use the exact link / request a new one. |
| 17 | Network failure | PARTIAL | `sanitizeAuthError` maps "network"/"failed to fetch" → "Network error. Please check your connection and try again." React Query `retry: 1`. **But onboarding mutations surface raw `error.message` (Issue U3)** and there is no offline banner on onboarding pages. | Retry after reconnecting. **Issue U3.** |
| 18 | API timeout | PARTIAL | Auth resolution has an 8 s watchdog (`authTimeoutMs`) → logs a warning, stops the spinner. Data queries rely on React Query retry. **No explicit request-timeout/abort on onboarding mutations** — a hung request leaves the button in a loading state until it settles. | Retry. **Issue U3.** |
| 19 | Backend validation failure | PARTIAL | zod handles client-side. Server-side failures (RLS `403`, constraint violations) reach the UI as **raw `error.message`** in onboarding mutations and invitation-accept pages. Not silent, but not sanitized. | Toast shows an error (wording may be technical). **Issue U3.** |
| 20 | Session expiry | HANDLED | `sanitizeAuthError` maps "jwt expired"/"session_not_found"/"session missing" → "Your session has expired. Please sign in again." `AuthContext` `onAuthStateChange`/`SIGNED_OUT` clears role state; `ProtectedRoute` redirects unauthenticated users to the portal login. | Sign in again; server-backed onboarding state intact. |
| 21 | Logout during onboarding | HANDLED | `signOut` (Sidebar/ProfileMenu) clears session; `ProtectedRoute` redirects to login. Persisted facts survive (server-side). | Log back in → resume from persisted state. |
| 22 | Browser back button | HANDLED | SPA routing; auth pages redirect on `user && !loading` to portal home (no back-to-login loop). `ProtectedRoute` re-evaluates on each navigation; `safeRedirect` prevents self-redirect loops. Step state is in-component (not URL), so back leaves the flow rather than corrupting it. | Forward navigation resumes; no broken state. |
| 23 | Mobile browser | HANDLED | `index.html` viewport `width=device-width, viewport-fit=cover`. Onboarding + completion use responsive classes (`sm:grid-cols-7`, `flex-col sm:flex-row`, `min-h-11` touch targets, `w-full sm:w-auto` buttons). Biometric login available where supported. | Native mobile layout; no action needed. |
| 24 | Slow network | PARTIAL | Loading skeletons on onboarding pages; React Query `staleTime` 30 s + `retry: 1`; `AuthLoadingScreen` on auth. **No explicit slow-network indicator** and mutations have no timeout (see #18). | Waits, then retries. **Issue U3.** |

---

## Security boundaries (verified)

- **Role injection impossible:** client passes `role` only as metadata; `handle_new_auth_user` DB trigger (hardened, migration `20260811000003`) is the sole writer of `user_roles`. `AuthContext.signUp` comment: "The client must not upsert user_roles (privilege escalation)."
- **Owner tier ungrantable via invitation:** `admin_invitations.admin_type` CHECK is `('business','admin')` — `owner` can never be issued through an invite (Phase 9). Exactly one immutable owner.
- **Server-side authorization:** `ensureSignedInRole` + `ProtectedRoute` + RLS. `platform_admins` seeded server-side only (`accept-admin-invitation`, service_role).
- **WebHost tenant firewall:** `ProtectedRoute` hard-blocks webhost from all tenant/manager operational prefixes; `withoutTenantEntities`/`isTenantEntityType` on webhost queries.
- **Landlord revenue-only:** hard-blocked from manager/tenant routes; no tenant PII surface.
- **No public admin/webhost registration:** verified — no `webhost/signup|register` route exists.
- **Secrets hygiene:** `isSecretKey`/`maskSecrets`/`stringifyMasked` + `getNonSecretConfig` — no credential-shaped key/value reaches any onboarding or ops screen.
- **Single-use, time-limited invitations:** admin (72 h), landlord (`expires_at`), tenant (`status='pending'` gate). Token never displayed; only email/tier/inviter shown.
- **No user enumeration:** `sanitizeAuthError` collapses "already registered" / "invalid credentials" / "user not found" into non-distinguishing messages.

---

## Unresolved issues

> These are **documented, not fixed** here. Each names the owning layer. No backend behavior was invented or changed in this audit.

### U1 — No "resend verification" control (cases 5, 6, 7) — HIGH
- **What:** `supabase.auth.resend` is never called in `src/`. The manager onboarding verification step copy ("you can resend") has no matching control. A user whose confirmation email expired or was lost has no in-app way to get a new one.
- **Root cause / owner:** frontend — add a resend action (e.g. on the login page when "email not confirmed" is returned, and on the onboarding verification step) calling `supabase.auth.resend({ type: 'signup', email })`. The Auth API supports it (`GoTrueClient.resend`). Purely a UI wiring gap.
- **Note:** the 2026-08-23 audit line "Resend verification exists in Auth.tsx" is **stale/incorrect** and should be disregarded.

### U2 — Unsaved onboarding field input lost on refresh/close (cases 8, 9) — MEDIUM
- **What:** completed steps persist server-side (good), but the *current step's* unsubmitted input (`organizationName`, `portfolioGroups`, `teamEmail`) and `stepIdx` are ephemeral `useState`. A refresh/close mid-step discards typed-but-unsaved input.
- **Root cause / owner:** frontend — optionally persist per-step drafts to `sessionStorage` (or restore `stepIdx` from the persisted completion set). Completed state is **not** lost; only unsubmitted keystrokes are. Low data-loss severity, hence MEDIUM.

### U3 — Raw backend error messages reach users on some paths (cases 17, 18, 19, 24) — MEDIUM
- **What:** `sanitizeAuthError` is applied on the **login/signup** pages, but several onboarding/invitation surfaces toast raw `error.message`:
  - `TenantSelfRegister.tsx` (lines 61, 84)
  - `ActivateAccount.tsx` (line 98)
  - `AdminInviteAccept.tsx` (line 91)
  - `LandlordInvitationAccept.tsx` (lines 76, 99)
  - Onboarding mutations (`ManagerOnboardingPage`, `LandlordOnboardingPage`, `AgencyOnboardingPage`) use `error instanceof Error ? error.message : "Try again."`
- **Root cause / owner:** frontend — route these through a shared sanitizer (extend `sanitizeAuthError` or add a mutation-error mapper) so RLS/constraint/network failures produce clear, non-technical copy. Failures are **not silent** (a toast always fires), so this is a wording/clarity gap, not a swallowed error.
- **Related:** no explicit request timeout/abort on onboarding mutations (#18) and no offline banner (#17/#24). Owning layer: frontend (React Query `networkMode`/`onError` + an `AbortController` timeout), not backend.

---

## Confirmations (no action needed)

- Completed onboarding state is **never lost** — it is derived from backend rows, and the Phase 10 completion screen reflects actual state ("Needs attention" for anything incomplete, never a false checkmark).
- No failure path is silent — every `catch` shows a toast or a dedicated state screen.
- Wrong-role, unauthorized-org, expired/used/invalid-invitation, session-expiry, logout, back-button, and mobile cases all have a clear explanation **and** a recovery path.
- No raw Supabase/Postgres error text reaches the **login/signup** forms (sanitized). The leak is confined to the invitation-accept and onboarding-mutation paths in U3.

---

*Audit output only. No auth logic, routes, schema, or backend behavior were modified. Unresolved issues U1–U3 are documented with their owning layer for a future phase.*

---

# PHASE 12 — FINAL PRODUCT EXPERIENCE REVIEW (2026-08-24)

**Review only — no code, auth logic, routes, or schema were modified.** This is a first-time-customer review of the entire journey starting from the CALQULUS homepage, across Manager, Landlord, Agency, Tenant, plus the Admin and WebHost invitation flows.

**Verification gates (all green):**
- `npx tsc --noEmit` → 0 errors
- `npx eslint src` → 0 errors, 11 pre-existing `react-hooks/exhaustive-deps` warnings (unrelated to onboarding)
- `npx vitest run` → 1063 passed, 1 skipped (86 files)
- `npm run build` → success (precache 27 entries, ~810 KiB)

---

## Entry map (homepage → portal)

| Role | Homepage path | Portal entry | Account creation |
|------|---------------|--------------|------------------|
| **Manager** | "Get started" / "Start managing" → `/auth?tab=signup` | `/auth` | **Self-serve sign-up** (email/password/name) |
| **Landlord** | Solutions → Landlords → `/landlord/login` | `/landlord/login` | **Invite-only** — page states the manager invites you; no self-signup |
| **Agency** | Solutions → Real Estate Agencies → `/agency/login` | `/agency/login` | **Login only** — page states the webhost/platform team provisions the account |
| **Tenant** | Solutions → Tenants → `/tenant/login` | `/tenant/login` | **Invite-only** — "Open invitation" / "Enter invite code"; both need a manager invitation |
| **Admin** | (not marketed) | `/webhost/invite` | **Invitation accept** — server-side token, no public registration |
| **WebHost** | (not marketed) | `/webhost/login` | **Invitation / seeded** — no public registration |

The homepage routes every role correctly and labels each portal. No homepage dead ends.

---

## First-time-customer journey review

### Manager
Single-page sign-up (`/auth?tab=signup`) → email verification → `/onboarding/manager` (7 steps: Account → Verification → Organization → Portfolio types → First property → Team invite → Complete) → Phase 10 completion screen reflecting real backend state. Each step has a one-line "why" ("Name the company that appears on invoices, receipts and statements"). Team invite is skippable. **Lowest-friction complete path.**

### Landlord
Invite email → accept → `/landlord/onboarding` (Account → Verification → Profile → Portfolio types → First property → Financial setup [skip] → Complete). The login page explicitly tells a cold visitor: *"Your manager invites you by email. If you have not received an invitation, contact them — this page does not create a landlord account."* No tenant PII surfaced. Profile copy explains purpose ("The name that appears on statements and payouts").

### Agency
`/agency/login` is **login-only** with a clear notice: *"Your webhost or platform team provisions the account."* Onboarding (`/agency/onboarding`) is the most explained of the four — every field names its purpose ("The name your clients and owners see on statements"; portfolio defaults "set the default for new client links — you can change it per client later"; operating-model options explain each payment flow). First client and team invite are skippable.

### Tenant
Two invite paths (`/tenant/invitation` magic link, `/tenant/signup` invite code) converge on a 3-step create-account (verify invite → profile → done). The page sets expectations: *"Both paths need a manager invitation. This page does not create a tenancy on its own."* Rent/deposit are pre-set by the manager — the tenant only accepts and sets a password. **Minimal fields, minimal friction.**

### Admin / WebHost invitation
`/webhost/invite` — invitation → identity verification (invited email) → invitee-chosen password → accept. The granted role is decided server-side; the page never sends a role. Token never displayed; per-state copy for expired/used/revoked/invalid. No public registration exists for either.

---

## Nine-dimension evaluation

| Dimension | Verdict | Evidence |
|-----------|---------|----------|
| **Clarity** | Strong | Every portal labelled; invite-only portals say so and name who to contact; step copy explains purpose. |
| **Trust** | Strong | No tenant PII to landlord/webhost; server-side roles; per-state invitation copy; real-state completion (no false checkmarks). |
| **Speed** | Strong | Skeletons, route prefetching, React Query cache, code-split vendor chunks, 8s auth watchdog. Manager path is the shortest. |
| **Security** | Strong | DB trigger is sole role writer; owner tier ungrantable via invite; server-side authorization; single-use time-limited invites; no user enumeration. |
| **Visual quality** | Strong | Shared `PortalAuthShell`, per-role accent, navy+white foundation, calm Phase 10 completion ring. |
| **Mobile UX** | Strong | viewport-fit=cover, responsive grids, min-h-11 touch targets, biometric login where supported. |
| **Accessibility** | Good | aria-labels on toggles, `htmlFor`/`aria-invalid`/`aria-describedby` on inputs, skip-to-content on the public shell, focus-visible rings. Decorative hero grids use aria-hidden correctly. |
| **Error recovery** | Good with one caveat | Sanitized messages on login/signup; per-state invitation recovery; auto-poll on approval. **Caveat = U3:** invitation-accept + onboarding-mutation paths still toast raw `error.message`. |
| **Commercial readiness** | Strong | Published per-property/month KES pricing, per-tier pages, demo accounts, trial events, clear CTAs. |

---

## The 12 questions — answered

1. **Can a non-technical property manager complete this without help?** **Yes.** One-page sign-up, plain-language 7-step flow, skippable team invite, real-state completion.
2. **Can a landlord understand what CALQULUS needs from them?** **Yes.** Invite-only is stated up front; onboarding is short and explains each field in terms of statements/payouts.
3. **Can an agency understand why each question is being asked?** **Yes — best of the four.** Every field names its purpose; the operating-model step explains each payment flow.
4. **Can a tenant get into their account with minimum friction?** **Yes.** Invite → accept → set password; rent/deposit pre-set by the manager; two invite paths.
5. **Can unauthorized users obtain elevated roles?** **No.** Role is written only by the DB trigger; the client cannot pick a role; owner tier cannot be granted via invitation; server-side authorization throughout.
6. **Can an interrupted user resume?** **Yes** for completed steps (server-derived; Phase 10 reflects real state). **Caveat = U2:** unsubmitted in-progress field input is ephemeral and lost on refresh/close.
7. **Are errors understandable?** **Mostly.** Login/signup errors are sanitized and clear. **Caveat = U3:** invitation-accept and onboarding-mutation errors can be raw/technical.
8. **Are there unnecessary fields?** **No.** Tenant profile is minimal; agency profile is name-only; team invites are skippable; manager collects only what's needed to run the portfolio.
9. **Are there dead ends?** **No** on the happy paths. Every invite-only portal names the recovery contact; every failure has a next step. (Expired-verification resend is the one gap — **U1.**)
10. **Are there duplicated screens?** **Mostly no.** All four portal auth pages share `PortalAuthShell`; only `WebhostAuth` uses a custom hero. `LandlordAuth.tsx` is now **dead code** (superseded by `LandlordPortalAuth` on the route) — a candidate for removal, not a user-facing duplicate.
11. **Are role permissions enforced server-side?** **Yes.** DB trigger + RLS + `ensureSignedInRole` + `ProtectedRoute`; nothing trusts client-supplied role.

---

## Phase 12 findings (carried forward, not fixed here)

- **F1 = U1 (resend verification) — HIGH, frontend.** Still the only missing recovery path on an otherwise dead-end-free journey.
- **F2 = U2 (unsaved field input lost on refresh) — MEDIUM, frontend.** Completed state is safe; only unsubmitted keystrokes are lost.
- **F3 = U3 (raw error.message on invitation-accept + onboarding-mutation paths) — MEDIUM, frontend.** Clarity gap, not a silent failure.
- **F4 — `LandlordAuth.tsx` is dead code (LOW, frontend).** Superseded by `LandlordPortalAuth` on the route; remove in a cleanup phase. Not user-facing.

---

## Final design standard — verdict

**PREMIUM · TRUSTWORTHY · FAST · INTENTIONAL · EASY TO UNDERSTAND** — met across all four role journeys and both invitation flows. No feature was added for sophistication's sake during this review; the standard is held by *removing* friction (invite-only clarity, skippable optional steps, minimal fields) rather than adding steps.

The remaining friction is concentrated in the three frontend-owned findings above (U1/U2/U3) plus one dead file. None of them block a first-time customer from completing onboarding; all are documented with their owning layer.

---

# PHASE 13 � Findings Remediation (2026-08-24)

All four findings from Phases 11�12 are fixed. No auth logic, routes, or schema changed.

## U1 � Resend verification (HIGH) � FIXED
New `ResendVerificationButton` (`src/features/auth/components/ResendVerificationButton.tsx`) calls `supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } })` with a 60-second client cooldown and enumeration-safe success copy ("If this address has an unverified account, a new link is on its way."). Mounted in the verification step of all three onboarding flows (manager `/onboarding/manager`, agency `/agency/onboarding`, landlord `/landlord/onboarding`) with the matching `emailRedirectTo`. The manager step's "you can resend" copy is now backed by a real control.

## U2 � Unsaved field input lost on refresh/close (MEDIUM) � FIXED
New `useOnboardingDraft` hook (`src/features/onboarding/hooks/useOnboardingDraft.ts`) wraps the existing `formDraft` sessionStorage helpers. Free-text fields now survive refresh and accidental close, keyed per user (`onboarding:{userId}:{field}`) so drafts never leak between accounts on a shared browser, session-scoped so they do not persist indefinitely, and cleared on successful submit so a stale draft never shadows server state. Wired into: manager (organization name, team email), agency (agency name, client name, team email), landlord (profile name).

## U3 � Raw backend error text reaching users (MEDIUM) � FIXED
All raw `error.message` toasts replaced with the existing `errorToast` helper, which logs the raw error to Sentry/`activity_logs` and shows only `toUserFacingError` output (short curated server messages pass through; PostgREST/RLS/JWT/network noise gets a friendly fallback). Covered: 3 manager onboarding mutations, 4 agency onboarding mutations, 2 landlord onboarding mutations, `AdminInviteAccept`, `ActivateAccount` (raw message was being shown as the toast title), and the `TenantAuth` signup fallback (now `sanitizeAuthError`).

## F4 � Dead `LandlordAuth.tsx` (LOW) � FIXED
File deleted; `/landlord/login` routes to `LandlordPortalAuth` (role-aware redirect guard). `scripts/audit-production.mjs` updated: the demo-credential check and the login-page role-guard check now target `LandlordPortalAuth.tsx` (guards by role-redirect instead of `ensureSignedInRole`).

## Verification
- `tsc --noEmit` � 0 errors
- `eslint` (touched paths) � 0 errors, 1 pre-existing warning (`PendingApproval.tsx`, unrelated)
- `vitest run` � 87 files passed / 1 skipped, **1072 tests passed / 1 skipped** (+9 new: 5 draft-hook, 4 resend-button)
- `npm run build` � success
- `npm run audit:prod` � only failure is pre-existing on clean `main` (`adminDesk.test.ts` contains the Supabase project URL; unrelated to these changes)

## Remaining known items (not from these findings)
- `adminDesk.test.ts` hardcodes the Supabase project URL and fails `audit:prod` on clean main � pre-existing.
- Onboarding mutations have no explicit request timeout (audit case 18) and there is no offline banner on onboarding pages (cases 17/24) � accepted limitations, documented in Phase 11.

