# Uptime Monitoring Setup

## Overview
Uptime monitoring ensures that CALQULUS RMS services are available and responsive. This document outlines the setup for monitoring uptime using UptimeRobot or similar services.

## Monitoring Endpoints

### Primary Endpoints
1. **Application Health Check**
   - URL: `https://www.calqulus.site/health`
   - Expected: HTTP 200 with JSON response
   - Check interval: 1 minute
   - Alert threshold: 2 consecutive failures

2. **API Health Check**
   - URL: `https://www.calqulus.site/api/health`
   - Expected: HTTP 200 with JSON response
   - Check interval: 1 minute
   - Alert threshold: 2 consecutive failures

3. **Database Connectivity**
   - URL: `https://www.calqulus.site/api/health/db`
   - Expected: HTTP 200 with database status
   - Check interval: 1 minute
   - Alert threshold: 2 consecutive failures

### Secondary Endpoints
1. **Authentication Service**
   - URL: `https://www.calqulus.site/api/auth/health`
   - Expected: HTTP 200
   - Check interval: 5 minutes
   - Alert threshold: 3 consecutive failures

2. **Payment Processing**
   - URL: `https://www.calqulus.site/api/payments/health`
   - Expected: HTTP 200
   - Check interval: 5 minutes
   - Alert threshold: 3 consecutive failures

3. **Static Assets**
   - URL: `https://www.calqulus.site/static/logo.png`
   - Expected: HTTP 200
   - Check interval: 5 minutes
   - Alert threshold: 5 consecutive failures

## UptimeRobot Configuration

### Setup Instructions
1. Create account at https://uptimerobot.com/
2. Add monitors for each endpoint above
3. Configure alert contacts:
   - Email: alerts@calqulusrms.com
   - Slack: #calqulusrms-alerts
   - SMS: On-call engineer
4. Set up status page: https://status.calqulusrms.com

### Monitor Settings
- **Type**: HTTPS
- **Interval**: 1-5 minutes (depending on endpoint)
- **Timeout**: 30 seconds
- **Alert Threshold**: 2-5 consecutive failures
- **Keyword Check**: Check for specific response content if needed

### Alert Contacts
1. **Primary**: Email to alerts@calqulusrms.com
2. **Secondary**: Slack webhook to #calqulusrms-alerts
3. **Critical**: SMS to on-call engineer (for P1 endpoints)
4. **Status Page**: Public status page updates

## Alternative: Better Uptime

### Setup Instructions
1. Create account at https://betteruptime.com/
2. Add monitors for each endpoint
3. Configure alert channels:
   - Email
   - Slack
   - SMS
   - Phone call (for critical alerts)
4. Set up status page

### Advantages over UptimeRobot
- Faster alert delivery
- More alert channels (including phone calls)
- Better status page customization
- API for custom integrations
- Incident management features

## Alternative: Pingdom

### Setup Instructions
1. Create account at https://www.pingdom.com/
2. Add monitors for each endpoint
3. Configure alert contacts
4. Set up status page

### Advantages
- Detailed performance metrics
- Root cause analysis
- Transaction monitoring
- Synthetic user monitoring

## Health Check Implementation

### Endpoint: `/health`
```typescript
// GET /health
{
  "status": "healthy",
  "timestamp": "2026-06-02T09:00:00Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": "healthy",
    "cache": "healthy",
    "external_apis": {
      "mpesa": "healthy",
      "stripe": "healthy"
    }
  }
}
```

### Endpoint: `/api/health`
```typescript
// GET /api/health
{
  "status": "healthy",
  "timestamp": "2026-06-02T09:00:00Z",
  "uptime": 99.95,
  "response_time_ms": 150
}
```

### Endpoint: `/api/health/db`
```typescript
// GET /api/health/db
{
  "status": "healthy",
  "timestamp": "2026-06-02T09:00:00Z",
  "database": {
    "connection_pool": "healthy",
    "active_connections": 15,
    "max_connections": 100,
    "latency_ms": 5
  }
}
```

## Alert Escalation

### Level 1: First Alert
- **Time**: Immediately after threshold reached
- **Action**: Email to alerts@calqulusrms.com, Slack message
- **Response**: On-call engineer acknowledges within 15 minutes

### Level 2: Escalation
- **Time**: 15 minutes after first alert (no acknowledgment)
- **Action**: SMS to on-call engineer, Slack @mention
- **Response**: On-call engineer acknowledges within 10 minutes

### Level 3: Critical Escalation
- **Time**: 30 minutes after first alert (no acknowledgment)
- **Action**: Phone call to on-call engineer, notify CTO
- **Response**: Immediate response required

## Status Page

### Public Status Page
- URL: https://status.calqulusrms.com
- Updates: Automatic from uptime monitoring
- Historical data: 90 days
- Incident reports: Public for major incidents

### Internal Status Dashboard
- Grafana dashboard: https://grafana.calqulusrms.com/d/uptime
- Real-time metrics
- Detailed incident logs
- Team communication integration

## Integration with Existing Monitoring

### Grafana Integration
- Uptime metrics sent to Prometheus
- Grafana dashboard displays uptime history
- Alerts integrated with existing notification channels

### Sentry Integration
- Uptime failures logged as Sentry events
- Correlation with application errors
- Root cause analysis

### Slack Integration
- Uptime alerts posted to #calqulusrms-alerts
- Status updates in #calqulusrms-status
- Incident communication channels

## Maintenance

### Regular Checks
- Weekly: Review uptime reports
- Monthly: Update monitoring endpoints
- Quarterly: Review and optimize alert thresholds

### Updates
- Add new endpoints as services are added
- Remove deprecated endpoints
- Update contact information as team changes

### Testing
- Monthly: Test alert delivery
- Quarterly: Test escalation procedures
- Annually: Full monitoring audit

## Related Resources
- UptimeRobot: https://uptimerobot.com/
- Better Uptime: https://betteruptime.com/
- Pingdom: https://www.pingdom.com/
- Status Page: https://status.calqulusrms.com
- Grafana Dashboard: https://grafana.calqulusrms.com/d/uptime
- Slack: #calqulusrms-alerts
