# CALQULUS PMS — Phase 33–34 Audit

## Phase 33 — Maintenance lifecycle

Maintenance creation, manager status transitions, manager assignment, and assigned-provider start/complete actions now use SECURITY DEFINER, row-locked RPCs with role and portfolio checks. Direct authenticated writes to `maintenance_requests` are revoked. Seed/demo functions remain service-role operations.

## Phase 34 — Expenditure lifecycle

Manager expenditure create/update is centralized in `save_expenditure_atomic`. The database enforces manager scope, positive amounts, YYYY-MM month format, and one category per manager/month via a unique index. Direct authenticated writes to `expenditures` are revoked.

## Verification

Static source mutation audit and ZIP integrity checks passed. Production audit passes where dependencies are not required. Vitest/lint/build/typecheck remain environment-blocked when workspace dependencies are absent.
