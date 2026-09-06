# CALQULUS PMS Phase 37–38 Audit

## Phase 37
Unit charge configuration mutations now use database RPCs with portfolio ownership, unit locking, amount and billing-cycle validation, and direct authenticated write revocation.

## Phase 38
Core contracts, contract templates, and webhost manager contracts now use lifecycle RPCs with ownership/role validation, status guards, template default serialization, and direct authenticated write revocation.

## Verification
Static mutation scans and `npm run audit:prod` are the available runtime checks in the dependency-free environment. Vitest/lint/typecheck/build require the repository workspace dependencies and are not claimed here when unavailable.
