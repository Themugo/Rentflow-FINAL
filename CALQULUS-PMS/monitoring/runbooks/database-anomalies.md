# Incident Response Runbook: Database Anomalies

## Severity Levels
- **P1 - Critical**: Database completely down, affecting all operations
- **P2 - High**: Database severely degraded, affecting >50% of operations
- **P3 - Medium**: Database degraded, affecting <50% of operations
- **P4 - Low**: Slow queries or minor performance issues

## Detection
- **Alert**: Database connection pool > 90%, slow queries > 1s, deadlocks detected
- **Dashboard**: CALQULUS RMS Database Performance
- **Logs**: Supabase logs, query performance logs
- **Sentry**: Database anomaly events

## Immediate Actions (First 15 Minutes)

### 1. Verify Impact
- Check Grafana dashboard for database performance
- Verify Supabase status page
- Check connection pool usage
- Review active query count

### 2. Notify Stakeholders
- **P1/P2**: Page on-call engineer, notify CTO, database team
- **P3/P4**: Slack message to engineering team
- Update status page if public-facing

### 3. Initial Triage
```bash
# Check database connectivity
psql -h aelzsqxllkypbzslxyju.supabase.co -U postgres -d postgres -c "SELECT 1"

# Check connection pool
psql -h aelzsqxllkypbzslxyju.supabase.co -U postgres -d postgres -c "SELECT count(*) FROM pg_stat_activity"

# Check long-running queries
psql -h aelzsqxllkypbzslxyju.supabase.co -U postgres -d postgres -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'"

# Check for locks
psql -h aelzsqxllkypbzslxyju.supabase.co -U postgres -d postgres -c "SELECT * FROM pg_locks WHERE NOT granted"
```

## Investigation Steps

### Connection Pool Exhaustion
1. **Check Active Connections**
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```

2. **Identify Long-Running Queries**
   ```sql
   SELECT pid, now() - query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY duration DESC
   LIMIT 10;
   ```

3. **Check for Idle Connections**
   ```sql
   SELECT count(*)
   FROM pg_stat_activity
   WHERE state = 'idle';
   ```

### Slow Queries
1. **Enable Query Logging** (if not already enabled)
   ```sql
   ALTER SYSTEM SET log_min_duration_statement = 1000;
   ```

2. **Review pg_stat_statements**
   ```sql
   SELECT query, calls, total_time, mean_time, max_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 20;
   ```

3. **Check Missing Indexes**
   ```sql
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public'
   ORDER BY n_distinct DESC;
   ```

### Deadlocks
1. **Check for Deadlocks**
   ```sql
   SELECT * FROM pg_stat_database_deadlocks;
   ```

2. **Review Lock Information**
   ```sql
   SELECT l.locktype, l.relation::regclass, l.mode, l.pid
   FROM pg_locks l
   JOIN pg_stat_activity a ON l.pid = a.pid
   WHERE NOT l.granted;
   ```

## Resolution Steps

### Common Issues

#### Issue: Connection Pool Exhaustion
**Symptoms**: "Too many connections" errors, connection pool > 90%
**Resolution**:
1. Kill idle connections:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
   AND state_change < now() - interval '5 minutes';
   ```

2. Increase connection pool size in application
3. Implement connection pooling (PgBouncer)
4. Add connection timeout settings

#### Issue: Slow Queries
**Symptoms**: Queries taking > 1s, high CPU usage
**Resolution**:
1. Add appropriate indexes:
   ```sql
   CREATE INDEX CONCURRENTLY idx_table_column ON table(column);
   ```

2. Optimize query execution plans
3. Partition large tables
4. Consider materialized views for complex queries
5. Update statistics:
   ```sql
   ANALYZE table_name;
   ```

#### Issue: Deadlocks
**Symptoms**: Transactions failing with deadlock errors
**Resolution**:
1. Identify deadlocked transactions and kill them:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE pid IN (SELECT pid FROM pg_locks WHERE NOT granted);
   ```

2. Review application code for lock ordering issues
3. Add appropriate indexes to reduce lock duration
4. Implement retry logic with exponential backoff
5. Consider SERIALIZABLE isolation level for critical transactions

#### Issue: High CPU Usage
**Symptoms**: Database CPU > 80%, slow response times
**Resolution**:
1. Identify CPU-intensive queries:
   ```sql
   SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   ORDER BY total_time DESC
   LIMIT 10;
   ```

2. Add query result caching
3. Optimize complex queries
4. Consider read replicas for read-heavy workloads
5. Scale up database instance if needed

## Escalation Path

### Level 1: On-Call Engineer
- First 30 minutes of incident
- Can resolve common issues
- Escalates to Level 2 if unresolved

### Level 2: Senior Engineer / Database Team
- Called after 30 minutes or for complex issues
- Can make database configuration changes
- Escalates to Level 3 if critical

### Level 3: CTO / Engineering Manager
- Called for P1 incidents or after 1 hour
- Can authorize emergency scaling
- Coordinates with Supabase support

## Prevention Measures

### Regular Maintenance
- Weekly: Review slow query logs
- Monthly: Update statistics, analyze index usage
- Quarterly: Review connection pool configuration

### Monitoring
- Set up alerts for:
  - Connection pool > 80%
  - Query duration > 1s
  - Deadlock rate > 0.1%
  - CPU usage > 80%

### Performance Optimization
- Implement query result caching
- Use connection pooling (PgBouncer)
- Regular index maintenance
- Partition large tables
- Optimize complex queries

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
- Update database maintenance procedures
- Add additional monitoring
- Improve documentation

## Related Resources
- Supabase Status: https://status.supabase.com/
- Supabase Dashboard: https://app.supabase.com/project/aelzsqxllkypbzslxyju
- Grafana Dashboards:
  - Database Performance: https://grafana.calqulusrms.com/d/database-performance
  - Application Performance: https://grafana.calqulusrms.com/d/app-performance
- Sentry: https://sentry.io/organizations/calqulusrms/
- Status Page: https://status.calqulusrms.com
