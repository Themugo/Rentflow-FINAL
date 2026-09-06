# CALQULUS RMS API Documentation

## Overview

CALQULUS RMS uses Supabase as the backend, providing a RESTful API for database operations and Edge Functions for server-side logic.

## Base URL

```
https://aelzsqxllkypbzslxyju.supabase.co
```

## Authentication

All API requests require authentication via Supabase Auth. Use the Supabase client SDK to handle authentication automatically.

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://aelzsqxllkypbzslxyju.supabase.co',
  'your-anon-key'
)
```

## Database Tables

### Core Tables

#### `users`
Authentication users managed by Supabase Auth.

#### `user_roles`
Maps users to their roles (manager, tenant, webhost, submanager, landlord, agency).

```typescript
interface UserRole {
  user_id: uuid
  role: 'manager' | 'tenant' | 'webhost' | 'submanager' | 'landlord' | 'agency'
  approval_status: 'pending' | 'approved' | 'rejected'
  tenant_id?: uuid
}
```

#### `properties`
Property listings with unit information.

```typescript
interface Property {
  id: uuid
  address: string
  city: string
  property_type: 'apartment' | 'house' | 'commercial' | 'land'
  units_count: number
  manager_id: uuid
  created_at: timestamptz
}
```

#### `units`
Individual rental units within properties.

```typescript
interface Unit {
  id: uuid
  property_id: uuid
  unit_number: string
  rent_amount: numeric
  status: 'vacant' | 'occupied' | 'maintenance'
}
```

#### `tenants`
Tenant information and lease details.

```typescript
interface Tenant {
  id: uuid
  user_id: uuid
  unit_id: uuid
  lease_start: date
  lease_end: date
  monthly_rent: numeric
  status: 'active' | 'inactive' | 'pending'
}
```

#### `invoices`
Rent invoices and billing records.

```typescript
interface Invoice {
  id: uuid
  tenant_id: uuid
  unit_id: uuid
  amount: numeric
  due_date: date
  status: 'pending' | 'paid' | 'overdue'
  payment_destination: 'manager' | 'landlord' | 'agency'
}
```

#### `payments`
Payment records from various sources.

```typescript
interface Payment {
  id: uuid
  invoice_id: uuid
  amount: numeric
  payment_method: 'mpesa' | 'stripe' | 'cash' | 'bank_transfer'
  transaction_id: string
  status: 'pending' | 'completed' | 'failed'
  created_at: timestamptz
}
```

### Supporting Tables

#### `property_landlords`
Links properties to landlords with revenue sharing.

```typescript
interface PropertyLandlord {
  property_id: uuid
  landlord_user_id: uuid
  manager_id: uuid
  revenue_share_pct: numeric
  operating_model: 'self_managed' | 'agency_managed' | 'manager_managed'
}
```

#### `platform_admins`
Platform administration hierarchy.

```typescript
interface PlatformAdmin {
  id: uuid
  user_id: uuid
  admin_type: 'owner' | 'business' | 'admin'
  can_manage_managers: boolean
  can_manage_billing: boolean
  can_manage_properties: boolean
  is_immutable: boolean
  suspended: boolean
}
```

#### `customer_billing_blocks`
Customer-specific billing overrides.

```typescript
interface CustomerBillingBlock {
  id: uuid
  customer_id: uuid
  customer_type: 'manager' | 'landlord' | 'agency'
  price_per_unit?: numeric
  registration_fee_waived: boolean
  monthly_discount_pct?: numeric
}
```

#### `activity_logs`
Audit trail for all system activities.

```typescript
interface ActivityLog {
  id: uuid
  actor_id: uuid
  actor_role: string
  action: string
  entity_type?: string
  entity_id?: uuid
  metadata?: jsonb
  created_at: timestamptz
}
```

## Edge Functions

### Authentication & User Management

#### `send-tenant-invitation`
Sends invitation email to new tenant.

```typescript
POST /functions/v1/send-tenant-invitation
Headers: Authorization: Bearer <token>
Body: {
  email: string
  property_id: uuid
  unit_id: uuid
  landlord_id?: uuid
}
```

#### `create-tenant-account`
Creates tenant account from invitation token.

```typescript
POST /functions/v1/create-tenant-account
Body: {
  token: string
  password: string
  full_name: string
  phone?: string
}
```

#### `notify-manager-tenant-signup`
Notifies manager when tenant signs up.

```typescript
POST /functions/v1/notify-manager-tenant-signup
Body: {
  tenant_id: uuid
  manager_id: uuid
}
```

### Payments

#### `mpesa-callback`
Handles M-Pesa payment callbacks.

```typescript
POST /functions/v1/mpesa-callback?secret=<callback_secret>
Body: M-Pesa callback payload
```

#### `mpesa-stk-push`
Initiates M-Pesa STK Push payment.

```typescript
POST /functions/v1/mpesa-stk-push
Headers: Authorization: Bearer <token>
Body: {
  phone: string
  amount: number
  invoice_id: uuid
  account_reference: string
}
```

#### `stripe-webhook`
Handles Stripe webhook events.

```typescript
POST /functions/v1/stripe-webhook
Headers: Stripe-Signature
Body: Stripe webhook payload
```

### Notifications

#### `send-receipt`
Sends payment receipt via email/SMS.

```typescript
POST /functions/v1/send-receipt
Headers: Authorization: Bearer <token>
Body: {
  payment_id: uuid
  recipient_email: string
  recipient_phone?: string
}
```

#### `send-reminder`
Sends payment reminder notifications.

```typescript
POST /functions/v1/send-reminder
Headers: Authorization: Bearer <token>
Body: {
  tenant_id: uuid
  invoice_id: uuid
  reminder_type: 'email' | 'sms' | 'both'
}
```

### Administration

#### `bootstrap-webhost`
Bootstraps first webhost account.

```typescript
POST /functions/v1/bootstrap-webhost
Body: {
  secret: string
  email: string
}
```

#### `log-activity`
RPC function for logging activities (use instead of direct inserts).

```typescript
SELECT log_activity(
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_entity_label text DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_manager_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid
```

## Common Operations

### Query Data

```typescript
// Get all properties for a manager
const { data, error } = await supabase
  .from('properties')
  .select('*')
  .eq('manager_id', userId)

// Get tenant with unit and property details
const { data, error } = await supabase
  .from('tenants')
  .select(`
    *,
    units (
      *,
      properties (*)
    )
  )
  .eq('user_id', userId)
```

### Insert Data

```typescript
// Create new property
const { data, error } = await supabase
  .from('properties')
  .insert({
    address: '123 Main St',
    city: 'Nairobi',
    property_type: 'apartment',
    units_count: 10,
    manager_id: userId
  })
  .select()
```

### Update Data

```typescript
// Update tenant status
const { data, error } = await supabase
  .from('tenants')
  .update({ status: 'active' })
  .eq('id', tenantId)
  .select()
```

### Delete Data

```typescript
// Delete property
const { error } = await supabase
  .from('properties')
  .delete()
  .eq('id', propertyId)
```

### Real-time Subscriptions

```typescript
// Subscribe to payment updates
const subscription = supabase
  .channel('payments')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'payments'
  }, (payload) => {
    console.log('Payment changed:', payload)
  })
  .subscribe()
```

## Error Handling

All API responses follow Supabase error format:

```typescript
interface SupabaseError {
  message: string
  details?: string
  hint?: string
  code: string
}
```

Common error codes:
- `PGRST116` - No rows returned
- `23505` - Unique violation
- `23503` - Foreign key violation
- `42501` - Insufficient privilege (RLS)

## Rate Limiting

Edge functions have rate limiting implemented:
- Standard functions: 100 requests/minute
- Sensitive functions: 10 requests/minute
- Fail-open for non-critical functions
- Fail-closed for payment/auth functions

## Security

- All tables have Row Level Security (RLS) enabled
- Authentication required for all operations
- Service role key for server-side operations only
- Webhook secrets for callback validation
- Input validation via Zod schemas

## Pagination

Use Supabase's built-in pagination:

```typescript
const { data, error } = await supabase
  .from('properties')
  .select('*')
  .range(0, 9) // First 10 items
  .order('created_at', { ascending: false })
```

## Filtering & Sorting

```typescript
const { data, error } = await supabase
  .from('tenants')
  .select('*')
  .eq('status', 'active')
  .gte('lease_start', '2024-01-01')
  .order('created_at', { ascending: false })
```

## Full-Text Search

```typescript
const { data, error } = await supabase
  .from('properties')
  .select('*')
  .textSearch('address', 'nairobi')
```

## Aggregations

```typescript
const { data, error } = await supabase
  .from('payments')
  .select('amount')
  .gte('created_at', '2024-01-01')
```

Then aggregate in application code or use database views.

## Database Views

### `tenant_summary`
Aggregated tenant information with payment status.

### `property_occupancy`
Property occupancy rates and revenue metrics.

### `manager_dashboard`
Manager-specific dashboard metrics.

## RPC Functions

### `validate_invitation_token`
Validates tenant invitation tokens.

```typescript
SELECT validate_invitation_token(token) AS valid
```

### `calculate_invoice_amount`
Calculates invoice amount with discounts and charges.

```typescript
SELECT calculate_invoice_amount(invoice_id) AS amount
```

## Storage Buckets

### `maintenance-photos`
Public bucket for maintenance request photos.

### `tenant-photos`
Public bucket for tenant profile photos.

### `condition-photos`
Public bucket for property condition photos.

### `documents`
Private bucket for legal documents and contracts.

## Webhooks

### M-Pesa Callback
```
https://aelzsqxllkypbzslxyju.supabase.co/functions/v1/mpesa-callback?secret=<secret>
```

### Stripe Webhook
```
https://aelzsqxllkypbzslxyju.supabase.co/functions/v1/stripe-webhook
```

## Environment Variables

See `.env.example` for complete list of required environment variables.

## Testing

Use the test accounts in AGENTS.md for API testing:
- Manager: jimmythemugo@gmail.com / CALQULUS RMS@2026!
- Tenant: kamauwamakena@gmail.com / CALQULUS RMS@2026!
- Webhost: mugo.james27@gmail.com / CALQULUS RMS@2026!

## Support

For API issues, check:
1. Supabase Dashboard logs
2. Edge Function logs
3. Browser console errors
4. Network tab in DevTools
