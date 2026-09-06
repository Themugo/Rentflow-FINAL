# Alerting & SLO Runbook (Phase 99)

## SLOs
- Availability: **99.5%** monthly target.
- Error budget: **0.5%**.
- p95 latency: 3s interactive, 10s webhooks, 30s background jobs.

## Page-worthy alerts
1. Health endpoint reports `unhealthy`.
2. HTTP 5xx exceeds 5% over the agreed rolling window.
3. Webhook dead-letter volume increases unexpectedly.
4. Notification failures/replays increase unexpectedly.
5. Payment/reconciliation failures breach the incident threshold.

## Response
Acknowledge → capture `X-Request-Id` → identify affected function → inspect correlated logs → check DLQ/replay state → mitigate → verify recovery → document incident.

## Deployment gate
Run `npm run audit:operations-readiness` plus the existing release-readiness/security audits. Production evidence remains external: alert delivery, synthetic checks, staging smoke, and restore tests.
