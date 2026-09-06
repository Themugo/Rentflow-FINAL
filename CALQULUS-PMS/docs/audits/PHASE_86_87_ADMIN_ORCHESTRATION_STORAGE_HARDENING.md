# CALQULUS PMS — Phases 86–87 Hardening Audit

## Phase 86 — Administration, Settings & Orchestration Mutation Convergence

The latest Phase 84–85 package contained several source-level direct mutations even though earlier phase summaries expected them to have been converged. Phase 86 reconciles the actual package state.

### Server-authorized mutation layer

Added/reinstated a single migration:

- `supabase/migrations/20260903000051_phase86_administration_orchestration_convergence.sql`

It provides atomic RPCs for:

- manager bank details
- manager e-wallet settings
- company/organization settings and agency synchronization
- receipt settings
- submanager provisioning, permissions, assignments and removal
- workflow templates, instances, steps and automations
- utility connections and utility bills
- profile settings
- webhost subscription-tier price changes
- manager notification channel/topic settings

Direct authenticated/anonymous writes are revoked on the corresponding protected tables. Authorization is derived from the authenticated session and server-side manager, organization or platform-admin relationships.

### UI/API convergence

Converted residual direct mutations in:

- manager settings and branding
- submanager administration
- workflow orchestration API
- utility provider API
- webhost tier pricing
- manager notification settings
- manager onboarding
- agency onboarding
- landlord onboarding
- profile settings

### Schema mismatch repaired

`manager_notification_settings` previously had UI fields for push/topic preferences that were absent from the base table definition. Phase 86 adds those columns with safe defaults and persists them through the RPC.

## Phase 87 — Storage Namespace & Relationship Hardening

Added:

- `supabase/migrations/20260903000056_phase87_storage_path_hardening.sql`

The migration removes historical broad storage write/read policies and establishes scoped policies for:

- `property-images`
- `contracts`
- `signed-contracts`
- `profile-photos`
- `company-logos`

The property-image write namespace now distinguishes manager-owned property-form uploads and unit media. Contract uploads are restricted to manager-contract/signature namespaces. Signed lease documents are tied to the tenant namespace and manager/submanager relationship.

The three previously public image buckets are explicitly forced private in the final migration state.

The generic `ImageUpload` component now stores `bucket/path` storage references rather than public URLs, allowing the existing signed-URL display layer to protect private objects.

## Verification

- `npm run audit:prod`: **PASS**
- Phase 86/87 custom static audit: **PASS**
- Protected application direct-mutation scan: **0 violations**
- Required Phase 86 RPC presence: **10 checked / 10 present**
- Required Phase 87 storage policies: **6 checked / 6 present**
- SQL dollar-quote structural check: **PASS**
- `npm run typecheck:app`: **BLOCKED by existing missing project dependencies** (`react`, React Query, router, Capacitor typings, etc.)
- `npm test`: **BLOCKED** (`vitest` is not installed in the provided environment)
- `npm run build`: **BLOCKED** (`vite` is not installed in the provided environment)
- No live Supabase database was available, so migrations were structurally audited but not executed against production.

## Remaining known follow-up

Historical public-style policy warnings reported by the production audit remain outside the Phase 86–87 target surface. Edge functions `accept-admin-invitation` and `send-admin-invitation` also lack explicit `config.toml` entries and remain a future edge-auth hardening target.
