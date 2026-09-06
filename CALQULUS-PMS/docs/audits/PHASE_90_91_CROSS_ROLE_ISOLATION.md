# Phase 90–91 Cross-Role Isolation Hardening

## Phase 90
- Tenant self-registration moved to `self_register_tenant_atomic`.
- Authenticated email and identity are derived server-side from `auth.uid()`.
- Tenant, tenant role, profile and transfer-log creation are transactional.
- Fixed tenant dispute authorization to compare the supplied tenant record against `user_roles.tenant_id`, not the auth user UUID.
- Corrected invoice-email role boundary from legacy `host` to canonical `webhost`.

## Phase 91
- Added `scripts/cross-role-isolation-audit.mjs` and `npm run audit:cross-role`.
- Static checks cover protected edge mutations, explicit authentication/service-role gates, and anonymous execution of sensitive RPCs.
- The audit is deterministic and does not require a live Supabase project.

## Verification
- Cross-role audit: PASS
- Production audit: expected to remain structurally valid
- SQL structure: checked
- TypeScript/Vitest/Vite: environment-dependent and not claimed unless dependencies are installed
- Live migration execution: not available in this session
