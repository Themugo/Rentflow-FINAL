# CALQULUS PMS — Independent Quality Gate

**Date:** 2026-08-19  
**Role of this document:** final independent assessment (architect, product, security, QA, commercial).  
**Not a feature change. Not a score-chase.**  
**Does not claim SOC 2, PCI DSS, ISO 27001, “95/100 certified”, or “enterprise certified”.**

**Production origin rechecked this session:** `https://www.calqulus.site` → HTTP 200.  
**Supabase:** `aelzsqxllkypbzslxyju.supabase.co`  
**Live REST (anon, this session):** `GET /rest/v1/tenants?select=id&limit=1` → **500 `42P17`**.  
**Live Edge:** `GET /functions/v1/health-check` → **404**.  
**SPA:** `GET /health` → **200**.

Related prior work: [`PHASE_12_PRODUCTION_CERTIFICATION.md`](./PHASE_12_PRODUCTION_CERTIFICATION.md) scored **67/100** on a weighted “can the site boot and can CI pass” scorecard. This document uses **30 equal gates** and only awards points when a capability is **implemented, connected, tested, secure, usable, and appropriate for production**. Repo-only SQL and mocked Vitest do not count as live proof.

---

## Verdict

**Do not deploy this as the system of record for a professional property-management company until live RLS recursion is gone, dashboard RPCs exist on the linked project, and a mutating payment path has been proven.**

**Honest overall: 55 / 100.**

This is not 95. Code volume is high. Production fitness is not. The product is a real Kenya-oriented PMS SPA with working demo logins, not a slide deck — and it is also not a finished commercial system.

### In-repo remediations after this gate (still not live-complete)

Shipped in git, **not** a substitute for applying SQL on the linked project:

- Removed “SOC2 Type II Certified” / ISO claims from `Footer.tsx`; mock compliance screens labeled as mocks; webhost Admin Platform tab unmounted
- `/landing` and `/welcome` redirect to `/`; specialist `/dashboard/*`, `/communications`, manager `/services` redirect to `/`
- Published catalog: Starter 400 / Professional 600 / Enterprise **800** KES per property / month
- `validate_invitation_token` migration returns `invited_by` as text (live 400 type mismatch)
- Native suite and remaining mock dashboards labeled DEMO / LAB
- Sentry allowlist no longer includes non-resolving `app.calqulusrms.com`
- Unused Google Fonts / Analytics preconnects removed from `index.html`

Live still: **42P17** on tenants, **health-check 404**, no mutating payment proof. Overall stays **55** until those land.

| | |
|--|--|
| Would I deploy it today as the only ledger for paying tenants? | **No** |
| Would I charge customers today? | **No** (pilot / friends-and-family only, with eyes open) |
| Would I sell it to a 1,000-unit manager today? | **No** |

---

## Scoring method

Each area is 0–100. Overall = unweighted mean of the 30 scores (**1646 / 30 = 54.9**, reported **55**).

Caps applied:

- If it exists only in migrations or UI copy → **≤ 50**
- If unit tests mock Supabase (`src/test/setup.ts`) → those tests do not raise the “tested” bar for isolation or money
- If live API contradicts repo SQL → live wins
- False compliance claims **subtract** from Security, Documentation, Commercialization, and Product-market

Phase 12’s 67 is not retracted; it measured a different mix (CI + Vercel 200). This gate is harsher on money, tenancy, observability, and go-to-market.

---

## Scoreboard

| # | Area | Score |
|---|------|------:|
| 1 | Architecture | 62 |
| 2 | Code quality | 58 |
| 3 | Frontend architecture | 64 |
| 4 | Backend architecture | 60 |
| 5 | Database | 54 |
| 6 | Multi-tenancy | 52 |
| 7 | Authentication | 68 |
| 8 | Authorization | 58 |
| 9 | Payments | 55 |
| 10 | Financial integrity | 48 |
| 11 | API integration | 58 |
| 12 | Testing | 54 |
| 13 | Security | 48 |
| 14 | Performance | 52 |
| 15 | Accessibility | 62 |
| 16 | Mobile | 64 |
| 17 | UX | 60 |
| 18 | UI | 68 |
| 19 | Design system | 58 |
| 20 | Information architecture | 58 |
| 21 | Onboarding | 52 |
| 22 | Commercialization | 48 |
| 23 | Pricing | 44 |
| 24 | Subscription lifecycle | 50 |
| 25 | Documentation | 46 |
| 26 | Deployment | 70 |
| 27 | Observability | 38 |
| 28 | Disaster recovery | 42 |
| 29 | Production readiness | 45 |
| 30 | Product-market readiness | 50 |
| | **Overall** | **55** |

---

## 1. Architecture — 62

**Evidence.** Vite/React SPA on Vercel (`vercel.json` SPA rewrite) + Supabase Auth/Postgres/Storage/Edge. Central routes in `src/app/routes.ts` (152 path entries, 71 unique, 7 role configs). `AppRole` is six values in `AuthContext.tsx`. Submanager is a role on manager routes (`viewOnly`), not a portal. 22 feature folders, 88 Edge Function directories, 74 SQL migrations.

**Problem.** Two public marketing surfaces (`PublicLandingPage` on `/` and `/pricing`; `MarketingWebsite` on `/landing` and `/welcome`). Dual deploy stories (native Vercel GitHub integration vs Actions `deploy-production.yml`). Specialist dashboards routed at `/dashboard/{accountant,maintenance,leasing,support}` with no sidebar links. Nested “enterprise admin” chrome under webhost. Repo schema is ahead of live.

**Business impact.** Operators cannot tell which URL, portal, or admin suite is canonical. Sales demos wander into lab screens.

**Technical impact.** Two deploy pipelines, 88 functions to keep alive, dashboard stats RPC missing live so the app falls back to many queries (`dashboardStats.ts`).

**Recommendation.** Treat Vercel+Supabase as the only production architecture. Apply live SQL (`supabase/sql/apply-live-p1-rls.sql` then `apply-live-p1-rpcs.sql`). Hide or clearly badge lab modules. Do not add a third host.

**Priority.** P1 for live schema; P2 for surface consolidation.

---

## 2. Code quality — 58

**Evidence.** `npm run typecheck` compiles `src/` via `tsconfig.app.json` (Phase 12). ESLint 0 errors / 9 warnings. Vitest 762 passed / 1 skipped. **86 files** `// @ts-nocheck` (`docs/audits/TYPECHECK_EXEMPTIONS.txt`). Runtime client is `SupabaseClient<any>` (`client.ts`) because `createClient<Database>` collapsed `.from()` to `never`.

**Problem.** Strict mode is on paper; a large share of billing, webhost, landlord, and dashboard code is exempt. Tests do not compile against the app tsconfig (`src/test` excluded).

**Business impact.** Regressions in money and tenancy are easy to ship without the compiler noticing.

**Technical impact.** Types and live schema will keep drifting until `supabase gen types` from the linked project.

**Recommendation.** After live migrations, regenerate types and pay down `@ts-nocheck` on payment and RLS-touching files first. Do not chase 0 errors in cosmetic pages.

**Priority.** P2 (P1 for payment/tenant files).

---

## 3. Frontend architecture — 64

**Evidence.** Lazy routes, React Query, vendor chunks in `vite.config.ts`, `RoutePrefetcher`, `ErrorBoundary`. Manager/agency/tenant/webhost/landlord shells exist. Dev portal switcher is imported in `App.tsx` but presets empty in `import.meta.env.PROD`.

**Problem.** Unreachable specialist dashboards use `window.location.href` (full reload). `/communications` and `/services` are routed and absent from `Sidebar.tsx`. Placeholder Supabase client boots a “preview” app when env is missing — useful for CI, dangerous if someone thinks preview is production.

**Business impact.** Users hit dead or reload-heavy paths. Support cannot explain why some URLs exist.

**Technical impact.** Bundle includes admin-lab components that are not the mockup product.

**Recommendation.** Keep the five portals. Do not wire more specialist dashboards. Leave preview-mode client; never point production env at placeholders.

**Priority.** P3 except if lab modules are shown to paying webhosts (then P1 messaging).

---

## 4. Backend architecture — 60

**Evidence.** 88 functions in `supabase/config.toml`. Live this session / Phase 12: `process-payment` and `send-tenant-invitation` **401** (deployed), `stripe-webhook` **400** “Webhook Error” (deployed, rejects unsigned), `health-check` **404**. Shared `_shared/` middleware, idempotency, tracing exist in repo.

**Problem.** Operational surface is larger than the product. Health-check is not on the functions host. Recent RPCs are not in the live PostgREST cache (`get_manager_dashboard_stats`, `get_landlord_portfolio_stats` → PGRST202).

**Business impact.** Incidents are invisible. Manager dashboard cannot use the single-RPC path in production.

**Technical impact.** Fallback query fan-out; 88 functions without an inventory of what is actually deployed.

**Recommendation.** Deploy `health-check` with `verify_jwt = false` (already in `config.toml`). Apply RPC migrations. Do not add functions.

**Priority.** P1.

---

## 5. Database — 54

**Evidence.** 74 migration files; `audit-production.mjs` counts 128 tables / 127 with RLS **in SQL**. Live anon probe: `properties`/`leases` 200 `[]`; `tenants`/`invoices`/`platform_admins` **500 42P17**; `user_roles` 200 with an id. `schema_migrations` is not readable as anon. Paste-ready fixes exist (`supabase/sql/apply-live-p1-*.sql`). `20230101000000_base_schema.sql` still contains `DELETE FROM` orphan cleanup that will destroy live rows if pasted.

**Problem.** Repo and live are not the same database. Recursion-fix migrations are in git and **not effective** on the linked project. Operators already pasted a file path (42601) and the base-schema dump (wrong file).

**Business impact.** Tenant and invoice REST is broken for anon; any client that hits those policies can 500. Data-loss risk if base schema is run again.

**Technical impact.** Cannot treat `audit:prod` RLS counts as production.

**Recommendation.** Paste **contents** of `apply-live-p1-rls.sql`, then `apply-live-p1-rpcs.sql`. Never paste `_base_schema.sql` into production. Confirm with anon GET tenants (must not be 42P17).

**Priority.** P0/P1 — highest technical risk on the board.

---

## 6. Multi-tenancy — 52

**Evidence.** Role model in SQL and `AGENTS.md`: manager scoped by `manager_id`, landlord aggregate via `property_landlords`, webhost must not see tenant PII, submanager permission tables. Isolation tests in `src/test/isolation/` **state they do not execute Postgres RLS**. `live-jwt-isolation.test.ts` is skipped unless `LIVE_ISOLATION=1` (the 1 skipped Vitest).

**Problem.** Live `42P17` on `tenants` (and invoices via that relation) means the isolation story is not proven on the database that matters. Anon can read a `user_roles` id.

**Business impact.** A 1,000-unit firm will ask “can manager A see manager B’s tenants?” — the honest answer is “designed yes, live RLS currently recursive on tenants.”

**Technical impact.** Recursion also blocks some REST reads; authenticated Playwright still rendered manager `/tenants` (UI may use a path that does not hit the recursive policy the same way).

**Recommendation.** Apply 20260812 helpers (`role_in`, `is_platform_admin_active`). Then run `LIVE_ISOLATION=1` with two manager JWTs.

**Priority.** P1.

---

## 7. Authentication — 68

**Evidence.** Supabase Auth. Demo manager / tenant / landlord Playwright logins **passed** on `www.calqulus.site` (Phase 12). `pickRoleForPath` in `roleResolution.ts`. Dev presets compile out in production. Triggers in `20260811000003` block self-assign of webhost (repo). AGENTS.md `CALQULUS RMS@2026!` accounts are **invalid** on live Auth. Webhost E2E skipped.

**Problem.** Documented operator passwords do not work. Webhost portal uncertified. Live JWT isolation unrun.

**Business impact.** Support runbooks are wrong. Cannot certify the seller portal (webhost).

**Technical impact.** Role detection is path-based; a user with multiple roles depends on URL, which is usable but easy to misconfigure.

**Recommendation.** Rotate and document **working** credentials. Run webhost E2E. Keep path-based role pick; do not invent a new auth system.

**Priority.** P1 for webhost/docs; auth itself is the strongest live gate.

---

## 8. Authorization — 58

**Evidence.** Webhost route config is `/webhost` only — no `/tenants` or `/portal` (`routes.ts`). `can_manage_tenants` removed from TypeScript `WebhostPermissions`. `can()` / `canWrite()` for submanagers. RPC hardening SQL in repo (Phase 3). Live `platform_admins` **42P17**. `get_manager_dashboard_stats` missing so authorization inside that function is irrelevant live.

**Problem.** Frontend firewall ≠ database firewall. Recursive policies are an authorization defect, not just a 500.

**Business impact.** Webhost “tenant firewall” is not fully live-proven. Custom pricing / platform admin screens can fail.

**Technical impact.** Policies that subquery `user_roles` / `platform_admins` / `tenants` re-enter RLS.

**Recommendation.** Apply recursion SQL. Do not add more policy layers until live `pg_policies` is dumped.

**Priority.** P1.

---

## 9. Payments — 55

**Evidence.** Edge functions for STK push, M-Pesa callback, Stripe webhook, `process-payment` exist and some respond on the live functions host. Manager-scoped M-Pesa settings in schema. **No mutating** signup→invoice→STK/card→receipt run in Phase 12 (would write production money). Financial Vitest uses the mock client.

**Problem.** Collection code is real; production proof is not. Callback/idempotency behavior is unobserved on live money.

**Business impact.** Charging rent through CALQULUS is the product. Unproven payments = cannot charge PMS customers who depend on collections.

**Technical impact.** Unknown drift between `process_invoice_payment` SQL (20260819, not live) and Edge `process-payment`.

**Recommendation.** One staging (or explicitly accepted prod) invoice: STK or recorded payment → receipt row → tenant sees it. Then apply 20260819000003 if tables exist.

**Priority.** P1.

---

## 10. Financial integrity — 48

**Evidence.** Repo: invoice status CHECK, unique checkout id, `process_invoice_payment` with `FOR UPDATE` and 2dp (`20260819000003`). Phase 7 doc claims atomic RPCs. All `src/test/financial-integrity/*` hit `src/test/setup.ts` in-memory Maps. Live `invoices` REST **42P17**. Dashboard collected-rent RPC **missing**.

**Problem.** Ledger integrity is a SQL file, not a live invariant.

**Business impact.** Double-credit or stuck `pending` would be a company-ending event; we have not proven it cannot happen on this project.

**Technical impact.** Mock CHECK constraints are not Postgres.

**Recommendation.** Apply financial migration after RLS. Add one live idempotency test (same checkout id twice). Do not cite 762 tests as ledger proof.

**Priority.** P1.

---

## 11. API integration — 58

**Evidence.** PostgREST + Edge. Live: invitation send/create-tenant 401 (present); `validate_invitation_token` 400 type mismatch (text vs uuid); `validate_activation_token` 404; dashboard/landlord RPCs 404. Frontend falls back when RPC missing.

**Problem.** Contract drift between app and live schema cache. OpenAPI under anon is 401 so inventory is probe-by-probe.

**Business impact.** Invites and activation can fail in ways the UI may not explain.

**Technical impact.** Types file is patched from migrations, not `gen types` from live.

**Recommendation.** After SQL apply, `NOTIFY pgrst` / reload schema, regenerate types, fix invitation token types.

**Priority.** P1 for RPCs; P2 for types.

---

## 12. Testing — 54

**Evidence.** 49 unit files, 7 E2E specs. 762 Vitest pass. Playwright: demo manager (dashboard, properties, billing), tenant, landlord — **login smoke**, not golden path. Isolation/finance suites mock Supabase by design. `e2e/mobile.spec.ts` is viewport chrome.

**Problem.** High pass count, low production meaning. Phase 10 “33 workflows PASSED” was not re-run on live in Phase 12.

**Business impact.** Green CI does not mean rent posted.

**Technical impact.** False confidence; `@ts-nocheck` hides the code tests do not compile.

**Recommendation.** Keep unit tests. Add one live isolation test and one live payment test. Do not expand mock “certification” files.

**Priority.** P1 for two live tests; P3 for more mocks.

---

## 13. Security — 48

**Evidence.** Live security headers on `calqulus.site` (CSP, HSTS, XFO, nosniff — `vercel.json`). Gitleaks + `security-scan.yml` in CI. Storage hardening SQL in repo. Demo passwords in git (`devAccess.ts`, README, seed function) with Gitleaks allowlists; prod bundle gates presets. **Footer** (`Footer.tsx` L166) shows **“SOC2 Type II Certified”** on `Layout` (logged-in app) and `MarketingWebsite`. `SOC2ComplianceDashboard.tsx` / `ISO27001ComplianceDashboard.tsx` are **hardcoded mock arrays** with comments that production would call an API. Live RLS `42P17`. Anon `user_roles` id readable. `health-check` 404.

**Problem.** The product **claims** certifications it does not have. Recursive RLS is a real defect. Secrets in git (even gated) are a process smell.

**Business impact.** Selling “SOC2 Type II Certified” is a legal and trust failure. A professional buyer’s security review ends here.

**Technical impact.** Mock compliance UIs train operators to trust fake scores.

**Recommendation.** Remove SOC2/ISO certified copy and mock compliance dashboards from any reachable UI (or mark DEMO and unroute). Apply RLS SQL. Rotate demo passwords if they are live.

**Priority.** P0 for false certification claims; P1 for RLS.

---

## 14. Performance — 52

**Evidence.** Code splitting and query staleTime exist. Lab Lighthouse (Phase 11, localhost): landing LCP **~6.3 s**, tenant login **~5.7 s**, performance **~69–71**. Logo JPEG **~204 KB** shown at ~20–56 px (`BrandMark.tsx`). Live origin 200 with hashed `/assets` cache. Field RUM in `observability.ts` is not a published CrUX report.

**Problem.** Public LCP misses a 4 s budget (`lighthouse-budget.json`). Missing live dashboard RPC increases query count.

**Business impact.** First-load feel is not “enterprise SaaS” on Kenyan mobile networks.

**Technical impact.** Oversized raster brand asset; extra Google Fonts preconnect while Outfit is self-hosted.

**Recommendation.** Compress/replace logo; apply dashboard RPC; do not start a rewrite.

**Priority.** P2.

---

## 15. Accessibility — 62

**Evidence.** Lab a11y **96** landing / **92** tenant login (Phase 12 citing Phase 11). Auth contrast work in `index.css`. Touch `min-h-11` on several tenant/manager controls. **Dashboards not a11y-audited.**

**Problem.** Auth screens ≠ product. Charts, tables, and dialogs unaudited.

**Business impact.** Public-sector or NGO buyers will ask for WCAG evidence we do not have beyond login.

**Technical impact.** Unknown keyboard traps in billing dialogs.

**Recommendation.** One axe pass on manager billing + tenant pay. Do not restyle the whole app for a score.

**Priority.** P2.

---

## 16. Mobile — 64

**Evidence.** Viewport is not `user-scalable=no` (live `index.html`). `MobileBottomNav`, tenant pay offline guard (`onlinePaymentGuard.ts`), PWA plugin. Capacitor config points at `calqulus.site` — **not an app-store product**. `NativeAppSuite.tsx` **simulates STK** (`handleSimulateStkPush`) without a DEMO badge in-file.

**Problem.** Web mobile is considered; native suite is a prototype inside the web app.

**Business impact.** Feature-phone Paybill is in the product story; native “apps” must not be sold as shipped.

**Technical impact.** Capacitor + `src/mobile/*` increase repo weight for no store release.

**Recommendation.** Keep responsive web. Badge or unroute `NativeAppSuite`. Skip store until web collections are proven.

**Priority.** P2 for honesty; P3 for native.

---

## 17. UX — 60

**Evidence.** Manager empty/activation path (`ManagerActivationEmpty.tsx`, `useManagerActivation.ts`) queries real tables. Dashboard retry; tenant offline banner. Demo logins reach real shells. Dual marketing pages. Specialist dashboards reload the window.

**Problem.** First-run is coded; live mutating onboarding was not re-proven. Extra URLs confuse.

**Business impact.** A new manager can log in and still not know the one path: property → invite → invoice → collect.

**Technical impact.** Two marketing codepaths to keep consistent.

**Recommendation.** Pick one public landing. Keep activation empty states. Do not add tours.

**Priority.** P2.

---

## 18. UI — 68

**Evidence.** shadcn/Radix, Outfit, primary `#155EEF` in `src/index.css`. Portal cards on `PublicLandingPage`. Consistent enough that Playwright could find headings and buttons.

**Problem.** Lab “enterprise” screens do not match the mockup-minimal manager sidebar. Brand JPEG is heavy.

**Business impact.** Core portals look like a real product; webhost lab looks like a different company.

**Technical impact.** CSS tokens exist; some pages still use ad-hoc emerald/purple accents (`PublicLandingPage` accent map).

**Recommendation.** No visual redesign. Stop adding accent palettes.

**Priority.** P3.

---

## 19. Design system — 58

**Evidence.** Tailwind v4 `@theme` in `index.css` (Outfit). `ENTERPRISE_DESIGN_SYSTEM.md` specifies **Inter** and different control sizes than `min-h-11` mobile controls.

**Problem.** Spec document and runtime disagree. “Enterprise design system” naming oversells a shadcn theme.

**Business impact.** Designers following the markdown will fight the CSS.

**Technical impact.** Token drift.

**Recommendation.** Either delete the Inter spec or change it to Outfit. One source of truth: `index.css`.

**Priority.** P3.

---

## 20. Information architecture — 58

**Evidence.** Manager `Sidebar.tsx`: Overview, Portfolio (Properties, Landlords), Occupancy (Leases, Tenants, Invites, Vacation, Screening), Collections (Billing, Water, Statements, Payment History), Operations (Maintenance, Contracts, Reports), Account (Platform Billing, Settings). AGENTS.md mockup list is shorter (no Screening, Payment History, Contracts, Platform Billing, Properties group). Webhost dashboard has extra tabs (`admin-suite`, `billing-rules`, `custom-pricing`). Tenant nav adds Inbox/Profile beyond the five-item mockup.

**Problem.** IA grew past the mockup. Communications/Services exist as routes without nav.

**Business impact.** Managers hunt. Webhosts land in an admin suite that is not the sold product.

**Technical impact.** Role configs must stay in sync with a wide tree.

**Recommendation.** Do not add nav items. Hide lab webhost tabs behind an explicit flag or remove from default Overview.

**Priority.** P2.

---

## 21. Onboarding — 52

**Evidence.** Manager-enters-all-data invite model is documented and implemented in invite dialogs + `send-tenant-invitation`. Activation hook counts properties/tenants/invoices. Public signup CTA → `/auth?tab=signup`. Phase 10 claimed invite→lease on staging (Aug 11); Phase 12 **did not** re-run it on live.

**Problem.** Onboarding is a story plus old staging evidence, not a current live golden path.

**Business impact.** Cannot promise time-to-first-collection.

**Technical impact.** Invitation token RPC type mismatch live (400) can break accept-invite.

**Recommendation.** One live invite accept on demo. Fix `validate_invitation_token` types. No new wizard.

**Priority.** P1.

---

## 22. Commercialization — 48

**Evidence.** Public pricing component + `usePublicTiers`. In-app `ManagerSubscriptionBanner`, `/platform-billing`. Webhost tier and billing-block UIs in repo. Contact `enterprise@calqulusrms.com` (mailbox **unverified**). DEMO modules (automation, GTM, customer success, native suite per Phase 8) sit in the webhost enterprise shell. Footer SOC2 claim.

**Problem.** Go-to-market mix of real pricing UI, fallback catalog, fake compliance, and lab products.

**Business impact.** A buyer cannot tell what they are purchasing.

**Technical impact.** Commercial status depends on `manager_profiles` / invoices that may not match Stripe/M-Pesa.

**Recommendation.** Sell three portals and collections only. Strip certified-compliance copy. Verify the enterprise mailbox or remove it.

**Priority.** P1.

---

## 23. Pricing — 44

**Evidence.** Fallback catalog is now Starter **400** / Professional **600** / Enterprise **800** KES/property/month (`commercialCatalog.ts`). AGENTS.md was updated to the same per-property model. Live `subscription_tiers` rows were not dumped this session — the UI still falls back if the table is empty.

**Problem.** Two pricing models in docs vs code. Fallback order is confusing. Live table contents were not dumped this session.

**Business impact.** You cannot quote a 1,000-unit deal from this repo without a human making up a number.

**Technical impact.** Billing engine and marketing catalog can disagree.

**Recommendation.** One published metric (property **or** unit). Make Enterprise ≥ Professional unless custom. Align AGENTS.md. No new packaging.

**Priority.** P1.

---

## 24. Subscription lifecycle — 50

**Evidence.** `resolveBillingHealth()` / `useManagerCommercialStatus.ts` model trial, grace, near-limit, suspended. `manager_invoices` in base schema. Stripe webhook deployed (unsigned probe 400). Signup→trial→pay→suspend **not executed** live (Phase 12).

**Problem.** Lifecycle is UI+SQL+webhook code without an observed customer journey.

**Business impact.** Cannot enforce paid plans without risking false suspend or eternal trial.

**Technical impact.** Unknown whether live `manager_profiles.status` matches webhook handlers.

**Recommendation.** One test manager: trial start, invoice, pay or expire, banner state. Then stop.

**Priority.** P1.

---

## 25. Documentation — 46

**Evidence.** Honest Phase 12 exists. `FINAL_CALQULUS_100_100_CERTIFICATION.md` is disclaimed at the top **and** still says “production-certifiable” / “0 remaining” blocking security — **contradicts live 42P17**. AGENTS.md migration counts (45/69) vs **74** files; “Next Steps” still list work marked Done. Phase 10 “PRODUCTION READY” vs Phase 12 “not ready”. Demo passwords in README.

**Problem.** Operators will follow the newest-looking “100/100” or Phase 10 file.

**Business impact.** Internal and buyer confusion; false security posture.

**Technical impact.** Wrong SQL (base schema) gets pasted because docs and filenames compete.

**Recommendation.** Point AGENTS.md and the 100/100 file at this gate + Phase 12. Fix counts. Do not write another “certified” report.

**Priority.** P1.

---

## 26. Deployment — 70

**Evidence.** `www.calqulus.site` **200**, SPA `/health` **200**, hashed assets, security headers. Native Vercel deploy from `main` works (AGENTS.md CI audit). Actions `deploy-vercel` is redundant and fails without `VERCEL_*` secrets. `monitor.yml` will warn on health-check 404.

**Problem.** Two deploy truths. Functions host ≠ Vercel host.

**Business impact.** “Did we deploy?” has two answers.

**Technical impact.** Edge functions lag the frontend.

**Recommendation.** Keep native Vercel. Deploy `health-check` separately. Do not add Netlify.

**Priority.** P2 for pipeline cleanup; P1 for function deploy.

---

## 27. Observability — 38

**Evidence.** `observability.ts` (correlation, vitals, KPI flush) wired from `main.tsx`. `ProductionDiagnostics` Ctrl+Shift+D. Grafana JSON and `monitoring/alerts.yml` in repo — **not shown to be scraping anything**. Live **health-check 404**. Sentry DSN optional / not confirmed on Vercel.

**Problem.** The observability *stack* is documented; the production *signal* for functions is missing.

**Business impact.** You will learn about outages from customers.

**Technical impact.** `monitor.yml` health job cannot succeed.

**Recommendation.** Deploy health-check. One uptime check on `/health` + functions health. Ignore Grafana until those two are green.

**Priority.** P1.

---

## 28. Disaster recovery — 42

**Evidence.** Local restore drill (`RESTORE_DRILL.json`): 127 public tables dump→restore matched; **not production PITR**; 32/74 SQL files failed on bare Postgres (auth/storage). No live backup restore. Base schema `DELETE FROM` is a foot-gun. Rollback guide exists, unused.

**Problem.** We know a local empty Postgres can load table DDL/data from a drill script. We do not know RPO/RTO for `aelzsqxllkypbzslxyju`.

**Business impact.** A bad SQL paste (already attempted) has no proven rewind.

**Technical impact.** PITR remains a Supabase dashboard checkbox, unverified here.

**Recommendation.** Confirm PITR enabled in Supabase. Snapshot before applying live SQL. Do not run base-schema DELETEs.

**Priority.** P1 before any more live DDL.

---

## 29. Production readiness — 45

**Evidence.** Site up. CI verify path exists. Live P1: RLS recursion, missing RPCs, health-check 404, 86 nocheck files, webhost E2E skipped, no mutating payment. Phase 12: not production-ready.

**Problem.** “It loads” is not “it is the ledger.”

**Business impact.** Deploying *the frontend* already happened. Deploying *trust* has not.

**Technical impact.** Production is a mix of old DB and new app.

**Recommendation.** Gate “production-ready” on: no 42P17, RPCs present, health-check 200, one payment proof, SOC2 copy gone.

**Priority.** P0/P1 bundle.

---

## 30. Product-market readiness — 50

**Evidence.** Real job-to-be-done: Kenyan managers collecting rent via M-Pesa, landlords without tenant PII, tenants paying in a portal. Core portals exist and demo-login. Pricing/packaging confused. Lab AI/GTM/compliance screens dilute the story. 1,000-unit needs: isolation proof, dashboard RPC, performance, subscription enforcement — all incomplete.

**Problem.** The wedge is clear; the offer and the live backend are not.

**Business impact.** You can demo. You should not sign an SLA for 1,000 units.

**Technical impact.** Complexity (88 functions, dual IA) delays the wedge.

**Recommendation.** Sell manager + tenant collections + landlord report. Freeze agency/webhost lab scope until live SQL is applied.

**Priority.** P1 commercially; no new modules.

---

## Answers

### 1. What would stop you from deploying CALQULUS today?

The frontend is already on Vercel. What stops treating **this** project as a deploy-complete system of record:

1. Live **`42P17`** on `tenants` / `invoices` / `platform_admins` (confirmed this session).
2. Live **missing** `get_manager_dashboard_stats` / `get_landlord_portfolio_stats` (PGRST202).
3. **`health-check` 404** on the functions host.
4. Repo SQL **not applied**; further DDL without PITR confirmation.
5. **False SOC2 Type II** copy in the logged-in footer.

Deploying *more* frontend on top of this database makes the split worse, not better.

### 2. What would stop you from charging customers today?

1. No observed **invoice → payment → receipt** on this project.
2. Financial integrity SQL **not live**; tests are mocks.
3. **Pricing** contradiction (per-property catalog vs per-unit AGENTS.md; Enterprise 500 < Pro 600).
4. Subscription trial/suspend **unproven**.
5. Compliance **misrepresentation** (cannot take money while the product says SOC2 certified).
6. Invitation token RPC **type mismatch** (onboarding to paid seats can break).

A supervised pilot with written “beta, no SLA, demo data OK” is the most that is honest.

### 3. What would stop you from selling to a 1,000-unit property manager today?

Everything in (1) and (2), plus:

1. **Isolation not live-proven** (skipped JWT test; recursive tenant policies).
2. Dashboard stats RPC missing → **query fan-out** at that scale.
3. Lab LCP **~6 s**; 204 KB logo; no load-test evidence for 1,000 units.
4. **86** untyped production files in the money/tenant path.
5. Webhost/agency/lab IA is not an operator-grade control plane.
6. No production **PITR** drill; a bad migration is existential at that size.

### 4. Five highest-ROI improvements

1. **Apply `apply-live-p1-rls.sql` then `apply-live-p1-rpcs.sql`** (contents, not paths). Re-probe tenants and dashboard RPC. Highest leverage; SQL already written.
2. **Remove false SOC2/ISO certified UI** and unroute mock compliance dashboards. Trust ROI; hours of copy, not a rewrite.
3. **One live payment** (STK or recorded) + receipt visible to tenant; apply 20260819 financial SQL if tables exist.
4. **One pricing source of truth** + working signup/trial banner on a demo manager.
5. **Deploy `health-check`** (`verify_jwt=false`) and treat `/health` + functions health as the only uptime pair.

### 5. What can safely remain unfinished?

- Capacitor / `src/mobile` store apps  
- Grafana / Prometheus files  
- Accountant / Maintenance / Leasing / Support command centers  
- AI copilot, GTM workspace, occupancy forecasting, penetration-testing **dashboards** (keep unfinished; do not sell)  
- Agency portal depth beyond the scaffold  
- Paying down all 86 `@ts-nocheck` files (do payment/tenant first)  
- Native Vercel vs Actions dual pipeline (annoying, not the ledger)  
- Outfit vs Inter markdown  
- Extra sidebar items already there (do not add more; do not require a full IA project to ship SQL)

---

## What this audit did not invent

Not claimed: a production double-pay bug (not exercised). Not claimed: tenant PII leaking to webhost via a captured response (not captured). Not claimed: SOC2 in any real sense. Not claimed: 95/100.

Live facts this session: site 200, SPA `/health` 200, functions `health-check` 404, tenants 500 `42P17`.

---

## Operator next step (unchanged)

SQL Editor: paste **file contents** of [`supabase/sql/apply-live-p1-rls.sql`](../../supabase/sql/apply-live-p1-rls.sql), then [`supabase/sql/apply-live-p1-rpcs.sql`](../../supabase/sql/apply-live-p1-rpcs.sql).  
Do **not** paste `20230101000000_base_schema.sql`.
