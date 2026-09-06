# Enterprise Operational Runbooks

## Table of Contents

1. [Incident Response](#1-incident-response)
2. [Disaster Recovery](#2-disaster-recovery)
3. [Performance Troubleshooting](#3-performance-troubleshooting)
4. [Security Incident Response](#4-security-incident-response)
5. [Compliance Operations](#5-compliance-operations)
6. [Deployment Procedures](#6-deployment-procedures)
7. [Database Operations](#7-database-operations)
8. [Monitoring & Alerting](#8-monitoring--alerting)

---

## 1. Incident Response

### 1.1 Incident Severity Classification

| Severity | Definition | Response Time | Example |
|----------|------------|----------------|---------|
| **SEV1** | Complete service outage | 15 minutes | Site unreachable, all payments failing |
| **SEV2** | Major feature broken | 1 hour | Login failures, payment processing down |
| **SEV3** | Minor feature degraded | 4 hours | Slow reports, occasional errors |
| **SEV4** | Cosmetic issue | 24 hours | UI glitches, non-critical bugs |

### 1.2 Incident Response Playbook

```bash
# Step 1: Acknowledge and Assess
1. Acknowledge incident in monitoring system
2. Assess impact and determine severity
3. Create incident ticket with:
   - Incident ID
   - Severity level
   - Initial symptoms
   - Time detected
   - Contact information

# Step 2: Assemble Response Team
For SEV1/SEV2:
- Incident Commander (IC)
- Technical Lead
- Communication Lead
- Executive Sponsor

For SEV3/SEV4:
- On-call engineer
- Team lead notification

# Step 3: Investigate
1. Check application logs: `npm run logs:app`
2. Check edge function logs: `supabase functions logs <name>`
3. Check database metrics: Supabase Dashboard → Metrics
4. Check CDN status: Vercel Dashboard
5. Review recent deployments: `git log --oneline -20`

# Step 4: Mitigate
1. If caused by recent deployment: `npm run rollback`
2. If database issue: Scale resources or restart
3. If third-party service: Implement failover
4. If unknown: Gather more data

# Step 5: Resolve
1. Deploy fix or workaround
2. Verify fix in staging
3. Deploy to production
4. Monitor for 30 minutes
5. Close incident ticket
```

### 1.3 Communication Templates

**Initial Notification:**
```
Subject: [SEV{level}] {service_name} - {brief_description}
Priority: {high/medium/low}
Status: Investigating
Impact: {describe_user_impact}
ETA: {estimated_time_to_resolve}
```

**Update:**
```
Subject: [SEV{level}] Update {time}
Status: {investigating/identified/mitigating}
Progress: {what_has_been_done}
Next Steps: {planned_actions}
ETA: {updated_estimate}
```

**Resolution:**
```
Subject: [SEV{level}] Resolved - {brief_description}
Status: Resolved
Duration: {total_time}
Root Cause: {brief_explanation}
Fix Applied: {what_was_done}
Follow-up: {any_pending_items}
```

---

## 2. Disaster Recovery

### 2.1 Recovery Time Objectives (RTO)

| Service | RTO | Priority |
|---------|-----|----------|
| Core API | 1 hour | Critical |
| Database | 4 hours | Critical |
| File Storage | 4 hours | High |
| Analytics | 24 hours | Medium |
| Backup Systems | 24 hours | Low |

### 2.2 Recovery Point Objectives (RPO)

| Data Type | RPO | Backup Frequency |
|-----------|-----|------------------|
| Financial Transactions | 5 minutes | Real-time replication |
| User Data | 15 minutes | Every 15 minutes |
| Application State | 1 hour | Hourly snapshots |
| Logs | 1 hour | Hourly archiving |

### 2.3 Database Failover Procedure

```bash
# 1. Verify current primary
supabase status

# 2. Initiate failover (if using read replica)
supabase db promote --db-name <database>

# 3. Update connection strings in .env
# Update SUPABASE_URL to point to new primary

# 4. Verify connectivity
psql $SUPABASE_URL -c "SELECT 1"

# 5. Check replication status
supabase db show-replication-status

# 6. Notify team
slack/email incident notification

# 7. Document incident
# Create post-mortem within 48 hours
```

### 2.4 Full System Recovery

```bash
# 1. Verify backup availability
supabase db list-backups

# 2. Create new instance
supabase db restore --backup-id <backup_id>

# 3. Restore to point in time
supabase db restore --backup-id <backup_id> --time "<timestamp>"

# 4. Verify data integrity
supabase db check-integrity

# 5. Restore application
git checkout <known-good-commit>
npm install
npm run build

# 6. Deploy
vercel --prod

# 7. Verify all services
npm run health-check
```

### 2.5 Backup Verification

```bash
# Run automated backup verification
npm run backup:verify

# Manual verification
supabase db backup:download --backup-id <id>
supabase db backup:verify --file <path>

# Check backup health
npm run backup:health-report
```

---

## 3. Performance Troubleshooting

### 3.1 Slow Query Analysis

```bash
# 1. Identify slow queries
supabase db show-slow-queries --limit 10

# 2. Explain query plan
psql $SUPABASE_URL -c "EXPLAIN ANALYZE <query>"

# 3. Check for missing indexes
supabase db check-indexes --table <table_name>

# 4. Add index if needed
psql $SUPABASE_URL -c "CREATE INDEX CONCURRENTLY idx_<table>_<column> ON <table>(<column>)"

# 5. Verify improvement
supabase db show-slow-queries --after <timestamp>
```

### 3.2 High Memory Usage

```bash
# Check current memory usage
supabase db show-memory

# Identify memory-heavy queries
supabase db show-top-memory-queries

# Kill long-running queries
psql $SUPABASE_URL -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
AND query_start < now() - interval '10 minutes'
AND pid <> pg_backend_pid();
"

# Restart connection pooler
supabase db restart-pooler
```

### 3.3 CDN Cache Issues

```bash
# Purge specific URL from cache
vercel cache purge <url>

# Purge entire cache
vercel cache purge --all

# Check cache hit rate
npm run metrics:cache-stats
```

---

## 4. Security Incident Response

### 4.1 Security Incident Classification

| Level | Description | Examples |
|-------|-------------|-----------|
| **P1** | Active breach | Data exfiltration, unauthorized access |
| **P2** | Suspected breach | Anomalous access patterns, failed attacks |
| **P3** | Vulnerability discovered | SQL injection, XSS vulnerability |
| **P4** | Security best practice violation | Weak passwords, exposed keys |

### 4.2 Data Breach Response

```bash
# 1. Isolate affected systems
vercel suspend <project>
supabase db disconnect-all

# 2. Preserve evidence
# Take snapshots of:
# - Application logs
# - Database state
# - Network traffic
# - System state

# 3. Identify scope
supabase db audit-log --user <affected_user>
git log --all --source --remotes
grep -r "suspicious_pattern" ./logs

# 4. Contain
# Reset affected credentials
supabase auth reset-user --user-id <id>

# Revoke compromised API keys
supabase api-keys revoke --key-id <id>

# 5. Notify (GDPR 72 hours requirement)
# Document breach details
# Notify supervisory authority
# Notify affected individuals

# 6. Recover
# Restore from clean backup
# Update compromised systems
# Enhanced monitoring
```

### 4.3 Unauthorized Access

```bash
# Check recent authentication events
supabase auth logs --user <email> --limit 50

# Revoke all sessions
supabase auth revoke-all --user-id <id>

# Force password reset
supabase auth force-password-reset --user-id <id>

# Enable enhanced logging
supabase db enable-audit-logging --user <id>

# Review and revoke suspicious API keys
supabase api-keys list --user <id>
supabase api-keys revoke --key-id <id>
```

---

## 5. Compliance Operations

### 5.1 GDPR Data Requests

```bash
# Subject Access Request (SAR)
supabase data-export --user-id <id> --request-type sar
# Output: Complete data export in JSON format

# Right to Erasure (Right to be Forgotten)
supabase data-erase --user-id <id>
# This will:
# - Anonymize PII in all tables
# - Delete stored files
# - Cancel active subscriptions
# - Generate deletion certificate

# Data Portability
supabase data-export --user-id <id> --format portable
# Output: Machine-readable format (JSON/XML)
```

### 5.2 Audit Log Retention

```bash
# Configure retention policies
supabase audit set-retention --days 2555  # 7 years for financial data

# Generate compliance report
supabase audit generate-report \
  --start-date 2024-01-01 \
  --end-date 2024-12-31 \
  --format pdf \
  --include pii-access \
  --include data-deletions

# Archive old logs
supabase audit archive --before 2024-01-01
```

### 5.3 Data Retention Enforcement

```bash
# Run retention policy enforcement
npm run retention:enforce

# Check pending deletions
npm run retention:pending

# Execute scheduled deletions
npm run retention:execute

# Generate deletion report
npm run retention:report
```

---

## 6. Deployment Procedures

### 6.1 Standard Deployment

```bash
# 1. Pre-deployment checks
npm run pre-deploy-checklist

# 2. Create deployment branch
git checkout -b release/v<version>
git merge main

# 3. Run tests
npm run test
npm run lint
npm run typecheck

# 4. Deploy to staging
vercel --environment preview
# Verify in staging environment

# 5. Run E2E tests
npx playwright test

# 6. Deploy to production
vercel --prod

# 7. Post-deployment verification
npm run health-check
npm run smoke-tests

# 8. Monitor for 30 minutes
watch npm run metrics
```

### 6.2 Emergency Deployment

```bash
# 1. Get approval (required for production)
# Notify: Slack #incidents, Engineering Lead

# 2. Deploy hotfix
git checkout <current-prod-commit>
git cherry-pick <fix-commit>
npm run build
vercel --prod --token $VERCEL_TOKEN

# 3. Verify
npm run health-check

# 4. Document
# Create incident ticket
# Schedule post-mortem
```

### 6.3 Rollback Procedure

```bash
# List recent deployments
vercel list --limit 10

# Rollback to previous deployment
vercel rollback <deployment-id>

# Rollback database migration (if applicable)
supabase db migrate:down --version <version>

# Verify rollback
npm run health-check
```

---

## 7. Database Operations

### 7.1 Connection Pool Management

```bash
# Check current connections
psql $SUPABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Check for connection leaks
psql $SUPABASE_URL -c "
SELECT pid, usename, application_name, state, query_start
FROM pg_stat_activity
WHERE state = 'idle in transaction'
AND query_start < now() - interval '5 minutes'
"

# Kill idle connections
psql $SUPABASE_URL -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '1 hour'
"
```

### 7.2 Index Management

```bash
# Find unused indexes
supabase db find-unused-indexes

# Analyze table
psql $SUPABASE_URL -c "ANALYZE VERBOSE <table_name>"

# Rebuild fragmented index
psql $SUPABASE_URL -c "REINDEX INDEX CONCURRENTLY <index_name>"

# Create new index
psql $SUPABASE_URL -c "
CREATE INDEX CONCURRENTLY idx_<table>_<column>
ON <table>(<column>)
WHERE <condition>  -- For partial indexes
"
```

### 7.3 Vacuum Operations

```bash
# Check table bloat
psql $SUPABASE_URL -c "
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)),
  n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;
"

# Run autovacuum (usually automatic)
# Manual vacuum for emergency
psql $SUPABASE_URL -c "VACUUM (VERBOSE, ANALYZE) <table_name>"

# Vacuum all tables
psql $SUPABASE_URL -c "VACUUM (VERBOSE, ANALYZE)"
```

---

## 8. Monitoring & Alerting

### 8.1 Key Metrics to Monitor

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | >1% | >5% | Check logs, rollback if needed |
| Response Time (p95) | >500ms | >1000ms | Check DB, scale resources |
| CPU Usage | >70% | >90% | Scale up, optimize queries |
| Memory Usage | >80% | >95% | Restart services, scale |
| Disk Usage | >70% | >85% | Clean up, expand storage |
| Connection Pool | >80% | >95% | Optimize connections |

### 8.2 Alert Response Playbook

```bash
# Check alert details
npm run alert:details --alert-id <id>

# Check related metrics
npm run metrics:correlation --alert-id <id>

# Acknowledge alert
npm run alert:ack --alert-id <id>

# Investigate
# 1. Check logs: npm run logs:app --since "30 minutes ago"
# 2. Check traces: npm run traces:recent
# 3. Check metrics: npm run metrics:dashboard

# Resolve
npm run alert:resolve --alert-id <id> --comment "<action taken>"
```

### 8.3 On-Call Checklist

**Before On-Call Shift:**
- [ ] Confirm PagerDuty accessibility
- [ ] Check dashboard access
- [ ] Verify Runbook access
- [ ] Test alert notifications
- [ ] Check team contact info

**During On-Call:**
- [ ] Acknowledge all alerts within 5 minutes
- [ ] Update status page for customer-visible issues
- [ ] Escalate if unable to resolve within SLA

**After On-Call Shift:**
- [ ] Handoff to next on-call
- [ ] Document any ongoing issues
- [ ] Update runbooks with lessons learned

---

## Appendix: Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Engineering Lead | [See PagerDuty] | 24/7 |
| DevOps Lead | [See PagerDuty] | 24/7 |
| Security Team | security@calqulus.com | Business hours |
| Supabase Support | [Dashboard → Support] | 24/7 for Enterprise |
| Vercel Support | [Dashboard → Support] | 24/7 |

## Appendix: Useful Commands

```bash
# Health check
npm run health-check

# Full system status
npm run system:status

# Logs
npm run logs:app
npm run logs:error

# Metrics
npm run metrics:dashboard
npm run metrics:export

# Database
supabase db status
supabase db backup:list

# Deployment
vercel list
vercel rollback <id>
vercel inspect <id>
```

---

*Last Updated: July 2026*
*Document Owner: Platform Engineering*
*Review Frequency: Quarterly*
