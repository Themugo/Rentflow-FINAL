# Agency Portal & Dashboard — End-to-End UX / Workflow Sweep

Date: 2026-09-06  
Foundation: `f2da729454017e3c6f95615ca3e6585c19c70ba0` (`main`)  
Scope: Agency portal, dashboard, navigation and operating workflow presentation.

## Baseline decision

This initiative starts from the current GitHub `main` foundation. No alternate Agency portal, dashboard, billing engine, navigation model, or data-fetching layer is introduced.

## Findings

### 1. The Agency dashboard already had the correct operational data surface

The dashboard already combines live portfolio KPIs, cash-flow trend, attention queue, client performance, property performance, quick actions and recent activity. The sweep therefore preserves the existing dashboard instead of replacing it.

### 2. Navigation was the main usability friction

The Agency sidebar previously placed almost every operational destination under one large `Operations` group. This made financial work, property work, client-book work and configuration look equivalent even though they have different user intent and risk.

The navigation is now grouped as:

- Overview
- Client book
- Financial operations
- Property operations
- Insights & control

The existing routes are unchanged.

### 3. Configuration was visually hidden behind “Settings”

The existing `/agency/settings` page is the Agency Operations Center and contains contract rules, charges, payment rules, defaults and team permissions. Calling this simply “Settings” understated its business importance.

The canonical navigation now labels the same route **Agency controls**. No second configuration page was created.

### 4. Dashboard collection language needed stronger commercial truth

An Agency may collect rent for one client and have the landlord collect directly for another. Dashboard copy therefore must not imply that every recorded collection is Agency cash.

The dashboard now describes collections as **recorded collections** and explicitly ties them to the client mandate.

### 5. Quick actions needed a direct configuration entry

The dashboard already linked common operational work. The sweep adds a direct **Agency controls** action so an administrator can move from operational insight to the governing rules without hunting through navigation.

## End-to-end workflow preserved

The intended Agency flow remains:

`Agency dashboard → client → property → unit/tenant → lease → billing/payment → maintenance/operations → statements/reports → Agency controls`

The controls determine the applicable client arrangement; they do not replace the underlying property, tenant, billing, payment or ledger systems.

## Security / data-boundary posture

This UX initiative makes no weakening of route guards, RLS, RPC authorization, payment controls, financial close controls, or client isolation. Existing server-side authority remains the source of truth.

## Duplication check

- No second Agency dashboard.
- No second Agency navigation definition.
- No second Agency settings/control center.
- No second payment or billing engine.
- No new data store for dashboard metrics.
- Existing live hooks and canonical routes remain in use.

## Verification

Added `src/test/agencyPortalUxWorkflowSweep.test.ts` to protect the canonical navigation, route surface and mandate-aware dashboard language.

Because this delivery snapshot does not contain installed `node_modules`, runtime Vitest/typecheck/build execution must be performed after `npm ci` in the local repository before commit/push.
