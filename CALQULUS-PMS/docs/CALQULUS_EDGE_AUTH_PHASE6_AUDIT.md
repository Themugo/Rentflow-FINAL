# CALQULUS PMS — Phase 6 Edge Authentication Convergence Audit

## Scope

Converge authentication and role-gating in four high-risk Edge Functions that perform payout, dispute, or financial penalty operations.

## Changes

- `create-payout` now uses the shared `authenticateUser` and `checkRoleAccess` helpers.
- `execute-payout` now uses the shared authentication and webhost authorization path.
- `resolve-dispute` now uses the shared authentication and role authorization path while preserving manager/submanager portfolio scoping.
- `apply-penalties` now uses the shared authentication helper with an explicit service-role allowance for scheduled/internal execution and shared manager/webhost role authorization for user calls.
- Removed duplicated `createClient` + `auth.getUser` authentication blocks from these functions.

## Preserved controls

- CORS/preflight behavior.
- Per-function rate limits and fail-closed settings.
- Property/portfolio ownership checks.
- Payout pending-state atomic claim.
- Dispute adjustment behavior.
- Service-role-only internal execution path for automated penalties.

## Static verification

- Target functions contain no direct `supabase.auth.getUser` calls.
- Target functions contain no local `createClient` calls.
- Service-role bypass remains limited to `apply-penalties`.
- Explicit role gates remain present for every target.
- `git diff --check` clean.

## Runtime verification limitation

Project dependencies are not installed in the available workspace, so Vitest/lint/build cannot be claimed as executed. The phase test is included for the repository's normal CI/developer environment.
