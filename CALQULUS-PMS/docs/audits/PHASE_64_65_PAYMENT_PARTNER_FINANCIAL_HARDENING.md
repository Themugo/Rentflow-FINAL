# Phases 64–65 — Payment Partner & Loan Financial Hardening

## Phase 64
The webhost payment-processing provider lifecycle previously used direct browser `UPDATE` calls. The provider table is now explicitly represented in migrations, RLS is enabled, reads are limited to webhosts, and status changes go through `transition_payment_processing_atomic()` with row locking and server-side validation. Direct authenticated/anonymous writes are revoked.

## Phase 65
Loan applications are now explicitly represented in migrations and their creation/status transitions are atomic RPCs. Amount, term, rate and portfolio authorization are validated server-side. Manager transitions are restricted to properties in the manager's portfolio; webhost retains platform-wide control. Direct authenticated/anonymous writes are revoked.

## Verification
Static SQL and source checks are performed before packaging. Live Supabase execution is not claimed because no live database connection is available in this environment.
