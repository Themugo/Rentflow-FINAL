# Alerting Rules

This document defines the alerting rules for CALQULUS PMS observability system, including thresholds, severity levels, and notification channels.

## Alert Severity Levels

### Critical
- System-wide outage or severe degradation
- Immediate action required
- Page on-call engineer
- Notify all stakeholders

### High
- Significant service degradation
- Action required within 15 minutes
- Page on-call engineer
- Notify team lead

### Medium
- Service degradation affecting some users
- Action required within 1 hour
- Send notification to team
- Create ticket

### Low
- Minor issues or warnings
- Action required within 24 hours
- Send notification to team
- Log for review

## System Health Alerts

### Critical Alerts
- **System Health Score < 50**
  - Condition: Overall system health score drops below 50
  - Duration: 1 minute
  - Notification: PagerDuty, Slack #critical
  - Escalation: Page after 5 minutes

- **Complete Service Outage**
  - Condition: All edge functions failing for 2 minutes
  - Duration: 2 minutes
  - Notification: PagerDuty, Slack #critical, email
  - Escalation: Page after 5 minutes, call CTO after 15 minutes

### High Alerts
- **System Health Score < 70**
  - Condition: Overall system health score drops below 70
  - Duration: 5 minutes
  - Notification: Slack #alerts, email
  - Escalation: Page after 15 minutes

- **Multiple Service Degradation**
  - Condition: 3+ services showing degraded status
  - Duration: 5 minutes
  - Notification: Slack #alerts, email
  - Escalation: Page after 15 minutes

### Medium Alerts
- **System Health Score < 85**
  - Condition: Overall system health score drops below 85
  - Duration: 10 minutes
  - Notification: Slack #alerts
  - Escalation: Email after 30 minutes

### Low Alerts
- **System Health Score < 95**
  - Condition: Overall system health score drops below 95
  - Duration: 15 minutes
  - Notification: Slack #info
  - Escalation: None

## Payment Operation Alerts

### Critical Alerts
- **Payment Success Rate < 80%**
  - Condition: M-Pesa payment success rate drops below 80%
  - Duration: 5 minutes
  - Notification: PagerDuty, Slack #payments-critical
  - Escalation: Page after 5 minutes, call product lead after 15 minutes

- **Payment Service Outage**
  - Condition: Paystack API returning 500 errors for 5 minutes
  - Duration: 5 minutes
  - Notification: PagerDuty, Slack #payments-critical
  - Escalation: Page after 5 minutes

### High Alerts
- **Payment Success Rate < 90%**
  - Condition: M-Pesa payment success rate drops below 90%
  - Duration: 10 minutes
  - Notification: Slack #payments, email
  - Escalation: Page after 15 minutes

- **Callback Failure Rate > 20%**
  - Condition: M-Pesa callback failure rate exceeds 20%
  - Duration: 10 minutes
  - Notification: Slack #payments, email
  - Escalation: Page after 15 minutes

### Medium Alerts
- **Payment Success Rate < 95%**
  - Condition: M-Pesa payment success rate drops below 95%
  - Duration: 15 minutes
  - Notification: Slack #payments
  - Escalation: Email after 30 minutes

- **Callback Failure Rate > 10%**
  - Condition: M-Pesa callback failure rate exceeds 10%
  - Duration: 15 minutes
  - Notification: Slack #payments
  - Escalation: Email after 30 minutes

- **Average Callback Latency > 60s**
  - Condition: Average time from payment initiation to callback exceeds 60 seconds
  - Duration: 10 minutes
  - Notification: Slack #payments
  - Escalation: Email after 30 minutes

### Low Alerts
- **Payment Success Rate < 98%**
  - Condition: M-Pesa payment success rate drops below 98%
  - Duration: 30 minutes
  - Notification: Slack #payments-info
  - Escalation: None

- **Timeout Rate > 5%**
  - Condition: Payment timeout rate exceeds 5%
  - Duration: 20 minutes
  - Notification: Slack #payments-info
  - Escalation: None

## API Performance Alerts

### Critical Alerts
- **API Success Rate < 90%**
  - Condition: Overall API success rate drops below 90%
  - Duration: 5 minutes
  - Notification: PagerDuty, Slack #api-critical
  - Escalation: Page after 5 minutes

- **API Latency > 5s**
  - Condition: Average API latency exceeds 5 seconds
  - Duration: 5 minutes
  - Notification: PagerDuty, Slack #api-critical
  - Escalation: Page after 5 minutes

### High Alerts
- **API Success Rate < 95%**
  - Condition: Overall API success rate drops below 95%
  - Duration: 10 minutes
  - Notification: Slack #api, email
  - Escalation: Page after 15 minutes

- **API Latency > 2s**
  - Condition: Average API latency exceeds 2 seconds
  - Duration: 10 minutes
  - Notification: Slack #api, email
  - Escalation: Page after 15 minutes

- **P99 Latency > 10s**
  - Condition: 99th percentile API latency exceeds 10 seconds
  - Duration: 10 minutes
  - Notification: Slack #api, email
  - Escalation: Page after 15 minutes

### Medium Alerts
- **API Success Rate < 98%**
  - Condition: Overall API success rate drops below 98%
  - Duration: 15 minutes
  - Notification: Slack #api
  - Escalation: Email after 30 minutes

- **API Latency > 1s**
  - Condition: Average API latency exceeds 1 second
  - Duration: 15 minutes
  - Notification: Slack #api
  - Escalation: Email after 30 minutes

- **P95 Latency > 3s**
  - Condition: 95th percentile API latency exceeds 3 seconds
  - Duration: 15 minutes
  - Notification: Slack #api
  - Escalation: Email after 30 minutes

### Low Alerts
- **API Error Rate > 2%**
  - Condition: API error rate exceeds 2%
  - Duration: 20 minutes
  - Notification: Slack #api-info
  - Escalation: None

- **Slow Endpoint Detected**
  - Condition: Single endpoint latency > 3s
  - Duration: 15 minutes
  - Notification: Slack #api-info
  - Escalation: None

## Database Performance Alerts

### Critical Alerts
- **Database Success Rate < 90%**
  - Condition: Database query success rate drops below 90%
  - Duration: 5 minutes
  - Notification: PagerDuty, Slack #db-critical
  - Escalation: Page after 5 minutes

- **Database Connection Pool Exhaustion**
  - Condition: Database connection pool utilization > 95%
  - Duration: 2 minutes
  - Notification: PagerDuty, Slack #db-critical
  - Escalation: Page after 5 minutes

### High Alerts
- **Database Success Rate < 95%**
  - Condition: Database query success rate drops below 95%
  - Duration: 10 minutes
  - Notification: Slack #database, email
  - Escalation: Page after 15 minutes

- **Database Latency > 500ms**
  - Condition: Average database query latency exceeds 500ms
  - Duration: 10 minutes
  - Notification: Slack #database, email
  - Escalation: Page after 15 minutes

- **Connection Pool Utilization > 80%**
  - Condition: Database connection pool utilization exceeds 80%
  - Duration: 10 minutes
  - Notification: Slack #database, email
  - Escalation: Page after 15 minutes

### Medium Alerts
- **Database Success Rate < 98%**
  - Condition: Database query success rate drops below 98%
  - Duration: 15 minutes
  - Notification: Slack #database
  - Escalation: Email after 30 minutes

- **Database Latency > 200ms**
  - Condition: Average database query latency exceeds 200ms
  - Duration: 15 minutes
  - Notification: Slack #database
  - Escalation: Email after 30 minutes

- **Slow Query Detected**
  - Condition: Single query latency > 1s
  - Duration: 10 minutes
  - Notification: Slack #database
  - Escalation: Email after 30 minutes

### Low Alerts
- **Database Error Rate > 1%**
  - Condition: Database query error rate exceeds 1%
  - Duration: 20 minutes
  - Notification: Slack #database-info
  - Escalation: None

- **Connection Pool Utilization > 60%**
  - Condition: Database connection pool utilization exceeds 60%
  - Duration: 20 minutes
  - Notification: Slack #database-info
  - Escalation: None

## Edge Function Alerts

### Critical Alerts
- **Function Success Rate < 80%**
  - Condition: Edge function success rate drops below 80%
  - Duration: 5 minutes
  - Notification: PagerDuty, Slack #functions-critical
  - Escalation: Page after 5 minutes

- **Function Execution Timeout**
  - Condition: Edge function execution timeout rate > 10%
  - Duration: 5 minutes
  - Notification: PagerDuty, Slack #functions-critical
  - Escalation: Page after 5 minutes

### High Alerts
- **Function Success Rate < 90%**
  - Condition: Edge function success rate drops below 90%
  - Duration: 10 minutes
  - Notification: Slack #functions, email
  - Escalation: Page after 15 minutes

- **Function Duration > 10s**
  - Condition: Average edge function execution time exceeds 10 seconds
  - Duration: 10 minutes
  - Notification: Slack #functions, email
  - Escalation: Page after 15 minutes

- **Memory Usage > 500MB**
  - Condition: Edge function memory usage exceeds 500MB
  - Duration: 10 minutes
  - Notification: Slack #functions, email
  - Escalation: Page after 15 minutes

### Medium Alerts
- **Function Success Rate < 95%**
  - Condition: Edge function success rate drops below 95%
  - Duration: 15 minutes
  - Notification: Slack #functions
  - Escalation: Email after 30 minutes

- **Function Duration > 5s**
  - Condition: Average edge function execution time exceeds 5 seconds
  - Duration: 15 minutes
  - Notification: Slack #functions
  - Escalation: Email after 30 minutes

- **Memory Usage > 200MB**
  - Condition: Edge function memory usage exceeds 200MB
  - Duration: 15 minutes
  - Notification: Slack #functions
  - Escalation: Email after 30 minutes

### Low Alerts
- **Function Error Rate > 2%**
  - Condition: Edge function error rate exceeds 2%
  - Duration: 20 minutes
  - Notification: Slack #functions-info
  - Escalation: None

- **Slow Function Detected**
  - Condition: Single function execution time > 8s
  - Duration: 15 minutes
  - Notification: Slack #functions-info
  - Escalation: None

## Error Tracking Alerts

### Critical Alerts
- **Critical Error Spike**
  - Condition: Critical error count > 50 in 5 minutes
  - Duration: 5 minutes
  - Notification: PagerDuty, Slack #errors-critical
  - Escalation: Page after 5 minutes

- **Recurring Critical Error**
  - Condition: Same critical error occurs > 10 times in 1 hour
  - Duration: 1 hour
  - Notification: PagerDuty, Slack #errors-critical
  - Escalation: Page after 5 minutes

### High Alerts
- **Error Rate > 10%**
  - Condition: Overall error rate exceeds 10%
  - Duration: 10 minutes
  - Notification: Slack #errors, email
  - Escalation: Page after 15 minutes

- **High Severity Error Count > 20**
  - Condition: High severity error count > 20 in 10 minutes
  - Duration: 10 minutes
  - Notification: Slack #errors, email
  - Escalation: Page after 15 minutes

### Medium Alerts
- **Error Rate > 5%**
  - Condition: Overall error rate exceeds 5%
  - Duration: 15 minutes
  - Notification: Slack #errors
  - Escalation: Email after 30 minutes

- **Recurring Error Pattern**
  - Condition: Same error occurs > 5 times in 1 hour
  - Duration: 1 hour
  - Notification: Slack #errors
  - Escalation: Email after 30 minutes

### Low Alerts
- **Error Rate > 2%**
  - Condition: Overall error rate exceeds 2%
  - Duration: 20 minutes
  - Notification: Slack #errors-info
  - Escalation: None

- **New Error Type Detected**
  - Condition: New error type appears in system
  - Duration: Immediate
  - Notification: Slack #errors-info
  - Escalation: None

## User Journey Alerts

### Critical Alerts
- **Journey Completion Rate < 50%**
  - Condition: Overall journey completion rate drops below 50%
  - Duration: 15 minutes
  - Notification: PagerDuty, Slack #journey-critical
  - Escalation: Page after 10 minutes

### High Alerts
- **Payment Journey Completion Rate < 70%**
  - Condition: Payment journey completion rate drops below 70%
  - Duration: 15 minutes
  - Notification: Slack #journey, email
  - Escalation: Page after 20 minutes

- **Journey Abandonment Rate > 50%**
  - Condition: Journey abandonment rate exceeds 50%
  - Duration: 15 minutes
  - Notification: Slack #journey, email
  - Escalation: Page after 20 minutes

### Medium Alerts
- **Journey Completion Rate < 70%**
  - Condition: Overall journey completion rate drops below 70%
  - Duration: 20 minutes
  - Notification: Slack #journey
  - Escalation: Email after 30 minutes

- **Journey Duration > 10 minutes**
  - Condition: Average journey duration exceeds 10 minutes
  - Duration: 20 minutes
  - Notification: Slack #journey
  - Escalation: Email after 30 minutes

### Low Alerts
- **Journey Completion Rate < 85%**
  - Condition: Overall journey completion rate drops below 85%
  - Duration: 30 minutes
  - Notification: Slack #journey-info
  - Escalation: None

- **High Dropoff at Step**
  - Condition: Dropoff rate > 30% at any journey step
  - Duration: 30 minutes
  - Notification: Slack #journey-info
  - Escalation: None

## Alert Suppression Rules

### Maintenance Windows
- Suppress all non-critical alerts during scheduled maintenance windows
- Maintenance windows defined in system configuration
- Automatic suppression based on deployment events

### Known Issues
- Suppress alerts for known issues being addressed
- Manual suppression with reason and expiration
- Automatic suppression when issue is marked as known

### Rate Limiting
- Prevent alert fatigue by rate limiting similar alerts
- Maximum 1 alert per 5 minutes for same condition
- Aggregate similar alerts into single notification

### Dependency Suppression
- Suppress downstream alerts when upstream service is known to be down
- Automatic dependency mapping between services
- Cascading alert suppression

## Notification Channels

### PagerDuty
- Used for critical and high severity alerts
- On-call rotation configuration
- Escalation policies
- Integration with incident management

### Slack
- Different channels for different alert types
- #critical for critical alerts
- #alerts for high severity alerts
- #payments for payment-related alerts
- #api for API performance alerts
- #database for database alerts
- #functions for edge function alerts
- #errors for error tracking alerts
- #journey for user journey alerts
- #info for low severity alerts

### Email
- Used for high and medium severity alerts
- Team-specific distribution lists
- Detailed alert information included
- Attachment of relevant logs and metrics

### Webhooks
- Custom webhook integrations
- Third-party alert management systems
- Automated incident response triggers
- ChatOps integration

## Alert Escalation Policies

### Level 1: Initial Alert
- Send to primary notification channel
- Create incident ticket
- Log to incident management system

### Level 2: Escalation (5-15 minutes)
- Page on-call engineer
- Notify team lead
- Update incident severity

### Level 3: Escalation (15-30 minutes)
- Page engineering manager
- Notify product manager
- Escalate to critical status

### Level 4: Escalation (30+ minutes)
- Page CTO/VP Engineering
- Notify executive team
- Declare major incident

## Alert Testing and Validation

### Regular Testing
- Test alert rules weekly
- Validate notification channels monthly
- Test escalation policies quarterly
- Review alert effectiveness bi-annually

### Alert Tuning
- Adjust thresholds based on false positive rate
- Fine-tune duration windows
- Optimize notification channels
- Update suppression rules

### Performance Monitoring
- Track alert response times
- Monitor alert fatigue metrics
- Measure mean time to resolution
- Review alert effectiveness KPIs
