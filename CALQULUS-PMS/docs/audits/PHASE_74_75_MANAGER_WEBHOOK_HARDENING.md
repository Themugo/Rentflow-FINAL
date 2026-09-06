# CALQULUS PMS — Phases 74–75 Manager/Webhook Mutation Hardening

## Phase 74 — Manager administration
- Added `provision_manager_account_atomic` for server-authorized manager role/profile provisioning after Auth signup.
- Added `transition_manager_admin_atomic` for approve, reject, suspend, reinstate and tier changes.
- Status log creation, role status and manager profile state are committed together.
- Rejection/suspension reasons are required server-side.
- Tier limits/rates are derived server-side; clients cannot submit arbitrary limits.
- Direct authenticated/anonymous writes revoked on `user_roles`, `manager_profiles`, and `manager_status_log`.
- Existing approval notification, service agreement and registration-invoice side effects remain outside the core status transaction.

## Phase 75 — Webhook dead-letter lifecycle
- Added `transition_webhook_dead_letter_atomic`.
- Webhost authorization is server-derived from the authenticated session.
- Row locking prevents concurrent resolution races.
- Only `resolved` and `ignored` are client-selectable lifecycle targets.
- `resolved_at` and `resolved_by` are server-managed.
- Direct authenticated/anonymous writes revoked on `webhook_dead_letter`; service-role edge functions remain able to persist failures.

## Verification notes
- Static SQL/function/grant checks are required before deployment.
- Live Supabase execution was not available in this workspace.
- Existing dependency-related test/typecheck/build limitations remain documented rather than being represented as passing.
