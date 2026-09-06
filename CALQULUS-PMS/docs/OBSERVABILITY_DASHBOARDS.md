# Observability Dashboards

This document describes the observability dashboards for CALQULUS PMS, including key metrics, visualizations, and monitoring views.

## Overview Dashboard

### Purpose
High-level system health and performance overview for operations teams and stakeholders.

### Key Metrics
- **System Health Score**: Overall system status (0-100)
- **Total Requests**: Total API requests in last 24h
- **Error Rate**: Percentage of failed requests
- **Average Latency**: Mean response time across all services
- **Active Users**: Number of active users in last hour
- **Payment Success Rate**: M-Pesa payment success percentage
- **Database Health**: Database connection and query performance
- **Function Health**: Edge function execution status

### Visualizations
- **System Health Gauge**: Overall health score with color coding
- **Request Rate Trend**: Line chart showing requests per minute
- **Error Rate Trend**: Line chart showing error percentage over time
- **Latency Heatmap**: Heatmap showing latency by endpoint and time
- **Payment Success Rate**: Donut chart showing payment success/failure
- **Top 5 Slow Endpoints**: Bar chart of slowest API endpoints
- **Recent Errors**: Table of recent error events with severity

### Alerts
- System health score < 70
- Error rate > 5%
- Average latency > 1s
- Payment success rate < 90%

---

## Payment Operations Dashboard

### Purpose
Monitor M-Pesa payment operations, success rates, and payment flow performance.

### Key Metrics
- **Total Payments**: Number of payment attempts
- **Success Rate**: Percentage of successful payments
- **Failure Rate**: Percentage of failed payments
- **Average Payment Amount**: Mean payment value
- **Total Payment Volume**: Sum of all payment amounts
- **Callback Success Rate**: Percentage of successful callbacks
- **Average Callback Latency**: Mean time from initiation to callback
- **Timeout Rate**: Percentage of timed-out payments

### Visualizations
- **Payment Success Rate Trend**: Line chart showing success rate over time
- **Payment Volume Trend**: Bar chart showing payment volume by hour
- **Failure Reasons**: Pie chart showing common failure reasons
- **Callback Latency Distribution**: Histogram of callback latencies
- **Payment Amount Distribution**: Histogram of payment amounts
- **Success Rate by Hour**: Heatmap showing success rate by time of day
- **Recent Payment Failures**: Table of recent failed payments with details

### Alerts
- Payment success rate < 90%
- Callback failure rate > 15%
- Average callback latency > 30s
- Timeout rate > 5%

---

## API Performance Dashboard

### Purpose
Monitor API performance, latency, and endpoint health across all services.

### Key Metrics
- **Total API Calls**: Number of API requests
- **Success Rate**: Percentage of successful API calls
- **Average Latency**: Mean response time
- **P50 Latency**: Median response time
- **P95 Latency**: 95th percentile response time
- **P99 Latency**: 99th percentile response time
- **Calls by Method**: Breakdown by HTTP method
- **Calls by Service**: Breakdown by external service

### Visualizations
- **Latency Trend**: Line chart showing latency over time
- **Success Rate Trend**: Line chart showing success rate over time
- **Latency Percentiles**: Multi-line chart showing P50, P95, P99
- **Endpoint Performance**: Bar chart showing latency by endpoint
- **Service Performance**: Bar chart showing latency by service
- **Error Rate by Endpoint**: Heatmap showing error rates
- **Request Rate**: Line chart showing requests per minute

### Alerts
- Average latency > 500ms
- P95 latency > 2s
- Success rate < 95%
- Error rate > 5%

---

## Database Performance Dashboard

### Purpose
Monitor database query performance, connection health, and table-level statistics.

### Key Metrics
- **Total Queries**: Number of database queries
- **Success Rate**: Percentage of successful queries
- **Average Latency**: Mean query execution time
- **P50 Latency**: Median query execution time
- **P95 Latency**: 95th percentile query time
- **Queries by Operation**: Breakdown by operation type
- **Queries by Table**: Breakdown by table
- **Total Rows Affected**: Sum of rows affected by queries

### Visualizations
- **Query Latency Trend**: Line chart showing query latency over time
- **Query Success Rate**: Line chart showing success rate over time
- **Slow Queries**: Table of queries with latency > 200ms
- **Query Performance by Table**: Bar chart showing latency by table
- **Operation Performance**: Bar chart showing latency by operation type
- **Error Queries**: Table of failed queries with error details
- **Connection Pool**: Gauge showing connection pool utilization

### Alerts
- Average query latency > 100ms
- P95 query latency > 500ms
- Query success rate < 98%
- Connection pool utilization > 80%

---

## Edge Function Dashboard

### Purpose
Monitor edge function execution, performance, and failure patterns.

### Key Metrics
- **Total Executions**: Number of function executions
- **Success Rate**: Percentage of successful executions
- **Average Duration**: Mean execution time
- **P50 Duration**: Median execution time
- **P95 Duration**: 95th percentile execution time
- **Executions by Function**: Breakdown by function name
- **Average Memory Used**: Mean memory consumption
- **Average CPU Time**: Mean CPU time

### Visualizations
- **Execution Duration Trend**: Line chart showing duration over time
- **Success Rate Trend**: Line chart showing success rate over time
- **Function Performance**: Bar chart showing duration by function
- **Slow Functions**: Table of functions with duration > 2s
- **Failing Functions**: Table of functions with failure rate > 10%
- **Memory Usage Trend**: Line chart showing memory consumption
- **Execution Rate**: Line chart showing executions per minute

### Alerts
- Average execution duration > 2s
- P95 execution duration > 5s
- Function success rate < 95%
- Average memory usage > 100MB

---

## User Journey Dashboard

### Purpose
Monitor user journey completion, conversion funnels, and user behavior patterns.

### Key Metrics
- **Total Journeys**: Number of user journeys started
- **Completion Rate**: Percentage of completed journeys
- **Abandonment Rate**: Percentage of abandoned journeys
- **Average Journey Duration**: Mean time to complete journey
- **Journeys by Type**: Breakdown by journey type
- **Conversion Funnel**: Step-by-step conversion rates
- **Average Step Duration**: Mean time per step

### Visualizations
- **Journey Completion Rate**: Line chart showing completion rate over time
- **Conversion Funnels**: Funnel chart for each journey type
- **Journey Duration Distribution**: Histogram of journey durations
- **Dropoff Analysis**: Bar chart showing dropoff by step
- **Journey Volume**: Bar chart showing journeys by type
- **Step Duration**: Heatmap showing duration by step and journey type
- **Recent Abandoned Journeys**: Table of recently abandoned journeys

### Alerts
- Overall completion rate < 70%
- Payment journey completion rate < 80%
- Tenant onboarding completion rate < 60%
- Average journey duration > 5 minutes

---

## Error Tracking Dashboard

### Purpose
Monitor error rates, error patterns, and system reliability.

### Key Metrics
- **Total Errors**: Number of error events
- **Error Rate**: Percentage of requests resulting in errors
- **Critical Errors**: Number of critical severity errors
- **Errors by Function**: Breakdown by function name
- **Errors by Type**: Breakdown by error type
- **Mean Time to Resolution**: Average time to resolve errors
- **Recurring Errors**: Number of recurring error patterns

### Visualizations
- **Error Rate Trend**: Line chart showing error rate over time
- **Error Severity Distribution**: Pie chart showing errors by severity
- **Top Error Types**: Bar chart showing most common error types
- **Error by Function**: Heatmap showing errors by function
- **Recent Critical Errors**: Table of recent critical errors
- **Error Resolution Time**: Line chart showing resolution time trend
- **Recurring Error Patterns**: Table of recurring errors with frequency

### Alerts
- Error rate > 5%
- Critical error count > 10 in 1 hour
- Recurring error pattern detected (> 5 occurrences)
- Mean time to resolution > 1 hour

---

## Real-time Monitoring Dashboard

### Purpose
Real-time monitoring of system health and performance for immediate issue detection.

### Key Metrics
- **Current Request Rate**: Requests per second (last minute)
- **Current Error Rate**: Error percentage (last minute)
- **Current Latency**: Average response time (last minute)
- **Active Connections**: Number of active database connections
- **Memory Usage**: Current memory consumption
- **CPU Usage**: Current CPU utilization
- **Queue Depth**: Number of queued requests

### Visualizations
- **Request Rate Gauge**: Real-time requests per second
- **Error Rate Gauge**: Real-time error percentage
- **Latency Gauge**: Real-time average response time
- **Resource Usage**: Multi-gauge showing memory, CPU, and disk
- **Live Log Stream**: Scrolling log of recent events
- **Active Requests**: Table of currently processing requests
- **System Status**: Status indicators for all components

### Alerts
- Request rate > 1000 req/s
- Error rate > 10%
- Latency > 2s
- Memory usage > 80%
- CPU usage > 80%
- Queue depth > 100

---

## Dashboard Configuration

### Time Range Options
- Last 15 minutes
- Last 1 hour
- Last 6 hours
- Last 24 hours
- Last 7 days
- Last 30 days
- Custom range

### Refresh Intervals
- Real-time (5 seconds)
- 1 minute
- 5 minutes
- 15 minutes
- 1 hour
- Manual

### Filters
- Environment (production, staging, development)
- Region (all regions, specific region)
- Service (all services, specific service)
- Function (all functions, specific function)
- User ID (specific user)
- Correlation ID (specific request)

### Export Options
- CSV export
- JSON export
- PDF report
- Share dashboard link
- Schedule recurring reports

---

## Dashboard Access

### Role-Based Access
- **Admin**: Full access to all dashboards
- **Manager**: Access to payment, API, and function dashboards
- **Developer**: Access to API, database, and function dashboards
- **Support**: Access to error tracking and user journey dashboards
- **Viewer**: Read-only access to overview dashboard

### Authentication
- SSO integration
- API key authentication
- Role-based access control
- Audit logging for dashboard access

---

## Dashboard Customization

### Custom Dashboards
Users can create custom dashboards by:
1. Selecting metrics from available sources
2. Choosing visualization types
3. Setting up filters and time ranges
4. Configuring alert thresholds
5. Sharing with team members

### Saved Views
- Save custom dashboard configurations
- Create dashboard templates
- Share saved views with team
- Set default dashboard for login

### Alert Configuration
- Set custom alert thresholds
- Configure notification channels (email, Slack, PagerDuty)
- Define alert escalation rules
- Set up alert suppression windows
- Configure alert aggregation

---

## Integration with External Tools

### Data Export
- Export to Prometheus for time-series storage
- Export to Grafana for visualization
- Export to Elasticsearch for log analysis
- Export to DataDog for APM

### Alert Integration
- Send alerts to Slack
- Send alerts to PagerDuty
- Send alerts to Microsoft Teams
- Send alerts via email
- Send alerts to webhooks

### API Access
- REST API for dashboard data
- GraphQL API for complex queries
- WebSocket API for real-time updates
- SDK for programmatic access
