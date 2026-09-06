# Incident Response Runbook: Security Incidents

## Severity Levels
- **P1 - Critical**: Active breach, data exfiltration, or system compromise
- **P2 - High**: Suspicious activity, potential breach, or unauthorized access
- **P3 - Medium**: Security vulnerability or misconfiguration
- **P4 - Low**: Minor security issue or policy violation

## Detection
- **Alert**: Suspicious login attempts, MFA bypass attempts, unusual activity patterns
- **Dashboard**: Security Monitoring Dashboard
- **Logs**: Auth logs, access logs, security event logs
- **Sentry**: Security events, suspicious login tracking

## Immediate Actions (First 15 Minutes)

### 1. Verify Impact
- Check Grafana dashboard for security alerts
- Review recent login attempts
- Check for unusual activity patterns
- Verify data integrity

### 2. Notify Stakeholders
- **P1/P2**: Page on-call engineer, notify CTO, security team, legal
- **P3/P4**: Slack message to engineering team
- Update status page if public-facing

### 3. Initial Triage
```bash
# Check recent failed login attempts
psql -h aelzsqxllkypbzslxyju.supabase.co -U postgres -d postgres -c "SELECT * FROM auth.audit_log WHERE action LIKE '%login%' ORDER BY created_at DESC LIMIT 50"

# Check for unusual IP patterns
psql -h aelzsqxllkypbzslxyju.supabase.co -U postgres -d postgres -c "SELECT ip_address, count(*) FROM auth.audit_log GROUP BY ip_address HAVING count(*) > 10 ORDER BY count(*) DESC"

# Check MFA bypass attempts
psql -h aelzsqxllkypbzslxyju.supabase.co -U postgres -d postgres -c "SELECT * FROM user_mfa_secrets WHERE enabled = true ORDER BY updated_at DESC"
```

## Investigation Steps

### Suspicious Login Attempts
1. **Identify Affected Accounts**
   ```sql
   SELECT user_id, email, ip_address, user_agent, created_at
   FROM auth.audit_log
   WHERE action LIKE '%login%' AND success = false
   ORDER BY created_at DESC
   LIMIT 100;
   ```

2. **Check Geographic Patterns**
   - Review IP geolocation data
   - Identify logins from unusual locations
   - Check for concurrent logins from different IPs

3. **Review Device Fingerprints**
   ```sql
   SELECT device_identifier, count(*), last_used_at
   FROM user_devices
   GROUP BY device_identifier
   HAVING count(*) > 5
   ORDER BY last_used_at DESC;
   ```

### MFA Bypass Attempts
1. **Check MFA Verification Logs**
   ```sql
   SELECT * FROM user_mfa_secrets
   WHERE enabled = true
   ORDER BY updated_at DESC;
   ```

2. **Review Backup Code Usage**
   ```sql
   SELECT user_id, backup_codes, updated_at
   FROM user_mfa_secrets
   WHERE array_length(backup_codes, 1) < 10;
   ```

3. **Check for Repeated Failed MFA Attempts**
   ```sql
   SELECT user_id, count(*)
   FROM auth.audit_log
   WHERE action LIKE '%mfa%' AND success = false
   GROUP BY user_id
   HAVING count(*) > 5;
   ```

### Data Access Anomalies
1. **Check for Unusual Data Access**
   ```sql
   SELECT user_id, table_name, action, count(*)
   FROM activity_logs
   WHERE action IN ('SELECT', 'UPDATE', 'DELETE')
   GROUP BY user_id, table_name, action
   HAVING count(*) > 1000
   ORDER BY count(*) DESC;
   ```

2. **Review PII Access**
   ```sql
   SELECT user_id, table_name, action, created_at
   FROM activity_logs
   WHERE table_name IN ('tenants', 'payment_transactions', 'invoices')
   AND action IN ('SELECT', 'UPDATE')
   ORDER BY created_at DESC
   LIMIT 100;
   ```

## Resolution Steps

### Common Issues

#### Issue: Brute Force Attack
**Symptoms**: High rate of failed login attempts from same IP
**Resolution**:
1. Block offending IPs:
   ```sql
   INSERT INTO blocked_ips (ip_address, reason, blocked_at, blocked_until)
   VALUES ('192.168.1.100', 'Brute force attack', NOW(), NOW() + interval '24 hours');
   ```

2. Implement rate limiting on login endpoint
3. Enable CAPTCHA for suspicious IPs
4. Require MFA for all accounts
5. Notify affected users

#### Issue: Credential Stuffing
**Symptoms**: Failed login attempts using valid usernames with wrong passwords
**Resolution**:
1. Identify affected accounts
2. Force password reset for affected users
3. Enable MFA requirement
4. Review password policy
5. Implement credential breach monitoring

#### Issue: Unauthorized Access
**Symptoms**: Successful login from unusual location/device
**Resolution**:
1. Revoke suspicious sessions:
   ```sql
   DELETE FROM user_sessions
   WHERE user_id = 'affected-user-id'
   AND ip_address = 'suspicious-ip';
   ```

2. Force MFA re-verification
3. Notify user of suspicious activity
4. Review access logs for data exfiltration
5. Change compromised credentials

#### Issue: Data Exfiltration
**Symptoms**: Unusually large data exports or downloads
**Resolution**:
1. Identify affected data
2. Review audit logs for data access
3. Check for unauthorized API access
4. Notify legal and compliance teams
5. Implement data export restrictions

## Escalation Path

### Level 1: On-Call Engineer
- First 30 minutes of incident
- Can block IPs, revoke sessions
- Escalates to Level 2 if unresolved

### Level 2: Senior Engineer / Security Team
- Called after 30 minutes or for complex issues
- Can implement security measures
- Escalates to Level 3 if critical

### Level 3: CTO / Engineering Manager / Legal
- Called for P1 incidents or after 1 hour
- Can authorize emergency measures
- Coordinates with external parties

## Prevention Measures

### Access Control
- Enforce MFA for all accounts
- Implement role-based access control (RBAC)
- Regular access reviews
- Principle of least privilege

### Monitoring
- Set up alerts for:
  - Failed login attempts > 10 per minute
  - MFA bypass attempts
  - Unusual geographic access
  - Data export anomalies

### Security Best Practices
- Regular security audits
- Penetration testing
- Vulnerability scanning
- Security awareness training

### Data Protection
- Encrypt sensitive data at rest
- Encrypt data in transit
- Implement data loss prevention (DLP)
- Regular backups with encryption

## Post-Incident Actions

### 1. Root Cause Analysis (RCA)
- Document timeline of incident
- Identify root cause
- Document resolution steps
- Create action items to prevent recurrence

### 2. Communication
- Notify affected users
- Update status page if public-facing
- Send post-mortem to stakeholders
- Report to regulatory bodies if required

### 3. Security Updates
- Patch vulnerabilities
- Update security configurations
- Improve monitoring
- Update runbook based on learnings

### 4. Process Improvements
- Update security policies
- Add additional security controls
- Improve documentation
- Conduct security training

## Related Resources
- Supabase Security: https://app.supabase.com/project/aelzsqxllkypbzslxyju/auth/policies
- Grafana Dashboards:
  - Security Monitoring: https://grafana.calqulusrms.com/d/security-monitoring
  - Application Performance: https://grafana.calqulusrms.com/d/app-performance
- Sentry: https://sentry.io/organizations/calqulusrms/
- Status Page: https://status.calqulusrms.com
