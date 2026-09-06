# API Documentation

This directory contains comprehensive API documentation for the CALQULUS RMS platform.

## Overview

The CALQULUS RMS API is a RESTful API built on Supabase Edge Functions, providing:

- **Authentication**: JWT-based auth with role-based access
- **Real-time**: Supabase real-time subscriptions
- **Payments**: M-Pesa STK Push integration
- **Multi-tenancy**: Row-Level Security isolation

## Contents

### Edge Functions API

| Function | Endpoint | Description |
|----------|----------|-------------|
| [Authentication](./endpoints/auth.md) | `/functions/v1/auth/*` | Login, signup, password reset |
| [Payments](./endpoints/payments.md) | `/functions/v1/payments/*` | M-Pesa, Stripe, reconciliation |
| [Tenants](./endpoints/tenants.md) | `/functions/v1/tenants/*` | Tenant management |
| [Properties](./endpoints/properties.md) | `/functions/v1/properties/*` | Property CRUD |
| [Invoices](./endpoints/invoices.md) | `/functions/v1/invoices/*` | Invoice generation |
| [Water Billing](./endpoints/water-billing.md) | `/functions/v1/water/*` | Meter readings, billing |
| [Notifications](./endpoints/notifications.md) | `/functions/v1/notifications/*` | SMS, Email, WhatsApp |

### Database API

| Table | Description |
|-------|-------------|
| [Schema Reference](./schema.md) | Complete database schema |
| [RLS Policies](./rls-policies.md) | Access control policies |

### Client Libraries

- [JavaScript/TypeScript SDK](./sdks/javascript.md)
- [React Hooks](./sdks/react-hooks.md)

## Base URL

```
Production: https://aelzsqxllkypbzslxyju.supabase.co/functions/v1
Staging: https://staging.supabase.co/functions/v1
Local: http://localhost:54321/functions/v1
```

## Authentication

All API requests (except public endpoints) require a JWT token:

```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session.access_token;

fetch('/functions/v1/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

## Response Format

### Success Response
```json
{
  "data": { ... },
  "error": null
}
```

### Error Response
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

## Rate Limiting

| Tier | Requests/Minute | Burst |
|------|-----------------|-------|
| Lite | 60 | 10 |
| Pro | 300 | 50 |
| Enterprise | 1000 | 100 |

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 429 | Rate Limited |
| 500 | Server Error |
