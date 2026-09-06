# CALQULUS PMS — Phases 76–77 Hardening Audit

## Phase 76 — Manager settings
- Bank details save/delete/default now use SECURITY DEFINER RPCs with auth-derived manager ownership.
- E-wallet settings use an atomic manager-owned RPC with property/unit/provider scope.
- Company settings and agency profile synchronization use one manager-authorized RPC.
- Receipt settings use a manager-authorized RPC.
- Organization Brand Studio company mutations converge through the company RPC.
- Direct authenticated/anon writes are revoked for protected settings tables.

## Phase 77 — Submanager administration
- Submanager provisioning, permissions, property assignments, and removal use SECURITY DEFINER RPCs.
- Manager ownership and property portfolio membership are enforced server-side.
- User-role assignment for submanagers is performed inside the provisioning/removal transaction.
- Direct authenticated/anon writes are revoked for submanager tables and `user_roles`.

## Verification
- Static RPC reference scan: pending final packaging check.
- SQL dollar-quote/function checks: pending final packaging check.
- Production audit: run when dependencies are available.
- TypeScript/Vitest/Vite may remain blocked by the repository's incomplete dependency installation, consistent with prior phases.
- No live Supabase database was available, so migrations are structurally reviewed only.
