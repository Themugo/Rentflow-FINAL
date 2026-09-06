# Incident Response Runbook: Payment Failures

## Severity Levels
- **P1 - Critical**: Payment processing completely down, affecting all users
- **P2 - High**: Payment processing degraded, affecting >50% of users
- **P3 - Medium**: Payment processing degraded, affecting <50% of users
- **P4 - Low**: Isolated payment failures

## Detection
- **Alert**: Payment failure rate > 5% for 5 minutes
- **Dashboard**: CALQULUS RMS Payment Monitoring
- **Logs**: Supabase logs, payment provider dashboards
- **Sentry**: Payment failure events

## Immediate Actions (First 15 Minutes)

### 1. Verify Impact
- Check Grafana dashboard for payment failure rate
- Verify payment provider status (M-Pesa, Stripe, Bank)
- Check Supabase database connectivity
- Review Sentry for recent payment errors

### 2. Notify Stakeholders
- **P1/P2**: Page on-call engineer, notify CTO, product lead
- **P3/P4**: Slack message to engineering team
- Update status page if public-facing

### 3. Initial Triage
```bash
# Check payment provider status
curl -I https://api.safaricom.co.ke/mpesa/healthcheck
curl -I https://api.stripe.com/v1/health

# Check database connectivity
psql -h aelzsqxllkypbzslxyju.supabase.co -U postgres -d postgres -c "SELECT 1"

# Check application logs
supabase logs --project-id aelzsqxllkypbzslxyju
```

## Investigation Steps

### M-Pesa Payment Failures
1. **Check Daraja API Status**
   - Visit https://developer.safaricom.co.ke/
   - Check status page for API outages

2. **Verify Callback URL**
   - Ensure callback URL is accessible: `https://www.calqulus.site/api/payments/mpesa/callback`
   - Check SSL certificate validity
   - Verify firewall rules allow Safaricom IPs

3. **Check Credentials**
   - Verify M-Pesa consumer key and secret are valid
   - Check passkeys are correct for environment (sandbox vs production)

4. **Review Recent Changes**
   - Check recent deployments to Supabase Edge Functions
   - Review changes to payment processing code

### Stripe Payment Failures
1. **Check Stripe Status**
   - Visit https://status.stripe.com/
   - Review incident history

2. **Verify Webhook Configuration**
   - Ensure webhook endpoint is accessible
   - Check webhook signing secret matches
   - Review webhook delivery logs in Stripe dashboard

3. **Check API Keys**
   - Verify Stripe API keys are valid
   - Check for rate limiting

### Bank Transfer Failures
1. **Check Bank Integration**
   - Verify bank API status
   - Check for maintenance windows

2. **Review Transaction Logs**
   - Check for failed transactions in database
   - Review error messages

## Resolution Steps

### Common Issues

#### Issue: Callback URL Not Reachable
**Symptoms**: Payment initiated but callback not received
**Resolution**:
1. Check callback URL accessibility from external network
2. Verify SSL certificate is valid
3. Check firewall rules allow payment provider IPs
4. Test callback endpoint manually:
```bash
curl -X POST https://www.calqulus.site/api/payments/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

#### Issue: Invalid Credentials
**Symptoms**: 401 Unauthorized errors
**Resolution**:
1. Verify credentials in environment variables
2. Regenerate credentials if expired
3. Update Supabase Edge Function secrets
4. Restart Edge Functions

#### Issue: Database Connection Issues
**Symptoms**: Payment data not being saved
**Resolution**:
1. Check database connection pool status
2. Verify database is not in maintenance mode
3. Check for long-running queries blocking writes
4. Restart application if connection pool exhausted

#### Issue: Timeout Errors
**Symptoms**: Payment processing timing out
**Resolution**:
1. Increase timeout values in payment processing code
2. Check network latency to payment providers
3. Implement retry logic with exponential backoff
4. Add queue for processing payments asynchronously

## Escalation Path

### Level 1: On-Call Engineer
- First 30 minutes of incident
- Can resolve common issues
- Escalates to Level 2 if unresolved

### Level 2: Senior Engineer / Tech Lead
- Called after 30 minutes or for complex issues
- Can make architectural decisions
- Escalates to Level 3 if critical

### Level 3: CTO / Engineering Manager
- Called for P1 incidents or after 1 hour
- Can authorize emergency changes
- Coordinates with external vendors

## Post-Incident Actions

### 1. Root Cause Analysis (RCA)
- Document timeline of incident
- Identify root cause
- Document resolution steps
- Create action items to prevent recurrence

### 2. Communication
- Update status page
- Send post-mortem to stakeholders
- Share learnings with team

### 3. Monitoring Updates
- Add new alerts if needed
- Update dashboards
- Improve runbook based on learnings

### 4. Process Improvements
- Update deployment procedures
- Add additional testing
- Improve documentation

## Related Resources
- Payment Provider Status Pages:
  - M-Pesa: https://developer.safaricom.co.ke/
  - Stripe: https://status.stripe.com/
- Grafana Dashboards:
  - Payment Monitoring: https://grafana.calqulusrms.com/d/payment-monitoring
  - Application Performance: https://grafana.calqulusrms.com/d/app-performance
- Sentry: https://sentry.io/organizations/calqulusrms/
- Status Page: https://status.calqulusrms.com
