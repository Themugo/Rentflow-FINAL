# CALQULUS PHASE 13 — Final Pre-Claude/Cursor Audit

**Date:** 2026-08-20  
**Branch:** `cursor/phase-13-final-pre-claude-audit-1e5d`  
**Base:** `main` @ `842f968`  
**Role of this document:** objective product/engineering audit. **Not a redesign. Not a fix list being executed.** Findings are recorded; nothing in this phase implements them.

**Production probed this session:** `https://www.calqulus.site` → HTTP **200**.  
**Live Edge:** `GET https://aelzsqxllkypbzslxyju.supabase.co/functions/v1/health-check` → **404** `NOT_FOUND`.  
**Repo inventory this session:** **92** Edge Functions, **78** migrations, **~75** `src/` files with `@ts-nocheck`.

Related prior work (still valid unless noted):

- [`INDEPENDENT_QUALITY_GATE.md`](./INDEPENDENT_QUALITY_GATE.md) — 2026-08-19, **55/100**. Live `tenants` REST **500 `42P17`** and missing `get_manager_dashboard_stats` were reported then. This session did **not** re-prove REST `42P17` (anon key not used). Those remain **prior live evidence**, not retracted.
- [`PHASE_12_PRODUCTION_CERTIFICATION.md`](./PHASE_12_PRODUCTION_CERTIFICATION.md) — CI/boot scorecard; does not certify money, RLS, or paywalls.
- [`FINAL_CALQULUS_100_100_CERTIFICATION.md`](./FINAL_CALQULUS_100_100_CERTIFICATION.md) — filename overclaims. Body is more honest. Treat as **not** a 100/100 certificate.

---

## Verdict

CALQULUS is a **real Kenya-oriented PMS SPA**, not a prototype and not a slide deck. Role portals exist. Design tokens, white desks, Brand Studio, skip links, and lazy routing are real. Landlord UI does not render tenant names in the landlord feature tree.

It is **not** a commercially gated product. It is **not** live-schema-certified. It is **not** a finished system of record.

**Would I run paying tenant money through this as the only ledger today?** No.  
**Would I sell Starter / Pro / Enterprise as enforced plan SKUs today?** No — UI exists; **FeatureGate has zero importers** and `useFeatureAccess` **fails open**.  
**Would I hand this to a 1,000-unit operator as production ops?** No — list virtualization is unused, major pages are `@ts-nocheck`, query errors often look like empty data.  
**Closest honest prior score:** **55/100** (independent gate). This audit does not invent a new score. It ranks weaknesses so the next agent cannot hide them.

Docs and `AGENTS.md` **overstate** completion: manager nav still has Portfolio (Properties, Landlords); virtualization is advertised but unused; health-check exists in git and is **not deployed**; “certification” files measure subsets.

---

## Method

- Read architecture, routing, auth, RBAC, Edge Functions, Brand Studio, FeatureGate, and portal shells.
- Count inventory (functions, migrations, `@ts-nocheck`, FeatureGate importers, VirtualizedList importers).
- Probe production origin and health-check **this session**.
- Cite prior independent gate for live RLS/RPC where this session did not hold a real anon key.
- Did **not** mutate production. Did **not** implement remediations.

---

## What is actually strong

Keep these. Do not undo them in a “cleanup” pass.

| Area | Evidence |
|------|----------|
| Feature layout | `src/features/*`, `src/shared`, `src/app/routes.ts`, `src/core` (brand/design/white-label) |
| Route lazy-loading | `src/app/routes.ts` + `React.lazy` |
| Webhost tenant firewall (frontend) | `ProtectedRoute` hard-blocks `/portal`, `/tenant`, `/tenants`, `/properties`, `/leases`, `/billing`, `/contracts` for webhost |
| Landlord PII (UI) | No `tenant.name` / `full_name` / `phone` hits under `src/features/landlord` |
| White-label contract | `WhiteLabelProvider` + `applyBrandConfig` write `--brand-primary*` only; never `--primary` or status tokens |
| Design tokens | Locked interactive `#2F6FED`; status fills `#23856B` / `#B7791F` / `#C84B4B`; Phase 12 on-surface text companions |
| Auth portals | Separate login surfaces; `devAccess` gated to non-production (`devAccess.ts` / `ProtectedRoute`) |
| Pricing catalog (copy) | Starter 400 / Pro 600 / Enterprise 800 KES per property / month exists as published catalog |
| Skip links / 44px buttons / table `scope` | Phase 12 primitives; axe on **public** pages only |
| Vite chunks | Manual vendor/route splitting in `vite.config.ts` |

---

## CRITICAL

These can forge records, leak or create tenant accounts, or send unauthenticated side effects. Fix before treating the product as a ledger.

### C1. `log-audit` is unauthenticated and uses the service role

**Where:** `supabase/functions/log-audit/index.ts`  
**What:** CORS + JSON body → `createClient(URL, SERVICE_KEY)` → insert into `activity_logs`. No JWT. Required fields are only `userId`, `action`, `entityType`.  
**Why it matters:** Anyone who can reach the function URL can **forge an audit trail** (or flood it). Audit logs cease to be evidence.  
**Do not:** “fix” this by logging from the browser with the same function.

### C2. `notify-new-manager-signup` is unauthenticated and mails every webhost

**Where:** `supabase/functions/notify-new-manager-signup/index.ts`  
**Called from:** `src/features/auth/AuthContext.tsx` `signUp` (manager / agency / landlord).  
**What:** No auth. Service role reads all `user_roles` where `role = webhost`, loads profile emails, sends Resend mail. `managerName` / `managerEmail` are interpolated into HTML.  
**Why it matters:** Unauthenticated spam / phishing to every platform operator; HTML injection into mail; cost abuse on Resend.

### C3. Webhost may create tenant accounts (firewall contradiction)

**Where:** `supabase/functions/create-tenant-account/index.ts` (~269–281)  
**What:** After JWT check, caller role may be `"manager"` **or `"webhost"`**. Service role then creates auth users and tenant PII.  
**Same pattern:** `supabase/functions/backfill-tenant-accounts/index.ts` (~182).  
**Why it matters:** Product rule is **webhost never sees or creates tenant data**. Frontend blocks `/tenants`; the privileged Edge Function does not. A webhost JWT is enough.

### C4. Live observability endpoint is missing

**Where (repo):** `supabase/functions/health-check/`  
**Where (live, this session):** `GET .../functions/v1/health-check` → **404 NOT_FOUND**  
**Why it matters:** CI, `monitor.yml`, and deploy health jobs cannot observe the linked project’s functions. “Deployed Edge Functions” in agent memory is **not** true for health-check. Combined with prior-gate RLS/RPC gaps, operators cannot tell if the ledger is healthy.

### C5. Plan paywalls are not enforced (commercial integrity)

**Where:** `src/shared/components/FeatureGate.tsx` — **zero importers**.  
`src/shared/hooks/useFeatureAccess.ts` — `enabled: data?.enabled ?? true`, `plan: data?.plan ?? 'pro'` (fail open; default plan `'pro'`).  
Only caller of the hook: `OrgBrandStudio.tsx` (`white_label`), and even that does not wrap product features.  
**Why it matters:** Water billing, contracts, analytics, bulk SMS, API access are **ungated** in the product UI. Charging Starter vs Enterprise is a catalog lie until gates are wired **and** server-enforced. Fail-open means a downed `check-feature` function grants Pro.

---

## HIGH

Serious product, security, or integrity gaps. Not theoretical.

### H1. SMS send paths are authenticated but not role-scoped

**Where:**  
- `send-sms-notification` — `withMiddleware({ requireAuth: true })`, **no `allowedRoles`**, any JWT user, 10/hour, `failClosed: false`.  
- `send-bulk-sms` — any valid JWT **or** service-role bearer; **no role check**; up to **500** recipients.  
**Why it matters:** A tenant (or any signed-in user) who can invoke the function becomes an SMS relay. Cost + abuse + phishing.

### H2. Edge Function auth is inconsistent

**Inventory:** 92 functions. `withMiddleware` appears in a **handful** (`send-sms-notification`, `send-tenant-notice`, `send-tenant-invitation`, `initiate-mpesa-stk-push`, `record-payment`, `self-register-tenant`, `get-payment-history`, `create-dispute`, `accept-tenant-invite`). The rest roll their own (or none).  
**Why it matters:** The two CRITICAL unauthenticated functions are the proof that “some functions have middleware” is not a platform guarantee.

### H3. `@ts-nocheck` on core operational pages (~75 files)

Includes `Leases.tsx`, `Properties.tsx`, `Tenants.tsx`, `Maintenance.tsx`, `WebhostContracts.tsx`, `ManagerPaymentHistory.tsx`, `ManagerPlatformBilling.tsx`, plus large landlord/tenant/webhost modules.  
**Why it matters:** `npx tsc --noEmit` does **not** typecheck the pages that move money and occupancy. CI green is not evidence those files are sound.

### H4. Query failures rendered as empty lists

Examples: `TenantInbox.tsx` `if (error) return []`; `ManagerPaymentHistory.tsx` same; `PendingDepositRefunds.tsx` logs then returns `[]`.  
**Why it matters:** RLS recursion, missing RPCs, or 500s look like “no invoices / no payments.” Operators will collect or refund on a false empty book. Prior independent gate’s live `42P17` on `tenants` makes this operational, not hypothetical, until re-proved fixed.

### H5. Repo schema vs live project is unverified

78 migrations in git. AGENTS.md still records newer migrations as **not applied**. Client code assumes `platform_admins`, billing blocks, optimized RPCs (`get_manager_dashboard_stats`). Independent gate: that RPC **404** live (2026-08-19).  
**Why it matters:** The SPA can boot (HTTP 200) while the database the UI was written for is a different animal.

### H6. Submanager “viewOnly” wrapper does not restrict writes in UI

**Where:** `src/app/routes.ts` submanager `wrapper: "viewOnly"`.  
`ViewOnlyContext.tsx` sets `isViewOnly` only for **webhost** or **unapproved manager** — **not** submanagers.  
Sidebar filters by `can()`, but **direct URLs** are not permission-gated (`ProtectedRoute` has no submanager permission keys).  
`useRBAC` `can()`: managers all-true; **`if (isLandlord) return true`** — landlords treated as fully permitted if a manager control reuses `can()`.  
**Why it matters:** Authorization is “hope RLS holds.” UI will show write controls to submanagers who know the URL. Landlords must never share manager chrome.

### H7. Client upserts `user_roles` on signup

**Where:** `AuthContext.tsx` `signUp` → `user_roles.upsert`.  
Hardening trigger exists in repo SQL (`20260811000003` class) — **only if applied live**.  
**Why it matters:** If RLS/trigger is missing or weak, the browser chooses the role. Combined with C2, signup is a privileged path.

### H8. Accessibility and responsive “certification” is public-surface only

Phase 12 Playwright axe: homepage, design-preview, **login** portals. Not authenticated desks (Leases, Billing, Tenant portal home, Agency book).  
Phase 11 overflow: design-preview + login widths, not manager tables.  
Many a11y unit tests are **source-string contracts**, not runtime.  
**Why it matters:** Do not tell a buyer WCAG 2AA is certified for the product they log into.

### H9. Virtualization unused; large pages will not scale

`src/shared/components/VirtualizedList.tsx` — **no feature imports** (only a PropertyOS demo log string).  
Leases / Tenants / Properties are full-render `@ts-nocheck` pages.  
**Why it matters:** Performance work in Vite chunks does not help a 2,000-row tenant table.

### H10. Agency portal is a shell over manager pages

`AgencyTenants.tsx` renders `<Tenants />` inside `AgencyLayout`. Ops routes exist but are **kept off primary nav** (`agencyPaths.ts`).  
**Why it matters:** Agency is marketed as a distinct portal. Operationally it is a thin wrapper + hidden URLs. Commission/operating-model correctness is not proven here.

---

## MEDIUM

Real, but not immediately catastrophic if CRITICAL/HIGH are owned.

### M1. Manager IA does not match AGENTS.md / older mockup notes

Live `Sidebar.tsx` `managerNavGroups`: OVERVIEW, **PORTFOLIO (Properties, Landlords)**, OCCUPANCY (+ Tenant Screening), COLLECTIONS (+ Payment History), OPERATIONS (+ Contracts), ACCOUNT (Platform Billing + Settings).  
Manager unknown-path fallback is **`/properties`**, not Dashboard (`routes.ts`).  
AGENTS.md still says Properties group was removed. **The code is the product.** Docs are stale.

### M2. Webhost primary nav vs ops routes

Primary: Organizations, Users, Subscriptions, Audit, Security, Settings, Brand Studio.  
`WEBHOST_OPS_ROUTES` (properties, landlords, tiers, contracts, issues, …) exist **off primary nav**. Shared `Sidebar` webhost group is a stub (“Webhost Portal” only).  
Operators will not find billing rules / unlinked landlords unless they know the URL.

### M3. Amber Tailwind still widespread (~130 files)

`FeatureGate` itself uses `amber-*`. White-label **cannot** recolor those surfaces. Phase 10 mapped some badges; leftovers remain on live operational components (water billing, invoices, deposits), not only demo labs.

### M4. Dead / demo suites still in the tree

EnterpriseAdminPlatform, PropTech, PropertyOS, SOC2/ISO mock dashboards, specialist dashboards routed away. `MarketingWebsite.tsx` re-exports `PublicLandingPage`. `/design-preview` is public.  
Bundle and mental load. Risk of a future route accidentally mounting a “Certified SOC2” mock.

### M5. Middleware rate limits fail open

`send-sms-notification` `failClosed: false`. Infra hiccup → send anyway.

### M6. PWA precache is large

Phase 12 build notes ~**5.5MB** / 293 precache entries. Fine for desk; hostile on Kenyan mobile data for tenant install prompts.

### M7. Tests do not prove isolation or money

Vitest mocks Supabase (`src/test/setup.ts`). Playwright portal E2E is **credential-gated** and skipped in CI without `E2E_*`. Independent gate: no mutating payment proof.

### M8. Webhost hard-block list is incomplete vs manager paths

Blocked: `/portal`, `/tenant`, `/tenants`, `/properties`, `/leases`, `/billing`, `/contracts`.  
Not listed: `/invites`, `/statements`, `/water-billing`, `/payments`, `/landlords`, `/maintenance`, `/reports`. Role routing in `App.tsx` is the real separator; the “defence in depth” comment overstates coverage.

### M9. Landlord `ProtectedRoute` hard-block is sloppy

`blockedPrefixes` includes `'/'` and `'/'` equality would catch the manager home, but `/tenants` is **not** in the landlord block list (webhost list has it). Relies on role route tables.

### M10. Email templates in Edge Functions still use purple gradients / slate copy

`notify-new-manager-signup` HTML: `#8b5cf6` header. Off-brand; also the unauthenticated function (C2).

---

## LOW

Fix when touching the file. Do not pretend they are the reason the product is unready.

### L1. `FeatureGate` upgrade CTA uses `<a href="/platform-billing">` instead of the router.

### L2. Compact footer vs marketing footer already addressed in Phase 10; remaining copy drift in emails and AGENTS.md.

### L3. Chart hex colours may not follow brand tokens (charts `@ts-nocheck`).

### L4. Public `/design-preview` is useful internally; should not be a customer-facing IA item.

### L5. `whoAmI.managerId` for managers is `submanagerPermissions?.manager_id` — feature-access checks for a **manager** fall back to `user?.id` (works) but the name is misleading.

### L6. Duplicate “certification” documents with conflicting scores (67 vs 55 vs implied 100).

---

## Category evaluations

Scored in prose, not a fake 100.

### Frontend architecture

Feature folders and shared UI are coherent. Dual nav systems (shared `Sidebar` vs portal-specific layouts) create stubs (webhost sidebar). Agency pages wrap manager pages. Large screens disabled TypeScript. **Architecture is a mid-size SPA that grew faster than its typecheck and IA.**

### UI consistency

Tokens and desk chrome (navy rail, white surface, `bg-primary/10` selected nav, 2px portal accent) are in good shape after Phases 9–12. **Amber leftovers and mock suites break the guarantee.** Status fills are locked; warning **text** companions exist — not all screens use them.

### UX

Manager desk is dense but navigable. Agency hides the real ops. Webhost hides properties/landlords/contracts. Empty-on-error (H4) is the worst UX bug: silent failure. Tenant portal structure exists (Home / Pay / Maintenance / Documents); this audit did not click authenticated tenant UX.

### Responsive design

Phase 11 certified **preview + login** widths, not authenticated tables. Mobile tenant home exists (`MobileTenantHome`, bottom nav). Manager leases/billing on 360px are **unproven** in this audit.

### Accessibility

Primitives improved (44px, 24px checkbox/radio, skip link, `aria-current`, table `scope`). **Authenticated axe coverage is zero.** Keyboard cards exist for leases/inbox, not for every data grid.

### Performance

Code splitting and query staleTimes are real. Virtualization is dead code. PWA precache is heavy. Dashboard RPC in git may 404 live — that is a **network** performance and correctness issue, not a React one.

### Routing

Role tables in `routes.ts` are the backbone. Lazy + protected. Fallbacks: manager → `/properties` (odd). Submanager shares manager routes. Specialist dashboards redirect home. **Permission is not a route concern** except webhost `requirePermission`.

### Authentication

Supabase Auth, separate portal logins, pending-manager gate, `devAccess` off in production. Signup still **writes roles from the client**. Session loading spinners are fine. MFA / session binding not audited here as complete.

### Authorization

RLS is the intended backstop; prior live evidence said RLS **recursion** on `tenants`. App-level: webhost UI firewall is real; **Edge Functions punch holes** (C3). Submanager UI gating is nav-only. `can()` landlord=true is a footgun. **Do not claim RBAC is finished.**

### API integration

`supabase-js` + `functions.invoke` everywhere. Errors often swallowed. `check-feature` exists and is almost unused. No generated client that fails CI when the live schema drifts.

### Backend integration

92 functions, uneven auth, service-role overuse (`log-audit`). Payments (STK, record-payment) use middleware — relatively better — but this audit did not run a mutating payment. Health-check **not live**.

### Data integrity

Silent `[]` on error; unauthenticated audit inserts; plan fail-open; schema/migration drift. **Ledger integrity is not demonstrated.** Independent gate: no mutating payment proof.

### White-label readiness

**Foundation is real:** Brand Studio, sanitize/contrast, org overlay must not overwrite `--primary`, webhost/login stay CALQULUS. **Not ready to sell as white-label:** amber utilities, FeatureGate unused so `white_label` is not a paid SKU, emails unbranded, charts/hex leftovers.

### Commercial readiness

Public pricing exists. Subscriptions UI exists. **Enforcement does not.** Compliance mocks must stay labeled mocks. Production domain is live (200) behind a product that still has unauthenticated privileged functions in git — whether those functions are **deployed** was not exhaustively enumerated this session; `log-audit` / `notify-new-manager-signup` **exist in the repo that auto-deploys**. Treat as **assumed reachable until proven unpublished**.

---

## Honest summary table

| Asked area | State |
|------------|--------|
| Frontend architecture | Structured, oversized, under-typed |
| UI consistency | Desk chrome good; amber + mocks remain |
| UX | Usable desks; silent errors; hidden IA |
| Responsive | Public certified; desks not |
| Accessibility | Primitive certified; product not |
| Performance | Split bundles; no list virtualization |
| Routing | Role tables work; permission ≠ route |
| Authentication | Real; client role upsert remains |
| Authorization | UI firewall ≠ Edge/RLS proof |
| API integration | Invoke-heavy; fail-open / empty-on-error |
| Backend integration | Many functions; few shared guards; health 404 |
| Data integrity | Not proven; audit log forgeable |
| White-label readiness | Foundation yes; product-wide no |
| Commercial readiness | Catalog yes; gates no |

---

## What this phase did not do

- Did not redesign or restyle.
- Did not patch Edge Functions, RLS, or FeatureGate.
- Did not apply migrations.
- Did not run credentialed E2E or a live payment.
- Did not re-hit `tenants` REST with a real anon key (prior `42P17` stands until retested).

## Next (for a later phase — not this one)

Own **C1–C5** before any more design phases. Then H1–H7. Do not add features on top of unauthenticated service-role functions.

---

**Checkpoint:** documentation only. No application code changed in Phase 13.
