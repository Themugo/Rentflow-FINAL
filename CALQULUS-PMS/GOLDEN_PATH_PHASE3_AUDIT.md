# CALQULUS Golden Path — Phase 3 Audit

## Scope
Invoice creation integrity after atomic lease creation.

## Changes
- Added `invoices.generation_key` with a unique partial index.
- Added `public.create_invoice_atomic(...)` as the canonical tenant-invoice write path.
- Invoice creation validates lease, tenant, property and manager ownership inside one transaction.
- Invoice and line-item writes are atomic.
- Repeated generation with the same key is idempotent and returns the existing invoice.
- `generate-monthly-invoices` now uses the atomic RPC.
- `auto-generate-invoices` is now only a scheduled compatibility wrapper; it no longer contains a second invoice-generation implementation.
- Manager-triggered monthly generation is scoped to the authenticated manager; scheduled service calls process all managers.

## Redundancy audit
- Removed duplicate monthly generation implementation from `auto-generate-invoices`.
- Kept penalty, platform subscription and other invoice types separate because they represent distinct business domains.
- Existing `reconcile-bank` status-only payment writes remain outside Phase 3 and are explicitly queued for the payment-integrity phase.

## Test gate
Static regression test: required checks are present.
Full Vitest/build/Supabase execution depends on installed project dependencies and a Supabase/Postgres runtime.

## Phase 3 exit criteria
- [x] Canonical invoice creation path identified.
- [x] Idempotency enforced at database level.
- [x] Invoice + line items atomic.
- [x] Manager scope corrected.
- [x] Duplicate monthly generator removed.
- [x] Regression specification added.
- [ ] Live Supabase migration replay and RPC transaction test.
- [ ] Full npm verify on a network-enabled environment.
