# CALQULUS PMS — Bank Reconciliation Phase 9 Audit

## Scope

Phase 9 closes the caller-scope gap left by the Phase 8 atomic reconciliation work. The edge function uses a service-role client for financial RPCs, so an authenticated browser caller must be bound to their own manager identity before that privileged client is used.

## Changes

- `reconcile-bank` now identifies the caller as user JWT, service role, or cron before creating the service-role client.
- Authenticated callers must use their own `userId` as `managerId`.
- Authenticated single reconciliation additionally requires the target invoice's `manager_id` to match the caller.
- Authenticated callers must pass the shared approved-manager authorization check.
- Service-role/cron callers retain internal cross-manager operation for scheduled/server workflows.
- Bulk reconciliation now rejects missing/non-string `managerId` before querying bank transactions.
- Added regression tests covering caller binding and privileged-client ordering.

## Security invariant

A normal authenticated user cannot select an arbitrary `managerId` or invoice belonging to another manager and cause `reconcile-bank` to execute the service-role payment RPC for that portfolio.

## Verification

Static source audit and delimiter checks are required before packaging. Project npm gates should be run when dependencies are available; missing local dependencies must be reported rather than treated as passes.
