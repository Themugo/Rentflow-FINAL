# Supabase Edge Functions Audit Report

## Executive Summary
- **Total Functions**: 86
- **Current Structure**: Flat directory with individual function folders
- **Shared Modules**: 6 existing modules in `_shared/` directory
- **Target Architecture**: Domain-based organization with shared infrastructure

## 1. Function Categorization by Business Domain

### PAYMENTS (15 functions)
- `initiate-mpesa-payment` - M-Pesa payment initiation
- `initiate-mpesa-stk-push` - M-Pesa STK push
- `initiate-manager-mpesa-payment` - Manager M-Pesa payments
- `initiate-subscription-mpesa` - Subscription M-Pesa payments
- `verify-mpesa-payment` - M-Pesa payment verification
- `verify-mpesa-stk-status` - STK status verification
- `mpesa-callback` - M-Pesa webhook handler
- `record-payment` - Payment recording
- `process-payment` - Payment processing
- `create-invoice-checkout` - Invoice checkout creation
- `create-manager-invoice-checkout` - Manager invoice checkout
- `create-payout` - Payout creation
- `execute-payout` - Payout execution
- `reconcile` - Payment reconciliation
- `reconcile-bank` - Bank reconciliation
- `stripe-webhook` - Stripe webhook handler
- `bank-webhook` - Bank webhook handler

### TENANTS (12 functions)
- `create-tenant` - Tenant creation
- `create-tenant-account` - Tenant account creation
- `accept-tenant-invite` - Tenant invitation acceptance
- `claim-tenant` - Tenant claiming
- `self-register-tenant` - Tenant self-registration
- `send-tenant-invitation` - Tenant invitation sending
- `calculate-tenant-score` - Tenant scoring
- `backfill-tenant-accounts` - Tenant account backfill
- `get-payment-history` - Payment history retrieval
- `apply-credit` - Credit application
- `apply-penalties` - Penalty application
- `activate-account` - Account activation

### NOTIFICATIONS (25 functions)
- `send-tenant-invitation` - Tenant invitation
- `send-welcome-email` - Welcome email
- `send-contract-notification` - Contract notification
- `send-invoice-email` - Invoice email
- `send-invoice-notification` - Invoice notification
- `send-payment-confirmation` - Payment confirmation
- `send-payment-reminders` - Payment reminders
- `send-payment-push-notification` - Payment push notification
- `send-receipt-email` - Receipt email
- `send-receipt-status-notification` - Receipt status notification
- `send-manager-receipt-email` - Manager receipt email
- `send-manager-invoice-notification` - Manager invoice notification
- `send-manager-approval-notification` - Manager approval notification
- `send-manager-contract-notification` - Manager contract notification
- `send-manager-receipt-upload-notification` - Manager receipt upload notification
- `send-manager-tenant-signup` - Manager tenant signup notification
- `send-new-manager-signup` - New manager signup notification
- `send-property-assignment-notification` - Property assignment notification
- `send-maintenance-notification` - Maintenance notification
- `send-overdue-notifications` - Overdue notifications
- `send-overdue-maintenance-notifications` - Overdue maintenance notifications
- `send-deposit-refund-notification` - Deposit refund notification
- `send-bank-details-notification` - Bank details notification
- `send-signature-notification` - Signature notification
- `send-monthly-report` - Monthly report
- `send-bulk-sms` - Bulk SMS
- `send-sms-notification` - SMS notification
- `send-whatsapp-notification` - WhatsApp notification
- `send-push-notification` - Push notification
- `send-invoice-due-push-notification` - Invoice due push notification
- `auto-send-receipt` - Auto receipt sending

### INVOICES (6 functions)
- `auto-generate-invoices` - Automatic invoice generation
- `generate-manager-invoices` - Manager invoice generation
- `generate-monthly-invoices` - Monthly invoice generation
- `process-due-invoice-notifications` - Due invoice notifications
- `create-manager-subscription` - Manager subscription creation
- `check-manager-subscription` - Manager subscription check

### MAINTENANCE (3 functions)
- `seed-maintenance` - Maintenance seeding
- `create-dispute` - Dispute creation
- `resolve-dispute` - Dispute resolution

### ANALYTICS (8 functions)
- `generate-cashflow` - Cashflow generation
- `generate-pnl` - P&L generation
- `generate-landlord-statement` - Landlord statement generation
- `export-excel` - Excel export
- `export-pdf` - PDF export
- `detect-fraud` - Fraud detection
- `calculate-tenant-score` - Tenant scoring (duplicate category)
- `process-commission` - Commission processing

### ADMIN (5 functions)
- `bootstrap-webhost` - Webhost bootstrap
- `log-audit` - Audit logging
- `seed-demo-data` - Demo data seeding
- `check-feature` - Feature checking
- `manage-mpesa-settings` - M-Pesa settings management

### WEBHOOKS (3 functions)
- `stripe-webhook` - Stripe webhook
- `bank-webhook` - Bank webhook
- `mpesa-callback` - M-Pesa callback

### UTILITIES (8 functions)
- `parse-contract-document` - Contract document parsing
- `parse-receipt` - Receipt parsing
- `notify-manager-payment` - Manager payment notification
- `notify-manager-receipt-upload` - Manager receipt upload notification
- `process-commission` - Commission processing (duplicate category)

## 2. Current Shared Modules Analysis

### Existing Shared Modules (`_shared/`)
- `apiVersion.ts` - API versioning middleware
- `cors.ts` - CORS configuration
- `env.ts` - Environment variable handling
- `rateLimit.ts` - Rate limiting
- `sms.ts` - SMS sending
- `webhookHelpers.ts` - Webhook helpers

### Assessment
- ✅ Good foundation with CORS, rate limiting, and environment handling
- ❌ Missing: Authentication, authorization, validation, error handling, idempotency, audit logging
- ❌ Inconsistent usage across functions

## 3. Duplicated Code Patterns Identified

### Authentication Pattern (Found in ~40 functions)
```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  throw new Error("No authorization header provided");
}
const token = authHeader.replace("Bearer ", "");
const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
if (userError) {
  throw new Error(`Authentication error: ${userError.message}`);
}
```

### Logging Pattern (Found in ~60 functions)
```typescript
const logStep = (step: string, details?: any) => {
  console.log(`[function-name] ${step}`, details ?? "");
};
```

### Error Handling Pattern (Found in ~70 functions)
```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return new Response(
    JSON.stringify({ error: errorMessage }),
    {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    }
  );
}
```

### Validation Pattern (Found in ~30 functions)
```typescript
if (!field1 || !field2) {
  return new Response(JSON.stringify({ error: "Missing required fields" }), {
    status: 400,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}
```

### Response Pattern (Found in ~80 functions)
```typescript
return new Response(
  JSON.stringify({ success: true, data }),
  {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    status: 200,
  }
);
```

## 4. Proposed Shared Modules

### New Shared Modules to Create
1. `auth.ts` - Authentication middleware
2. `authorization.ts` - Authorization checks
3. `validation.ts` - Input validation utilities
4. `logger.ts` - Structured logging
5. `errors.ts` - Error handling and response formatting
6. `idempotency.ts` - Idempotency key handling
7. `audit.ts` - Audit logging
8. `response.ts` - Standardized response formatting

## 5. Target Architecture

```
functions/
  payments/
    initiate-mpesa-payment/
    initiate-mpesa-stk-push/
    verify-mpesa-payment/
    record-payment/
    create-invoice-checkout/
    create-payout/
    reconcile/
    stripe-webhook/
    bank-webhook/
    mpesa-callback/
  tenants/
    create-tenant/
    create-tenant-account/
    accept-tenant-invite/
    claim-tenant/
    self-register-tenant/
    send-tenant-invitation/
    calculate-tenant-score/
  notifications/
    email/
      send-welcome-email/
      send-invoice-email/
      send-receipt-email/
    sms/
      send-sms-notification/
      send-bulk-sms/
    push/
      send-push-notification/
      send-payment-push-notification/
    whatsapp/
      send-whatsapp-notification/
  invoices/
    auto-generate-invoices/
    generate-monthly-invoices/
    process-due-invoice-notifications/
  maintenance/
    create-dispute/
    resolve-dispute/
    seed-maintenance/
  analytics/
    generate-cashflow/
    generate-pnl/
    export-excel/
    export-pdf/
    detect-fraud/
  admin/
    bootstrap-webhost/
    log-audit/
    seed-demo-data/
    check-feature/
  shared/
    auth.ts
    authorization.ts
    validation.ts
    logger.ts
    errors.ts
    idempotency.ts
    audit.ts
    response.ts
    cors.ts (existing)
    apiVersion.ts (existing)
    env.ts (existing)
    rateLimit.ts (existing)
    sms.ts (existing)
    webhookHelpers.ts (existing)
```

## 6. Consolidation Plan

### Phase 1: Foundation (Week 1-2)
1. Create new shared modules
2. Standardize error handling
3. Implement structured logging
4. Add authentication middleware

### Phase 2: Payments Domain (Week 3-4)
1. Refactor payment functions
2. Extract payment-specific shared logic
3. Implement idempotency for payment operations
4. Add audit logging for financial transactions

### Phase 3: Tenant Domain (Week 5)
1. Refactor tenant functions
2. Standardize tenant validation
3. Implement tenant-specific authorization

### Phase 4: Notifications Domain (Week 6-7)
1. Consolidate notification functions
2. Create notification templates
3. Implement notification queue
4. Add notification tracking

### Phase 5: Remaining Domains (Week 8)
1. Refactor invoices, maintenance, analytics, admin functions
2. Complete migration to new structure
3. Remove deprecated functions

## 7. Dependency Map

### Core Dependencies
```
All Functions → shared/logger.ts
All Functions → shared/errors.ts
All Functions → shared/response.ts
Auth Functions → shared/auth.ts
Auth Functions → shared/authorization.ts
Payment Functions → shared/idempotency.ts
Payment Functions → shared/audit.ts
Notification Functions → shared/validation.ts
```

### Cross-Domain Dependencies
```
Payments → Tenants (tenant validation)
Invoices → Payments (payment processing)
Notifications → All domains (event triggers)
Analytics → Payments, Tenants (data aggregation)
```

## 8. Migration Strategy

### Rollout Strategy
1. **Parallel Development**: Create new structure alongside existing
2. **Gradual Migration**: Migrate one domain at a time
3. **Feature Flags**: Use feature flags to switch between old/new
4. **Testing**: Comprehensive testing for each migrated domain
5. **Monitoring**: Monitor performance and error rates
6. **Rollback**: Keep old functions until migration is complete

### Backward Compatibility
- Maintain old function endpoints during transition
- Use API versioning to distinguish old/new implementations
- Deprecate old functions after 30-day notice period

## 9. Refactored Examples

### Example 1: Standard Payment Function
```typescript
import { serve } from "std/http/server.ts";
import { authenticateUser } from "../shared/auth.ts";
import { validatePaymentRequest } from "../shared/validation.ts";
import { handleIdempotency } from "../shared/idempotency.ts";
import { logTransaction } from "../shared/audit.ts";
import { successResponse, errorResponse } from "../shared/response.ts";
import { logger } from "../shared/logger.ts";

serve(async (req) => {
  const context = await authenticateUser(req);
  if (!context.success) return context.response;
  
  const validation = await validatePaymentRequest(await req.json());
  if (!validation.valid) return errorResponse(validation.errors, 400);
  
  const idempotency = await handleIdempotency(req, context.user.id);
  if (idempotency.cached) return idempotency.response;
  
  try {
    logger.info("Processing payment", { userId: context.user.id });
    
    const result = await processPayment(validation.data);
    
    await logTransaction({
      userId: context.user.id,
      action: "payment",
      result: "success",
      amount: result.amount
    });
    
    return successResponse(result);
  } catch (error) {
    logger.error("Payment failed", { error, userId: context.user.id });
    return errorResponse(error.message, 500);
  }
});
```

### Example 2: Standard Notification Function
```typescript
import { serve } from "std/http/server.ts";
import { authenticateUser } from "../shared/auth.ts";
import { validateNotificationRequest } from "../shared/validation.ts";
import { sendEmail, sendSMS } from "../shared/notifications.ts";
import { logger } from "../shared/logger.ts";
import { successResponse, errorResponse } from "../shared/response.ts";

serve(async (req) => {
  const context = await authenticateUser(req);
  if (!context.success) return context.response;
  
  const validation = await validateNotificationRequest(await req.json());
  if (!validation.valid) return errorResponse(validation.errors, 400);
  
  try {
    logger.info("Sending notification", { 
      type: validation.data.type,
      recipient: validation.data.recipient 
    });
    
    const results = await Promise.allSettled([
      sendEmail(validation.data),
      sendSMS(validation.data)
    ]);
    
    logger.info("Notification sent", { results });
    return successResponse({ results });
  } catch (error) {
    logger.error("Notification failed", { error });
    return errorResponse(error.message, 500);
  }
});
```

## 10. Next Steps

1. **Immediate**: Create shared module foundation
2. **Week 1**: Implement authentication and logging modules
3. **Week 2**: Refactor payment functions as proof of concept
4. **Week 3-8**: Complete domain-by-domain migration
5. **Week 9**: Testing and validation
6. **Week 10**: Deployment and monitoring

## 11. Success Metrics

- **Code Reduction**: Target 40% reduction in duplicated code
- **Consistency**: 100% of functions use shared modules
- **Performance**: <100ms average response time
- **Reliability**: <0.1% error rate
- **Maintainability**: Single source of truth for common patterns
