# CALQULUS PMS — Phase 80–81 Notification / Identity / Audit Hardening

## Phase 80
- `create_in_app_notification_atomic`
- `mark_in_app_notification_read_atomic`
- `mark_all_in_app_notifications_read_atomic`
- `dismiss_in_app_notification_atomic`
- `save_push_subscription_atomic`
- `delete_push_subscription_atomic`
- Added unique `(user_id, endpoint)` push-subscription index.
- Revoked direct authenticated/anonymous DML on `in_app_notifications` and `push_subscriptions`.
- Notification creation validates the authenticated manager/submanager scope and recipient relationship.
- UI notification and push mutation paths now use RPCs.

## Phase 81
- `update_profile_currency_atomic`
- `append_activity_log_atomic`
- Currency identity is derived from `auth.uid()`.
- Audit actor identity/email/role are derived server-side; clients cannot spoof audit actor fields.
- Direct authenticated/anonymous INSERT/DELETE on profiles and all DML on activity logs revoked. Existing profile UPDATE remains available for unrelated legacy profile preferences.

## Verification
- Production audit: PASS.
- Targeted notification/push/audit/profile mutation scan: PASS.
- SQL function/dollar-quote structure: PASS.
- Live Supabase execution: not available in this environment.
- TypeScript/Vitest/build: environment-dependent and reported separately when dependencies are unavailable.
