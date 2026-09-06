# Operational Runbooks

This directory contains operational runbooks for the CALQULUS RMS platform.

## Table of Contents

1. [Incident Response](#incident-response)
2. [Troubleshooting](#troubleshooting)
3. [Maintenance Tasks](#maintenance-tasks)

## Incident Response

### Severity Levels

| Level | Definition | Response Time | Example |
|-------|------------|--------------|---------|
| P1 | Complete outage | 15 min | Site down |
| P2 | Major feature broken | 1 hour | Payments failing |
| P3 | Minor feature broken | 4 hours | Reports slow |
| P4 | Cosmetic issue | 24 hours | UI glitch |

### Incident Response Process

1. **Detect**: Alert fires or user reports
2. **Triage**: Assess severity, create incident
3. **Communicate**: Notify stakeholders
4. **Investigate**: Find root cause
5. **Mitigate**: Apply fix or workaround
6. **Resolve**: Deploy permanent fix
7. **Review**: Post-mortem

## Troubleshooting

### Payment Issues

**Symptom**: M-Pesa payments failing

**Checks**:
1. Verify M-Pesa API credentials
2. Check Safaricom API status
3. Review edge function logs
4. Check callback URL accessibility

**Remediation**:
```bash
# Check edge function logs
npx supabase functions logs process-payment

# Test callback URL
curl -X POST https://your-domain/functions/v1/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Restart edge function
npx supabase functions deploy process-payment
```

### Database Issues

**Symptom**: Slow queries or connection errors

**Checks**:
1. Check Supabase dashboard
2. Review active connections
3. Check for long-running queries

**Remediation**:
```sql
-- Kill long-running query
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active' 
AND query_start < now() - interval '5 minutes';
```

### Authentication Issues

**Symptom**: Users cannot log in

**Checks**:
1. Verify Supabase Auth status
2. Check JWT secret hasn't rotated
3. Review RLS policies

**Remediation**:
```bash
# Test auth locally
npx supabase functions serve auth

# Verify JWT
echo $JWT | base64 -d
```

## Maintenance Tasks

### Daily Tasks

- [ ] Monitor payment success rate (>95%)
- [ ] Check error rates in Sentry
- [ ] Verify backup completion
- [ ] Review Grafana dashboards

### Weekly Tasks

- [ ] Run database vacuum
- [ ] Review and optimize slow queries
- [ ] Check disk space usage
- [ ] Update dependency audit

### Monthly Tasks

- [ ] Security audit
- [ ] Performance review
- [ ] Backup restoration test
- [ ] DR drill

## Runbook Index

| Runbook | Description |
|---------|-------------|
| [Payment Failures](./payment-failures.md) | M-Pesa and payment troubleshooting |
| [Database Anomalies](./database-anomalies.md) | Database issue resolution |
| [Security Incidents](./security-incidents.md) | Security breach response |
| [Performance Issues](./performance-issues.md) | Performance troubleshooting |

## Emergency Contacts

| Role | Contact |
|------|---------|
| Platform Lead | @themugo |
| DevOps | @platform-team |
| Supabase Support | support@supabase.io |
| Vercel Support | support@vercel.com |
