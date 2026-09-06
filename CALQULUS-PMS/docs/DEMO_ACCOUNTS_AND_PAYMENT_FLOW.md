# Demo Accounts, RBAC, and Payment Flow

This runbook defines role access, demo logins, and end-to-end payment checks.

## Role dashboards and RBAC

- `webhost` -> `/webhost` (platform-wide control: managers, settings, billing, governance)
- `manager` -> `/` (manager dashboard and full managed portfolio operations)
- `agency` -> uses `submanager` role with agency-scoped permissions -> `/submanager`
- `landlord` -> `/landlord/dashboard` (owner view and landlord-team controls)
- `tenant` -> `/portal` (tenant dashboard: invoices, payments, notices, profile)

## Demo login accounts (public demo mode)

Public demo accounts are shown in `LandlordAuth` when `VITE_ENABLE_PUBLIC_DEMO=true`.

- Manager: `demo.manager@calqulusrms.com` / `Demo@2026`
- Tenant (linked): `demo.tenant1@calqulusrms.com` / `Demo@2026`
- Tenant (linked): `demo.tenant2@calqulusrms.com` / `Demo@2026`
- Tenant (orphan): `demo.tenant3@calqulusrms.com` / `Demo@2026`
- Landlord: `demo.landlord@calqulusrms.com` / `Demo@2026`
- Agency/Agent (submanager): `demo.agent@calqulusrms.com` / `Demo@2026`

## Webhost login procedure

1. Open `/webhost/login` from any domain (local or production).
2. Sign in with a user that has `webhost` role in `user_roles`.
3. If no webhost exists yet, bootstrap one:
   - Run edge function `bootstrap-webhost` with your bootstrap secret.
   - Or insert role manually in SQL:
     - `INSERT INTO public.user_roles (user_id, role, approval_status) VALUES ('<USER_UUID>', 'webhost', 'approved');`
4. Successful login redirects to `/webhost`.

## Internal test credentials (non-public)

- Manager: `jimmythemugo@gmail.com` / `CALQULUS RMS@2026!`
- Tenant: `kamauwamakena@gmail.com` / `CALQULUS RMS@2026!`
- Webhost: `mugo.james27@gmail.com` / `CALQULUS RMS@2026!`

## Payment flow test matrix (M-Pesa)

### Prerequisites

- M-Pesa secrets configured in Supabase:
  - `MPESA_CONSUMER_KEY`
  - `MPESA_CONSUMER_SECRET`
  - `MPESA_PASSKEY`
  - `MPESA_SHORTCODE`
  - `MPESA_CALLBACK_SECRET`
  - `MPESA_ENV`
- Callback URL registered:
  - `https://<PROJECT_REF>.supabase.co/functions/v1/mpesa-callback?secret=<MPESA_CALLBACK_SECRET>`
- Email/SMS providers configured (`RESEND_API_KEY`, `AFRICASTALKING_API_KEY`, etc.) if delivery verification is required.

### Scenario A: Tenant pays -> landlord receives

1. Set property operating model to `manager_operates_landlord_collects` or `agency_manages_fee_from_landlord`.
2. Confirm `payment_destination = 'landlord'`.
3. Configure landlord M-Pesa settings for that property.
4. Tenant pays invoice from `/portal` using M-Pesa.
5. Verify:
   - `payment_transactions.payment_receiver_type = 'landlord'`
   - invoice marked paid/partially paid
   - receipt email and SMS sent

### Scenario B: Tenant pays -> manager receives

1. Set operating model to `agency_collects_full_management` or `agency_collects_pays_landlord`.
2. Confirm `payment_destination = 'manager'`.
3. Configure manager M-Pesa settings for that property.
4. Tenant pays from `/portal`.
5. Verify:
   - transaction receiver = manager
   - payout/revenue share logic remains available for landlord settlement
   - receipt notifications delivered

### Scenario C: Tenant pays -> agency (submanager-managed portfolio)

1. Use agency account (`submanager`) with assigned property permissions.
2. Ensure manager account owns payment settings scope for that property.
3. Tenant pays from `/portal`.
4. Verify:
   - payment settled against correct property and invoice(s)
   - activity + receipt logs reflect agency-managed workflow

## End-to-end verification checklist

- Invite flow:
  - Landlord invite and acceptance
  - Tenant invite and acceptance
- RBAC:
  - each role blocked from unauthorized routes
  - submanager/agency restricted to assigned properties
- Payments:
  - single invoice payment
  - multi-invoice combined payment
  - callback reconciliation + receipt dispatch
