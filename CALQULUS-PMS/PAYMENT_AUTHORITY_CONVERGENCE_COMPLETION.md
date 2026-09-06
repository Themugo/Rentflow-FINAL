# CALQULUS PMS — Payment Authority Convergence Completion

## Objective

Make `payment_collection_accounts` the single operational source of truth for payment destinations shown to occupants and used by payment initiation and automated payment prompts.

## Completed

- Added configurable `account_reference` to canonical collection accounts.
- Added management read RLS for managers/submanagers, linked landlords and active agency members.
- Hardened the payment-save RPC while preserving unit/property/agency hierarchy.
- Added `get_tenant_payment_routes()` so an authenticated tenant receives payment destinations for every active unit/lease.
- Tenant payment details no longer read legacy `manager_mpesa_settings` as a payment-destination fallback.
- Tenant payment destinations are resolved from the same hierarchy used by invoices, prompts and STK.
- Unit configuration remains highest priority; property, agency, landlord and manager remain fallbacks.
- STK account reference now uses the configured canonical account reference, falling back to unit number.
- Tenant route resolution works even when a unit has not yet received an invoice.

## Verification

`PAYMENT_AUTHORITY_CONVERGENCE_AUDIT=PASS`

Validated:

- canonical account reference field
- management RLS
- tenant route RPC
- tenant authorization
- canonical hierarchy resolution
- tenant UI uses canonical route RPC
- legacy manager M-Pesa destination fallback removed
- STK canonical account reference
- migration structural balance

Full TypeScript/Vitest/build verification remains environment-limited when dependencies are absent from the recovered working package. No unavailable test suite is represented as passing.
