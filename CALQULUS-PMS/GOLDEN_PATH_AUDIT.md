# CALQULUS Golden Path Audit — Pass 1

Date: 2026-09-02

## Scope
Manager → Property → Unit → Tenant → Lease → Invoice → Payment.

## Pass 1 findings/fixes

### Fixed: tenant account ownership spoofing
`create-tenant-account` no longer trusts a client-supplied `manager_id` for authenticated manager/agency/submanager callers. The effective owner is derived from the authenticated caller (or the submanager's assigned manager), and a supplied property is checked against that owner before service-role writes occur.

### Fixed: existing role corruption
`create-tenant-account` no longer attaches `tenant_id` to an arbitrary existing `user_roles` row. Existing non-tenant accounts are rejected; an existing tenant role is only linked when it is actually a tenant role and is not already attached to another tenant record.

### Fixed: invitation email mismatch during user creation
When claiming an invitation, the server-resolved invitation email is now used when creating the auth user.

### Fixed: property billing invoice scope
Invoices created from a property billing tab now persist `property_id` and `unit_id` when available. Lease queries were expanded to carry these IDs.

### Fixed: manual "Mark Paid" bypass
Property-level `Mark Paid` no longer directly changes `invoices.status`. It now uses the existing atomic payment recording path (`record-payment` through `useMarkInvoicePaid`) so payment transactions, allocations, balances, receipts and audit behavior remain consistent.

## Remaining verification

The following require a live Supabase/staging environment to prove end-to-end:

1. Manager registration/approval.
2. Property creation and unit creation.
3. Tenant creation/invitation.
4. Lease creation and activation.
5. Invoice creation.
6. Manual payment recording.
7. M-Pesa STK + callback.
8. Invoice allocation/balance/receipt consistency.
9. Cross-manager RLS isolation.
10. Submanager permission isolation.

## Important architectural observation

The current frontend lease creation sequence performs multiple writes (lease, tenant sync, unit sync, payment-detail sync) independently. This is still a transaction-boundary risk and should be converted to a server-side atomic workflow after the live schema is verified.
