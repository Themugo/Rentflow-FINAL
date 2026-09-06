# Logging Standards

This document defines the logging standards for CALQULUS PMS edge functions, including logging levels, message formats, context requirements, and best practices.

## Logging Levels

### DEBUG
- **Purpose**: Detailed diagnostic information for development and troubleshooting
- **When to use**: Detailed execution flow, variable states, intermediate results
- **Examples**: Function entry/exit, loop iterations, detailed processing steps
- **Production usage**: Disabled by default, enabled for troubleshooting

### INFO
- **Purpose**: General informational messages about system operation
- **When to use**: Normal operation milestones, state changes, successful operations
- **Examples**: Request received, operation completed, user actions, system events
- **Production usage**: Enabled, used for operational visibility

### WARN
- **Purpose**: Warning messages for potentially harmful situations
- **When to use**: Deprecated features, configuration issues, performance concerns
- **Examples**: Slow operations, retry attempts, resource constraints, fallback mechanisms
- **Production usage**: Enabled, triggers investigation but not immediate action

### ERROR
- **Purpose**: Error messages for system failures and exceptions
- **When to use**: Failed operations, exceptions, system errors, user-facing errors
- **Examples**: API failures, database errors, validation failures, authentication errors
- **Production usage**: Enabled, triggers immediate investigation and alerting

## Message Format Standards

### Structure
All log messages should follow this structure:
```
[timestamp] [level] [function] [correlation:xxx] [trace:xxx] [span:xxx] Message context
```

### Message Guidelines
- **Be specific**: Use clear, descriptive messages
- **Be concise**: Keep messages under 200 characters when possible
- **Be actionable**: Include information needed to understand and resolve issues
- **Be consistent**: Use standard terminology and phrasing
- **Avoid jargon**: Use language understood by all team members

### Examples
```
✅ Good: "Payment initiated for invoice #12345, amount KES 5,000"
❌ Bad: "Payment started"

✅ Good: "Database query failed: SELECT * FROM tenants WHERE id = 'abc' - connection timeout"
❌ Bad: "DB error"

✅ Good: "User authentication failed: Invalid credentials for user@example.com"
❌ Bad: "Auth failed"
```

## Context Requirements

### Required Context
All log messages must include:
- **Correlation ID**: For request tracing across services
- **Function Name**: To identify the source of the log
- **Timestamp**: For chronological analysis
- **User ID**: When user action is involved
- **Request ID**: When processing HTTP requests

### Optional Context
Include when relevant:
- **Error Details**: Stack traces, error codes, error messages
- **Performance Metrics**: Duration, memory usage, CPU time
- **Business Context**: Invoice numbers, payment amounts, user actions
- **System State**: Configuration values, environment information
- **External References**: API endpoints, database tables, external service names

### Context Examples
```typescript
// Payment processing
logger.info("Payment initiated", {
  correlationId: getCorrelationId(),
  userId: user.id,
  invoiceId: invoice.id,
  amount: invoice.amount,
  paymentMethod: "mpesa"
});

// Error handling
logger.error("Payment processing failed", {
  correlationId: getCorrelationId(),
  userId: user.id,
  invoiceId: invoice.id,
  error: error.message,
  stack: error.stack,
  paymentMethod: "mpesa"
});

// Performance monitoring
logger.info("Database query completed", {
  correlationId: getCorrelationId(),
  operation: "SELECT",
  table: "tenants",
  duration: 150,
  rows: 10
});
```

## Function-Specific Logging Standards

### Payment Functions
- **initiate-mpesa-payment**: Log initiation, Paystack API call, response, errors
- **record-payment**: Log payment recording, validation, database operations
- **send-payment-confirmation**: Log email/SMS/WhatsApp sending, delivery status
- **process-payment**: Log payment processing steps, state changes, final status

### Tenant Functions
- **send-tenant-invitation**: Log invitation creation, sending status, delivery confirmation
- **create-tenant-account**: Log account creation, user creation, role assignment
- **notify-manager-tenant-signup**: Log notification sending, manager notification

### API Functions
- **All API endpoints**: Log request receipt, validation, processing, response
- **External API calls**: Log request, response, latency, errors
- **Database operations**: Log query type, table, duration, success/failure

### Edge Functions
- **Function entry/exit**: Log function start, completion, duration
- **Error handling**: Log exceptions with full context
- **Performance**: Log slow operations, resource usage

## Sensitive Data Handling

### Never Log
- **Passwords**: Never log passwords or password hashes
- **API Keys**: Never log complete API keys or secrets
- **PII**: Never log full credit card numbers, SSNs, or sensitive personal data
- **Session Tokens**: Never log complete session tokens or JWTs

### Sanitize When Logging
- **Email Addresses**: Mask middle characters (user***@example.com)
- **Phone Numbers**: Mask last 4 digits (+2547***1234)
- **IP Addresses**: Mask last octet (192.168.1.***)
- **User IDs**: Use internal IDs instead of personal identifiers

### Examples
```typescript
// ✅ Good: Sanitized logging
logger.info("User login attempt", {
  email: sanitizeEmail(user.email), // user***@example.com
  phone: sanitizePhone(user.phone), // +2547***1234
  userId: user.id
});

// ❌ Bad: Sensitive data logging
logger.info("User login attempt", {
  email: user.email, // Full email exposed
  phone: user.phone, // Full phone exposed
  password: user.password // Never log passwords!
});
```

## Performance Considerations

### Log Volume
- **Avoid excessive logging**: Don't log every loop iteration
- **Batch operations**: Log batch operations once, not per item
- **Rate limit logging**: Limit high-frequency logs
- **Use appropriate levels**: Don't use INFO for DEBUG-level details

### Log Size
- **Keep messages concise**: Under 200 characters when possible
- **Limit context size**: Don't include large objects in logs
- **Use references**: Use IDs instead of full objects
- **Compress when needed**: For large context, use compression

### Async Logging
- **Use async logging**: Don't block on log writes
- **Buffer logs**: Use buffering for high-volume logging
- **Flush appropriately**: Ensure critical logs are flushed
- **Handle failures**: Gracefully handle logging failures

## Structured Logging

### JSON Format
All logs should be structured JSON for easy parsing:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "function": "initiate-mpesa-payment",
  "correlationId": "abc-123-def-456",
  "traceId": "trace-789-ghi-012",
  "spanId": "span-345-jkl-678",
  "message": "Payment initiated",
  "context": {
    "userId": "user-123",
    "invoiceId": "invoice-456",
    "amount": 5000,
    "paymentMethod": "mpesa"
  }
}
```

### Field Names
- **Use camelCase**: For consistency with JavaScript conventions
- **Be descriptive**: Use clear, meaningful field names
- **Be consistent**: Use same field names across functions
- **Follow standards**: Use standard field names (userId, correlationId, etc.)

### Data Types
- **Strings**: For text data
- **Numbers**: For numeric values (integers, floats)
- **Booleans**: For true/false values
- **Objects**: For structured data
- **Arrays**: For lists of items

## Error Logging Standards

### Error Context
Always include:
- **Error message**: The actual error message
- **Error type**: The error class or type
- **Stack trace**: For debugging (in development)
- **User impact**: Whether this affects users
- **Business context**: What operation was being performed

### Error Examples
```typescript
// ✅ Good: Comprehensive error logging
logger.error("Payment processing failed", {
  correlationId: getCorrelationId(),
  userId: user.id,
  invoiceId: invoice.id,
  error: error.message,
  errorType: error.name,
  stack: error.stack,
  userImpact: "Unable to process payment",
  operation: "initiate-mpesa-payment"
});

// ❌ Bad: Minimal error logging
logger.error("Payment failed", { error: error.message });
```

### Error Recovery
- **Log recovery attempts**: When attempting to recover from errors
- **Log recovery success**: When recovery is successful
- **Log recovery failure**: When recovery fails
- **Log fallback actions**: When using fallback mechanisms

## Distributed Tracing

### Trace Context
Always include trace context in logs:
- **Trace ID**: For distributed tracing across services
- **Span ID**: For tracing within a service
- **Parent Span ID**: For parent-child relationships
- **Correlation ID**: For request correlation

### Trace Propagation
- **Extract from headers**: Extract trace context from incoming requests
- **Inject to headers**: Inject trace context to outgoing requests
- **Maintain context**: Keep trace context throughout request processing
- **Link spans**: Create parent-child span relationships

### Trace Examples
```typescript
// Extract trace context from request
const traceContext = extractTraceContext(req);
setTraceId(traceContext.traceId);
setSpanId(traceContext.spanId);

// Log with trace context
logger.info("Processing payment", {
  correlationId: getCorrelationId(),
  traceId: getTraceId(),
  spanId: getSpanId(),
  paymentId: payment.id
});

// Inject trace context to outgoing request
const span = startSpan(tracer, "external-api-call");
injectTraceContext(span, headers);
```

## Audit Logging

### Audit Requirements
Log all sensitive operations:
- **User authentication**: Login, logout, password changes
- **Authorization**: Permission changes, role assignments
- **Data access**: Access to sensitive data
- **Data modifications**: Create, update, delete operations
- **Configuration changes**: System configuration updates

### Audit Log Format
```typescript
logger.info("AUDIT: User role changed", {
  correlationId: getCorrelationId(),
  actorId: currentUser.id,
  targetUserId: targetUser.id,
  action: "role_change",
  oldValue: "tenant",
  newValue: "manager",
  timestamp: new Date().toISOString(),
  ipAddress: getClientIp(req),
  userAgent: req.headers.get("user-agent")
});
```

### Audit Retention
- **Retention period**: Keep audit logs for minimum 1 year
- **Immutable**: Audit logs must never be modified
- **Secure**: Audit logs must be securely stored
- **Accessible**: Audit logs must be accessible for compliance

## Monitoring and Alerting

### Log-Based Metrics
- **Error rate**: Count of ERROR level logs
- **Warning rate**: Count of WARN level logs
- **Request rate**: Count of request-related logs
- **Performance metrics**: Extract duration from logs

### Alert Conditions
- **Error spike**: Error rate > 5% for 5 minutes
- **Critical error**: Any critical error log
- **Service degradation**: Warning rate > 10% for 10 minutes
- **Performance issue**: Duration > threshold in logs

### Log Aggregation
- **Centralized logging**: Use centralized log management
- **Log shipping**: Ship logs to log management system
- **Log parsing**: Parse logs for structured analysis
- **Log retention**: Define retention policies by log level

## Testing and Validation

### Log Testing
- **Test log output**: Verify logs are generated correctly
- **Test log format**: Validate structured log format
- **Test log context**: Ensure required context is included
- **Test log performance**: Verify logging doesn't impact performance

### Log Validation
- **Format validation**: Validate JSON structure
- **Field validation**: Ensure required fields are present
- **Type validation**: Ensure data types are correct
- **Content validation**: Ensure sensitive data is not logged

### Log Review
- **Regular review**: Review logs regularly for issues
- **Pattern analysis**: Analyze log patterns for insights
- **Performance review**: Review logging performance impact
- **Security review**: Review logs for sensitive data exposure

## Best Practices

### DO
- ✅ Use structured logging with consistent format
- ✅ Include correlation IDs for request tracing
- ✅ Log at appropriate levels (DEBUG, INFO, WARN, ERROR)
- ✅ Include relevant context in log messages
- ✅ Sanitize sensitive data before logging
- ✅ Use descriptive, actionable log messages
- ✅ Log errors with full context and stack traces
- ✅ Monitor log volume and performance impact
- ✅ Review logs regularly for insights and issues
- ✅ Use centralized log management

### DON'T
- ❌ Log sensitive data (passwords, API keys, PII)
- ❌ Use excessive logging that impacts performance
- ❌ Log at inappropriate levels (ERROR for normal operations)
- ❌ Include large objects in log context
- ❌ Use vague or non-actionable log messages
- ❌ Log without context or correlation IDs
- ❌ Ignore log performance impact
- ❌ Log the same information repeatedly
- ❌ Use inconsistent log formats
- ❌ Forget to sanitize user data

## Tool-Specific Guidelines

### Supabase Edge Functions
- Use the shared logger module
- Include correlation IDs from request headers
- Log function entry and exit
- Log external API calls with full context
- Log database operations with performance metrics

### Frontend Applications
- Use browser console logging appropriately
- Don't log sensitive data to console
- Use structured logging for complex applications
- Implement client-side error tracking
- Log user interactions for analytics

### Backend Services
- Use centralized logging infrastructure
- Implement log aggregation
- Set up log-based monitoring
- Use structured logging for parsing
- Implement log retention policies

## Compliance and Security

### GDPR Compliance
- **Data minimization**: Only log necessary data
- **Right to be forgotten**: Support log deletion requests
- **Data portability**: Support log export requests
- **Consent tracking**: Log consent for data processing

### Security Standards
- **Access control**: Restrict log access to authorized personnel
- **Encryption**: Encrypt logs at rest and in transit
- **Audit trail**: Maintain audit trail for log access
- **Secure storage**: Store logs in secure, compliant storage

### Regulatory Requirements
- **SOC 2**: Maintain audit logs for compliance
- **PCI DSS**: Secure logging of payment data
- **HIPAA**: Secure logging of healthcare data
- **Industry-specific**: Follow industry-specific logging requirements

## Documentation and Training

### Log Documentation
- Document logging standards for each function
- Include examples of good and bad logging
- Provide logging guidelines for new features
- Maintain log field dictionary

### Team Training
- Train team on logging standards
- Provide examples and best practices
- Conduct regular log reviews
- Share logging insights and learnings

### Continuous Improvement
- Regularly review logging practices
- Update standards based on lessons learned
- Incorporate feedback from operations team
- Stay current with logging best practices
