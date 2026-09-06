# CALQULUS PMS — Phase 47–48 Mutation Convergence Audit

## Phase 47 — Tenant Portal Mutation Convergence

Tenant-originated writes were moved behind `SECURITY DEFINER` RPCs with server-side ownership checks for:

- notification preferences
- tenant profile updates (reusing the existing lifecycle RPC)
- reference requests
- lease-renewal responses + acknowledgement
- vacation notices, signatures and uploaded-document attachment
- tenant pet and vehicle registration
- tenant notice acknowledgement/dispute
- tenant message read state
- tenant notification read/dismiss actions
- tenant condition-photo records

Direct authenticated `INSERT/UPDATE/DELETE` was revoked for the tenant-owned portal mutation tables covered by this phase.

## Phase 48 — Contracts, Leases & Tenancy State

The existing manager-side lease/contract lifecycle RPCs remain authoritative. Tenant-side contract signature and signed-document attachment were added as dedicated ownership-checked RPCs so tenants cannot mutate contract fields directly.

Existing `transition_lease_atomic` and manager contract lifecycle RPCs were not duplicated.

## Verification

- `npm run audit:prod`: **PASS**
- Targeted tenant-portal direct mutation scan for protected tables: **PASS — 0 direct mutations found**
- Migration RPC structural check: **PASS — 15 functions / 15 execute grants**
- TypeScript/TSX delimiter balance: **PASS**
- `npm test`: **BLOCKED** — `vitest` is not installed in the available dependency set
- `npm run typecheck`: **BLOCKED** — repository dependencies/types are incomplete in this environment (React JSX/types and native packages are missing)
- `npm run build`: **BLOCKED** — `vite` is not installed in the available dependency set
- Live Supabase migration execution: **NOT RUN** — no connected production/staging database was available in this workspace

## Important deployment note

Apply the migration to staging first and run the tenant portal flows end-to-end before production. In particular verify tenant role mapping in `user_roles`, contract signing status rules, vacation notice storage paths, and notification RLS.
