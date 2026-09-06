# CALQULUS PMS — Agency + Property Manager End-to-End Security Sweep

## Scope
Clean sweep of Agency and Property Manager route domains, payment authority, delegated submanager authority, management mandates, physical receipt capture, and cross-portal boundaries. The objective is to prevent unauthorized money movement, duplicate payment engines, and cross-role data exposure while preserving existing architecture.

## Verified foundation
- Agency and Manager remain distinct role route domains.
- Agency contract/service capability controls Agency operational and collection actions.
- Agency payment evidence is reviewed atomically and feeds the canonical payment lifecycle.
- Manager management mandates provide the explicit owner-vs-manager collection boundary.
- Submanager payment recording now requires the existing `submanager_permissions.can_record_payments` and assigned-property boundary.
- Physical receipts are guarded by the same manager collection authority before money-representing documents are created.
- The existing payment lifecycle was renamed to an internal core and wrapped; no second payment engine or parallel allocation ledger was introduced.

## Money-loss controls
1. Positive payment amount remains mandatory.
2. Tenant/invoice ownership is checked by the canonical payment lifecycle.
3. Concurrent tenant/reference callbacks remain serialized by the existing advisory lock.
4. Existing transaction IDs remain ownership-checked and idempotent.
5. Invoice rows remain locked before allocation.
6. Advance balances continue through the existing tenant credit ledger.
7. Manager collection is denied when an active management mandate explicitly reserves collections for the owner.
8. Submanagers cannot record payments unless the existing permission flag and property assignment allow it.
9. Physical receipt capture cannot bypass the manager mandate.
10. Agency collection remains governed by Agency service/contract capability rather than the independent-manager mandate.

## Data-leak controls
- No new tenant/property source of truth was created.
- Existing Agency and Manager route domains remain separate.
- Management mandate records remain readable only to the manager and enabled owner.
- Mutation surfaces remain RPC/trigger controlled rather than client-direct.
- Cross-portal redirects continue to prevent role users from entering another role's operational portal.

## Remaining validation before production
Run the repository's full test suite, TypeScript typecheck, production build, and Supabase migration validation/apply against the target environment. This source-level sweep does not constitute live production certification.
