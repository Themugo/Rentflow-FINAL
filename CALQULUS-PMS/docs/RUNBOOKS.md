# Runbooks for Common Issues

This document provides runbooks for common operational issues in CALQULUS PMS, including troubleshooting steps, resolution procedures, and prevention measures.

## Table of Contents
- [Payment Failures](#payment-failures)
- [API Performance Degradation](#api-performance-degradation)
- [Database Performance Issues](#database-performance-issues)
- [Edge Function Failures](#edge-function-failures)
- [High Error Rates](#high-error-rates)
- [User Journey Dropoffs](#user-journey-dropoffs)
- [Service Outages](#service-outages)

---

## Payment Failures

### Symptoms
- Payment success rate drops below 90%
- High callback failure rate
- Payment timeout rate increases
- Users reporting payment failures

### Initial Assessment
1. Check payment dashboard for current success rate
2. Review recent payment failures in error tracking
3. Check Paystack API status page
4. Review recent deployments or configuration changes

### Troubleshooting Steps

#### Step 1: Verify Paystack API Status
- Check Paystack status page: https://status.paystack.co/
- Verify API credentials are valid
- Test API connectivity with simple request
- Check for rate limiting or quota issues

#### Step 2: Review Payment Configuration
- Verify Paystack API keys in environment variables
- Check callback URL configuration
- Verify webhook signature validation
- Review payment timeout settings

#### Step 3: Analyze Failure Patterns
- Group failures by error type
- Check for common failure reasons
- Identify affected payment methods
- Review failure correlation with specific users or properties

#### Step 4: Check Callback Handling
- Verify callback endpoint is accessible
- Check callback logs for errors
- Test callback URL with webhook tester
- Verify callback signature validation logic

#### Step 5: Review Recent Changes
- Check recent code deployments
- Review configuration changes
- Check for database schema changes
- Verify environment variable updates

### Resolution Procedures

#### Paystack API Issues
- If Paystack API is down: Monitor status page, notify users, implement retry logic
- If API credentials invalid: Rotate keys in environment variables
- If rate limiting: Implement exponential backoff, contact Paystack support

#### Callback Issues
- If callback URL not accessible: Check DNS, SSL certificate, firewall rules
- If callback signature validation failing: Verify signature logic, check for encoding issues
- If callback timeout: Increase timeout duration, optimize callback processing

#### Configuration Issues
- If environment variables missing: Update Supabase secrets
- If timeout settings too aggressive: Increase timeout values
- If webhook configuration incorrect: Update Paystack webhook settings

### Prevention Measures
- Implement retry logic with exponential backoff
- Set up monitoring for Paystack API status
- Regular testing of payment flow in staging
- Implement circuit breaker pattern for external API calls
- Maintain up-to-date API credentials rotation schedule

### Escalation
- If payment success rate < 80% for > 15 minutes: Page on-call engineer
- If Paystack API outage: Notify product team, communicate with users
- If callback issues persist > 30 minutes: Escalate to engineering manager

---

## API Performance Degradation

### Symptoms
- API latency increases above 1s
- API success rate drops below 95%
- Slow response times for specific endpoints
- Timeouts in client applications

### Initial Assessment
1. Check API performance dashboard
2. Identify which endpoints are affected
3. Check recent traffic patterns
4. Review system resource utilization

### Troubleshooting Steps

#### Step 1: Identify Affected Endpoints
- Check API latency by endpoint
- Group by HTTP method and path
- Identify slowest endpoints
- Check for correlation with specific services

#### Step 2: Analyze Traffic Patterns
- Check for traffic spikes
- Review request rate trends
- Identify unusual request patterns
- Check for DDoS indicators

#### Step 3: Review External Dependencies
- Check Paystack API performance
- Check Supabase API performance
- Check third-party service status
- Test external API connectivity

#### Step 4: Check System Resources
- Review CPU utilization
- Check memory usage
- Monitor network bandwidth
- Check disk I/O performance

#### Step 5: Review Recent Changes
- Check recent code deployments
- Review database schema changes
- Check configuration updates
- Review dependency updates

### Resolution Procedures

#### High Traffic Volume
- Implement rate limiting
- Scale up edge function resources
- Enable caching where appropriate
- Implement request queuing

#### External API Issues
- Implement circuit breaker pattern
- Add retry logic with exponential backoff
- Cache external API responses
- Implement fallback mechanisms

#### Database Performance
- Optimize slow queries
- Add database indexes
- Implement connection pooling
- Scale database resources

#### Resource Constraints
- Scale up edge function memory
- Increase CPU allocation
- Optimize code for better performance
- Implement request batching

### Prevention Measures
- Implement API rate limiting
- Set up performance monitoring
- Regular load testing
- Implement caching strategies
- Maintain capacity planning

### Escalation
- If API latency > 5s for > 10 minutes: Page on-call engineer
- If success rate < 90% for > 15 minutes: Page on-call engineer
- If external API outage: Notify vendors, implement fallbacks

---

## Database Performance Issues

### Symptoms
- Database query latency increases above 200ms
- Database success rate drops below 95%
- Connection pool exhaustion
- Slow query warnings in logs

### Initial Assessment
1. Check database performance dashboard
2. Review slow query logs
3. Check connection pool utilization
4. Review recent query patterns

### Troubleshooting Steps

#### Step 1: Identify Slow Queries
- Review slow query logs
- Group by table and operation
- Identify most frequent slow queries
- Check query execution plans

#### Step 2: Check Connection Pool
- Review connection pool utilization
- Check for connection leaks
- Review connection timeout settings
- Monitor connection churn

#### Step 3: Analyze Query Patterns
- Review query frequency by table
- Check for N+1 query patterns
- Identify missing indexes
- Review query complexity

#### Step 4: Check Database Resources
- Review CPU utilization
- Check memory usage
- Monitor disk I/O
- Review storage capacity

#### Step 5: Review Recent Changes
- Check recent schema migrations
- Review data volume changes
- Check for large table operations
- Review RLS policy changes

### Resolution Procedures

#### Slow Query Optimization
- Add appropriate indexes
- Rewrite inefficient queries
- Implement query result caching
- Use materialized views for complex queries

#### Connection Pool Issues
- Increase connection pool size
- Fix connection leaks in code
- Implement connection timeout
- Review connection reuse patterns

#### Resource Constraints
- Scale database resources
- Optimize query performance
- Implement read replicas
- Archive old data

#### Schema Issues
- Review and optimize RLS policies
- Remove unused indexes
- Rebuild fragmented indexes
- Update statistics

### Prevention Measures
- Regular query performance reviews
- Index maintenance schedule
- Connection pool monitoring
- Query optimization during development
- Load testing for new features

### Escalation
- If database latency > 1s for > 10 minutes: Page on-call engineer
- If connection pool exhausted: Page on-call engineer immediately
- If database unavailable: Page on-call engineer, notify database team

---

## Edge Function Failures

### Symptoms
- Edge function success rate drops below 90%
- Function execution timeouts
- High memory usage
- Function cold start delays

### Initial Assessment
1. Check edge function dashboard
2. Identify which functions are failing
3. Review function execution logs
4. Check resource utilization

### Troubleshooting Steps

#### Step 1: Identify Failing Functions
- Group failures by function name
- Check failure patterns by function
- Identify most frequently failing functions
- Review error messages

#### Step 2: Analyze Resource Usage
- Check memory usage per function
- Review CPU utilization
- Monitor execution duration
- Check for memory leaks

#### Step 3: Review Recent Deployments
- Check recent function deployments
- Review dependency updates
- Check configuration changes
- Review environment variable updates

#### Step 4: Test Function Locally
- Reproduce issue locally
- Test with sample data
- Review function logic
- Check for infinite loops

#### Step 5: Check External Dependencies
- Verify external API connectivity
- Check database connectivity
- Review timeout settings
- Test dependency availability

### Resolution Procedures

#### Memory Issues
- Optimize memory usage
- Increase function memory limit
- Implement memory cleanup
- Process data in chunks

#### Timeout Issues
- Optimize function logic
- Increase timeout duration
- Implement async processing
- Use background tasks

#### Dependency Issues
- Implement retry logic
- Add circuit breakers
- Cache external API responses
- Implement fallback mechanisms

#### Code Issues
- Fix bugs in function logic
- Add error handling
- Implement input validation
- Add logging for debugging

### Prevention Measures
- Regular function testing
- Load testing for functions
- Resource monitoring
- Code review for performance
- Implement canary deployments

### Escalation
- If function failure rate > 20%: Page on-call engineer
- If function memory exhausted: Page on-call engineer immediately
- If multiple functions failing: Page engineering manager

---

## High Error Rates

### Symptoms
- Overall error rate increases above 5%
- Critical error spikes
- Recurring error patterns
- Error rate correlated with specific features

### Initial Assessment
1. Check error tracking dashboard
2. Identify error types and severity
3. Review error patterns
4. Check correlation with deployments

### Troubleshooting Steps

#### Step 1: Categorize Errors
- Group errors by type
- Identify critical errors
- Check for recurring patterns
- Review error frequency

#### Step 2: Analyze Error Context
- Review error messages
- Check correlation with user actions
- Identify affected features
- Review error stack traces

#### Step 3: Check Recent Changes
- Review recent deployments
- Check configuration changes
- Review dependency updates
- Check for data issues

#### Step 4: Reproduce Errors
- Attempt to reproduce in staging
- Test with sample data
- Review error conditions
- Identify root cause

#### Step 5: Implement Temporary Mitigation
- Add error handling
- Implement fallback logic
- Disable affected features
- Add monitoring

### Resolution Procedures

#### Code Bugs
- Fix identified bugs
- Add comprehensive tests
- Implement error handling
- Deploy fix to production

#### Configuration Issues
- Update configuration
- Fix environment variables
- Update feature flags
- Deploy configuration changes

#### Data Issues
- Fix data inconsistencies
- Add data validation
- Implement data cleanup
- Update data migration scripts

#### External Service Issues
- Implement retry logic
- Add circuit breakers
- Update service integration
- Implement fallback mechanisms

### Prevention Measures
- Comprehensive error handling
- Input validation
- Code review process
- Testing before deployment
- Monitoring and alerting

### Escalation
- If critical error rate > 10%: Page on-call engineer
- If recurring critical error: Page engineering manager
- If error rate > 20%: Declare incident, page all engineers

---

## User Journey Dropoffs

### Symptoms
- Journey completion rate drops below 70%
- High abandonment rate at specific steps
- Long journey durations
- User complaints about process

### Initial Assessment
1. Check user journey dashboard
2. Identify dropoff points
3. Review journey duration
4. Analyze user feedback

### Troubleshooting Steps

#### Step 1: Identify Dropoff Points
- Review conversion funnel
- Identify steps with high dropoff
- Analyze dropoff reasons
- Check for technical issues

#### Step 2: Analyze User Behavior
- Review user session recordings
- Check for user confusion points
- Analyze user feedback
- Review user support tickets

#### Step 3: Check Technical Issues
- Test journey flow end-to-end
- Check for errors at dropoff points
- Review performance at each step
- Check for validation issues

#### Step 4: Review UX Design
- Evaluate user interface
- Check for confusing elements
- Review form validation
- Check for missing information

#### Step 5: Analyze Journey Duration
- Review time per step
- Identify slow steps
- Check for unnecessary steps
- Review process complexity

### Resolution Procedures

#### Technical Issues
- Fix bugs causing dropoffs
- Improve performance
- Fix validation issues
- Improve error messages

#### UX Issues
- Simplify user interface
- Improve form design
- Add progress indicators
- Improve user guidance

#### Process Issues
- Remove unnecessary steps
- Simplify required fields
- Improve error handling
- Add skip options

#### Performance Issues
- Optimize page load times
- Improve API performance
- Implement caching
- Optimize database queries

### Prevention Measures
- Regular UX testing
- User feedback collection
- A/B testing for improvements
- Performance monitoring
- Journey analytics review

### Escalation
- If completion rate < 50%: Page product manager
- If dropoff at critical step: Page engineering team
- If user complaints increase: Page support team

---

## Service Outages

### Symptoms
- Complete service unavailability
- Multiple components failing
- System-wide errors
- Users unable to access service

### Initial Assessment
1. Check system health dashboard
2. Identify affected components
3. Check error rates across all services
4. Review incident severity

### Troubleshooting Steps

#### Step 1: Assess Impact
- Determine scope of outage
- Identify affected users
- Check business impact
- Assess revenue impact

#### Step 2: Identify Root Cause
- Review system logs
- Check monitoring dashboards
- Review recent changes
- Check external dependencies

#### Step 3: Implement Temporary Mitigation
- Implement failover if available
- Disable affected features
- Show maintenance page
- Communicate with users

#### Step 4: Restore Service
- Fix identified issues
- Deploy fixes
- Test restoration
- Monitor for stability

#### Step 5: Verify Recovery
- Test all affected services
- Monitor error rates
- Check performance metrics
- Verify user access

### Resolution Procedures

#### Infrastructure Issues
- Restart affected services
- Scale up resources
- Fix network issues
- Replace failed components

#### Code Issues
- Rollback recent deployment
- Deploy hotfix
- Fix identified bugs
- Test thoroughly

#### Database Issues
- Restart database service
- Restore from backup if needed
- Fix corrupted data
- Scale database resources

#### External Service Issues
- Implement fallback mechanisms
- Use alternative services
- Cache responses
- Communicate with vendors

### Prevention Measures
- High availability architecture
- Disaster recovery planning
- Regular backup testing
- Load balancing
- Monitoring and alerting

### Escalation
- Complete outage: Page all engineers immediately
- Partial outage: Page on-call engineer
- Degraded service: Page engineering manager
- External service outage: Notify vendors, implement fallbacks

---

## Runbook Maintenance

### Regular Review
- Review runbooks monthly
- Update based on incident learnings
- Add new runbooks for new issues
- Remove outdated procedures

### Testing
- Test runbook procedures quarterly
- Validate escalation paths
- Test notification channels
- Verify contact information

### Documentation
- Keep runbooks up to date
- Add lessons learned
- Update contact information
- Document known issues

### Training
- Train team on runbook usage
- Conduct incident response drills
- Review runbooks in post-mortems
- Share best practices

---

## Contact Information

### On-Call Rotation
- Primary: [On-call phone number]
- Secondary: [Backup on-call phone number]
- Escalation: [Engineering manager phone number]

### Team Contacts
- Engineering Team: #engineering-slack
- Product Team: #product-slack
- Support Team: #support-slack
- DevOps Team: #devops-slack

### External Contacts
- Paystack Support: support@paystack.co
- Supabase Support: support@supabase.io
- Vercel Support: support@vercel.com

### Emergency Contacts
- CTO: [CTO phone number]
- VP Engineering: [VP Engineering phone number]
- Incident Commander: [Incident Commander phone number]
