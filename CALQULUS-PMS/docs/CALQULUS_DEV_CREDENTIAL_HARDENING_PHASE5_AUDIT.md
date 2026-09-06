# CALQULUS PMS — Phase 5 Development Credential Hardening Audit

## Scope
Remove committed development/demo authentication credentials from frontend source and test scripts while preserving the existing no-login development workflow.

## Changes
- `src/features/auth/lib/devAccess.ts`
  - Removed hardcoded email/password pairs.
  - Development presets now load only from local environment variables.
  - Generic `VITE_DEV_ACCESS_EMAIL/PASSWORD` overrides remain supported.
  - Production builds always expose zero preset accounts.
- `src/shared/components/DevPortalSwitcher.tsx`
  - Reuses the canonical `DEV_PRESET_ACCOUNTS` source instead of maintaining a duplicate credential list.
  - Presentation metadata remains local to the switcher.
- `.env.example`
  - Documents portal-specific development credential variables without real values.
- `scripts/test-demo-auth.mjs`
  - Demo authentication checks now require environment-provided credentials.

## Static security checks
- No production-bundled frontend source contains the former development password literals.
- Dev switcher contains no duplicate credential store.
- Production guard remains enforced by `isDevAccessEnabledFromEnv`.
- Generic development access remains opt-out with `VITE_ENABLE_DEV_ACCESS="false"`.

## Runtime verification
The repository currently has no installed `node_modules`, so npm-based lint/test/build execution remains dependency-blocked in this workspace. Static source verification was run for this phase.

## Additional source hygiene
- Replaced a hardcoded project-specific Supabase URL in `src/test/adminDesk.test.ts` with a neutral test URL.
- Utility scripts now require `SUPABASE_URL`/`VITE_SUPABASE_URL` instead of embedding the project URL.
