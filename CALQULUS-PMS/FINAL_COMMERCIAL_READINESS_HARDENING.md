# CALQULUS PMS — Final Commercial Readiness Hardening

## Completed

This pass closes the final source-level security/readiness defect found while preparing the current billing/payment initiative for market rollout.

### Cross-role isolation

The audit now explicitly recognizes the public tenant-shared-payment initiation flow as an intentionally anonymous endpoint whose authorization is provided by the opaque share token plus short-lived access grant and atomic server-side validation/consumption. The endpoint remains rate-limited and does not expose tenant identity before grant validation.

All other protected mutation patterns continue to require a visible authentication/service-role gate.

## Verification

- PROPERTY_TENANCY_OPERATIONS_AUDIT=PASS
- FINANCIAL_BILLING_OPERATIONS_AUDIT=PASS
- BILLING_DUE_PAYMENT_ROUTING_AUDIT=PASS
- UNIT_FIRST_MULTI_PAYER_AUDIT=PASS
- UNIT_FIRST_PAYMENT_RECEIPT_COMPLETION_AUDIT=PASS
- UNIT_PAYMENT_RECONCILIATION_AUDIT=PASS
- THIRD_PARTY_PAYER_PORTAL_AUDIT=PASS
- TENANT_SHARE_PAYMENT_LINK_AUDIT=PASS
- PAYMENT_CONFIGURATION_PRIVACY_DEVICE_SECURITY_AUDIT=PASS
- PAYMENT_AUTHORITY_CONVERGENCE_AUDIT=PASS
- FINAL_SECURITY_AUDIT=PASS
- CROSS_ROLE_ISOLATION_AUDIT=PASS

## Environment-limited checks

The full npm verification suite could not be executed because dependency restoration (`npm ci --ignore-scripts`) timed out in the isolated build environment. No unavailable test/build/lint result is represented as passing.

## Known release blockers requiring live environment evidence

1. The repository contains a pre-existing duplicate migration version `20260904000001` and requires reconciliation against `supabase_migrations.schema_migrations` before deployment.
2. Production/staging release evidence (commit, migration run, smoke run, restore run, production approval) cannot be fabricated locally and must be captured during the actual controlled release process.
