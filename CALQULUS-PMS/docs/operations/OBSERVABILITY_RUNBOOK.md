# CALQULUS PMS — Observability Runbook (Phase 98)

## Purpose
Provide a consistent request-correlation contract for Supabase Edge Functions without logging credentials, bearer tokens, payment secrets, or raw request bodies.

## Request correlation
Every instrumented function creates or accepts a validated `X-Request-Id`. The ID is returned in the response and emitted in structured `request.start`, `request.finish`, and `request.error` events.

## Required production signals
- request count and status-code distribution
- p50/p95/p99 latency
- 5xx error rate
- webhook retry/dead-letter count
- notification failure/replay count
- payment callback/reconciliation failures
- database/storage/auth health

## Triage
1. Search logs by `request_id`.
2. Check `request.finish.status` and `duration_ms`.
3. Correlate payment/webhook/notification identifiers only from approved non-secret fields.
4. Check `notification_failures` and `webhook_dead_letter` for replayable failures.
5. Escalate sustained 5xx > 5% or availability below 99.5%.

## Privacy rule
Never log Authorization headers, API keys, service-role keys, access/refresh tokens, passwords, secrets, or full payment payloads. The repository policy is in `config/observability-policy.json`.
