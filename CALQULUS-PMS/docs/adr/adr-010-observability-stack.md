# ADR-010: Observability Stack (Sentry, Grafana)

**Status**: Accepted  
**Date**: 2024-06-01  
**Deciders**: Platform Team, DevOps Team

## Context

We needed a comprehensive observability solution to:

1. **Monitor Application Health**: Track errors, performance, and user behavior
2. **System Performance**: Monitor API latency, database queries, edge function execution
3. **Business Metrics**: Track payments, tenant signups, revenue
4. **Alerting**: Notify on failures, performance degradation, security incidents

## Decision

We implemented a **multi-layer observability stack**:

### Layer 1: Error Tracking (Sentry)

```typescript
// Frontend error tracking
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
});

// Capture custom events
Sentry.captureMessage("Payment processed", {
  level: "info",
  extra: { invoiceId, amount },
});
```

### Layer 2: Metrics & Dashboards (Grafana)

```
┌─────────────────────────────────────────────────┐
│                  Grafana Dashboards              │
├─────────────┬─────────────┬─────────────────────┤
│  System     │   Payment   │   Business KPIs      │
│  Health     │ Operations  │                     │
├─────────────┼─────────────┼─────────────────────┤
│ Request Rate│Payment Count│Revenue Tracking     │
│ Error Rate  │Success Rate │Tenant Events        │
│ Latency     │M-Pesa Stats │Property Metrics     │
└─────────────┴─────────────┴─────────────────────┘
```

### Layer 3: Logging (Structured Logs)

```typescript
// Frontend structured logging
import { logger } from "@/shared/lib/observability";

logger.info("Payment initiated", {
  correlationId: getCorrelationId(),
  invoiceId,
  amount,
  userId,
  sessionId: getSessionId(),
});

// Performance marks
performance.mark("payment-initiated");
performance.mark("payment-completed");
performance.measure("payment-duration", "payment-initiated", "payment-completed");
```

### Layer 4: Uptime Monitoring

```yaml
# monitoring/uptime-monitoring.yaml
checks:
  - name: api-health
    url: https://aelzsqxllkypbzslxyju.supabase.co
    interval: 5m
    timeout: 10s
  
  - name: app-health
    url: https://www.calqulus.site
    interval: 1m
    timeout: 5s
```

## Dashboards

| Dashboard | Purpose | Refresh |
|-----------|---------|---------|
| System Health | Infrastructure metrics | 30s |
| Payment Operations | Payment success/failure rates | 1m |
| Business KPIs | Revenue, signups, occupancy | 5m |
| Web Vitals | LCP, FID, CLS tracking | 5m |

## Consequences

### Benefits

- **Full Visibility**: Every layer of the stack is observable
- **Fast Debugging**: Correlated logs + traces = quick root cause
- **Business Insights**: KPIs tracked alongside technical metrics
- **Alerting**: Proactive notifications before issues escalate

### Drawbacks

- **Cost**: Sentry, Grafana Cloud have usage-based pricing
- **Complexity**: Multiple tools require integration effort
- **Noise**: Too many alerts can cause alert fatigue

## References

- [Observability Dashboards Documentation](../docs/OBSERVABILITY_DASHBOARDS.md)
- [Logging Standards](../docs/LOGGING_STANDARDS.md)
- [Alerting Rules](../docs/ALERTING_RULES.md)
- [Grafana Dashboards Configurations](/monitoring/grafana-dashboards/)
