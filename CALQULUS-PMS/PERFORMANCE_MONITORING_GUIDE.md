# CALQULUS RMS Performance Monitoring Guide

## Overview

CALQULUS RMS uses Sentry for comprehensive error tracking, performance monitoring, and user session recording. This guide covers setup, configuration, and best practices.

## Sentry Integration

### Prerequisites

Sentry is already included in the project dependencies:
```json
"@sentry/browser": "^10.53.1"
```

### Setup

#### 1. Create Sentry Project

1. Go to [sentry.io](https://sentry.io)
2. Create a new project (select "React" as platform)
3. Get your DSN (Data Source Name)

#### 2. Configure Environment Variables

Add to `.env.local` (or Vercel environment variables):

```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_ENV=production
VITE_APP_VERSION=1.0.0
```

#### 3. Source Maps Upload

Source maps are emitted as `hidden` in the build configuration. Upload them to Sentry for better error tracking.

**Vercel Setup:**

Add to `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "installCommand": "npm install",
  "postbuildCommand": "npx sentry-cli upload-sourcemaps --url https://sentry.io --org your-org --project your-project --dist $VERCEL_GIT_COMMIT_SHA"
}
```

**Manual Upload:**
```bash
npx sentry-cli upload-sourcemaps \
  --url https://sentry.io \
  --org your-org \
  --project your-project \
  --dist $(git rev-parse HEAD) \
  ./dist
```

## Error Tracking

### Automatic Error Capture

The `errorLogger` in `src/shared/lib/errorLogger.ts` automatically forwards errors to Sentry when `VITE_SENTRY_DSN` is set.

```typescript
import { logError } from '@/shared/lib/errorLogger'

try {
  // Your code
} catch (error) {
  logError('ComponentName', error)
}
```

### Manual Error Reporting

```typescript
import * as Sentry from '@sentry/browser'

Sentry.captureException(error)
```

### Custom Error Context

```typescript
Sentry.captureException(error, {
  tags: {
    component: 'PaymentForm',
    action: 'submit'
  },
  extra: {
    invoiceId: invoice.id,
    amount: invoice.amount
  }
})
```

### User Feedback

Enable user feedback for errors:

```typescript
Sentry.captureException(error, {
  user: {
    id: user.id,
    email: user.email,
    role: userRole?.role
  }
})
```

## Performance Monitoring

### Transaction Tracking

Track user interactions and page loads:

```typescript
import * as Sentry from '@sentry/browser'

// Start a transaction
const transaction = Sentry.startTransaction({
  name: 'payment-flow',
  op: 'transaction'
})

// Add spans
const span = transaction.startChild({
  op: 'http',
  description: 'POST /api/payments'
})

// Finish span
span.finish()

// Finish transaction
transaction.finish()
```

### React Performance

Sentry automatically tracks:
- Initial page load
- Route transitions
- Component render times
- API response times

### Custom Performance Metrics

```typescript
Sentry.metrics.increment('payment.success', 1, {
  tags: { method: 'mpesa' }
})

Sentry.metrics.timing('payment.processing', duration, {
  tags: { method: 'stripe' }
})
```

## Session Replay

### Enable Session Replay

Session replay captures user interactions to debug issues.

```typescript
import * as Sentry from '@sentry/browser'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      // Sample rate for session replay
      sessionSampleRate: 0.1, // 10% of sessions
      // Sample rate for error replay
      errorSampleRate: 1.0, // 100% of errors
    }),
  ],
  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions
})
```

### Privacy Controls

Mask sensitive data in replays:

```typescript
new Sentry.Replay({
  mask: ['.sensitive-class'],
  unmask: ['.safe-class'],
  block: ['.credit-card'],
  ignore: ['.ignore-me']
})
```

## Release Tracking

### Tag Releases

```bash
# Set release version
SENTRY_RELEASE=$(git rev-parse HEAD) npm run build
```

### Associate Commits

```bash
sentry-cli releases set-commits \
  --auto \
  --org your-org \
  --project your-project
```

### Deploy Notifications

```bash
sentry-cli releases deploy \
  --env production \
  --url https://www.calqulus.site \
  $(git rev-parse HEAD)
```

## Alerts & Notifications

### Configure Alerts

1. Go to Sentry → Settings → Alerts
2. Set up alerts for:
   - Error rate increases
   - Performance degradation
   - New issues
   - Regression detection

### Notification Channels

Configure notifications to:
- Email
- Slack
- Microsoft Teams
- PagerDuty
- Custom webhooks

## Performance Budgets

### Set Performance Budgets

```typescript
Sentry.init({
  tracesSampleRate: 0.1,
  // Performance budgets
  beforeSend(event, hint) {
    if (event.type === 'transaction') {
      const duration = event.start_timestamp - event.end_timestamp
      if (duration > 3000) { // 3 second budget
        event.tags = {
          ...event.tags,
          performance_budget: 'exceeded'
        }
      }
    }
    return event
  }
})
```

### Core Web Vitals

Sentry automatically tracks Core Web Vitals:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)

Set thresholds:
```typescript
Sentry.init({
  integrations: [
    new Sentry.BrowserTracing({
      tracingOrigins: ['localhost', 'https://www.calqulus.site'],
      // Custom performance thresholds
      idleTimeout: 5000,
      maxDuration: 30000,
    })
  ]
})
```

## Database Performance

### Slow Query Tracking

Sentry captures slow Supabase queries automatically. Monitor:
- Query duration
- Query frequency
- Error rates

### Database Index Monitoring

Track query performance and identify missing indexes:
```typescript
Sentry.metrics.timing('db.query', duration, {
  tags: { table: 'payments', operation: 'select' }
})
```

## API Performance

### Edge Function Monitoring

Edge functions are automatically monitored. Track:
- Function execution time
- Error rates
- Cold starts

### Custom API Metrics

```typescript
Sentry.metrics.timing('api.call', duration, {
  tags: {
    endpoint: '/api/payments',
    method: 'POST',
    status: '200'
  }
})
```

## User Journey Tracking

### User Flows

Track critical user journeys:
```typescript
const transaction = Sentry.startTransaction({
  name: 'tenant-signup-flow',
  op: 'navigation'
})

// Track each step
transaction.startChild({ op: 'click', description: 'click-signup' })
transaction.startChild({ op: 'form', description: 'fill-details' })
transaction.startChild({ op: 'submit', description: 'submit-form' })

transaction.finish()
```

### Funnel Analysis

Monitor conversion funnels:
```typescript
Sentry.metrics.increment('funnel.step', 1, {
  tags: { funnel: 'tenant-signup', step: 'email-verification' }
})
```

## Debugging with Sentry

### Error Context

View error context in Sentry:
- Stack traces with source maps
- User information
- Browser/device details
- Network requests
- Console logs

### Session Replay

Replay user sessions to debug issues:
- See what the user saw
- Track mouse movements
- Monitor network activity
- Identify UI issues

### Performance Profiling

Analyze performance profiles:
- Identify slow components
- Track render times
- Monitor memory usage
- Detect memory leaks

## Best Practices

### 1. Don't Track Sensitive Data

```typescript
// Bad
Sentry.captureException(error, {
  extra: { password: user.password }
})

// Good
Sentry.captureException(error, {
  extra: { userId: user.id }
})
```

### 2. Use Appropriate Sampling

```typescript
// Production: Lower sampling
tracesSampleRate: 0.1
sessionSampleRate: 0.1

// Development: Higher sampling
tracesSampleRate: 1.0
sessionSampleRate: 1.0
```

### 3. Group Related Errors

```typescript
Sentry.captureException(error, {
  fingerprint: ['payment-error', error.code]
})
```

### 4. Add Context

```typescript
Sentry.setContext('payment', {
  amount: payment.amount,
  method: payment.method,
  invoiceId: payment.invoiceId
})
```

### 5. Monitor Key Metrics

Track:
- Error rate
- Apdex score
- Page load time
- Transaction duration
- User satisfaction

## Troubleshooting

### Source Maps Not Working

1. Verify source maps are uploaded
2. Check `hidden` source map setting in `vite.config.ts`
3. Ensure release version matches
4. Verify DSN is correct

### No Errors Appearing

1. Check `VITE_SENTRY_DSN` is set
2. Verify Sentry initialization
3. Check browser console for errors
4. Verify network requests to Sentry

### Session Replay Not Working

1. Check sample rate settings
2. Verify browser compatibility
3. Check for ad blockers
4. Verify privacy settings

### Performance Data Missing

1. Check `tracesSampleRate` setting
2. Verify `tracingOrigins` configuration
3. Check for CORS issues
4. Verify browser support

## Monitoring Dashboard

### Key Metrics to Monitor

1. **Error Rate**
   - Target: < 0.1%
   - Alert if: > 1%

2. **Page Load Time**
   - Target: < 2s
   - Alert if: > 4s

3. **Transaction Duration**
   - Target: < 1s
   - Alert if: > 3s

4. **User Satisfaction**
   - Target: > 95%
   - Alert if: < 90%

### Custom Dashboards

Create dashboards for:
- Error trends
- Performance metrics
- User journeys
- API health
- Database performance

## Integration with Other Tools

### Vercel Integration

Sentry integrates with Vercel for:
- Automatic deployment tracking
- Release association
- Environment detection
- Build error tracking

### GitHub Integration

Link Sentry to GitHub for:
- Issue creation
- Commit linking
- PR annotations
- Release tracking

### Slack Integration

Send alerts to Slack:
```typescript
Sentry.configureScope(scope => {
  scope.setTag('slack_channel', '#alerts')
})
```

## Cost Optimization

### Reduce Data Volume

1. Lower sampling rates
2. Filter out noise
3. Use beforeSend hooks
4. Ignore known issues

### Sampling Strategy

```typescript
// Critical errors: 100%
if (error.level === 'fatal') {
  Sentry.captureException(error)
}

// Warnings: 10%
if (error.level === 'warning' && Math.random() < 0.1) {
  Sentry.captureException(error)
}
```

## Security Considerations

### Data Privacy

1. Mask PII in logs
2. Use session replay carefully
3. Comply with GDPR
4. Implement data retention policies

### Access Control

1. Restrict Sentry access
2. Use role-based permissions
3. Audit access logs
4. Rotate API keys

## Maintenance

### Regular Tasks

1. Review error trends weekly
2. Update Sentry SDK monthly
3. Rotate DSN quarterly
4. Review sampling rates monthly
5. Clean up old releases quarterly

### Health Checks

```typescript
// Add health check endpoint
app.get('/health', (req, res) => {
  Sentry.captureMessage('Health check passed')
  res.json({ status: 'healthy' })
})
```

## Resources

- [Sentry Documentation](https://docs.sentry.io)
- [Sentry React SDK](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/platforms/javascript/performance/)
- [Session Replay](https://docs.sentry.io/platforms/javascript/session-replay/)
