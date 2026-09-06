# CALQULUS PMS — Notification Retry Control Completion

## Scope

This batch hardens the payment-notification exception path so a recorded payment can be retried safely when email, SMS, WhatsApp, manager, or landlord notification delivery fails.

## Changes

- Submanagers can operate notification failures belonging to their manager scope.
- Added `claim_notification_failure_retry_atomic(uuid)` with authorization, 3-attempt cap, and 60-second retry cooldown.
- Added `retry-notification-failure` Edge Function that replays only known notification functions using the persisted payload.
- Added a guarded **Retry now** action to the manager notification-failure panel.
- Successful replay transitions the failure to `replayed`; failed retries remain visible for investigation.
- Existing manual **Mark resolved** workflow remains available.

## Verification

- Migration-chain audit: PASS — 173 migrations, 0 unexpected duplicates, 0 ordering warnings.
- Cross-role isolation audit: PASS.
- Deployment-controls audit: PASS.
- TypeScript/TSX syntax transpilation checks: PASS for changed files.
- SQL static assertions: PASS.
- Supabase connectivity smoke query: PASS against project `hmgpltrjlsescfquqxeg`.
- Full dependency-backed Vitest/build remains unavailable in the packaged workspace because `node_modules` is not installed.
- Live application migration reconciliation remains required before deployment.
