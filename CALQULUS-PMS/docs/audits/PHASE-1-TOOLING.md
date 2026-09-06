# PHASE 1 — Clean Build, Tooling & Dependency Certification

> Date: 2026-08-22 · Base commit: `a162d06` (post-Phase-0)
> Rule compliance: no business functionality changed; only tooling/dependency hygiene.

## Completion Gate — ALL PASS (executed, not claimed)

| Command | Result |
|---|---|
| `npm ci` (from deleted `node_modules`) | **PASS** — reproducible clean install |
| `npm run typecheck` (`tsc --noEmit` app + node) | **PASS** — 0 errors |
| `npm run lint` | **PASS** — 0 errors, 11 warnings |
| `npm run build` | **PASS** |
| `npx vitest run` | **PASS** — 904 passed, 1 skipped (80 files) |
| `npm audit --audit-level=high` (CI gate) | **PASS** — 0 high/critical |

## Changes Made

1. **Removed orphaned `src/shared/contexts/NetworkContext.tsx` (265 lines).**
   Rule 2 proof before deletion: not imported by any file (grep over `src`, `e2e`,
   `scripts`, `supabase/functions`), not routed (`src/app/routes.ts`), not referenced
   by tests or Edge Functions. Its only import was `@capacitor/network`.
2. **Uninstalled unused dependency `@capacitor/network`** (sole consumer was the
   orphaned file above). All other Capacitor packages verified in use:
   `@capacitor/core` + `capacitor-native-biometric` (via `biometricService.ts` →
   `useBiometricAuth.ts` → Auth/TenantLogin/LandlordAuth/TenantProfile pages),
   `@capacitor/cli` (type import in `capacitor.config.ts`).
3. **Removed empty `bun.lock` (0 bytes).** No bun usage anywhere in CI, scripts,
   or docs; npm is the canonical package manager (`package-lock.json`).
4. **`npm audit fix`** applied — lockfile refreshed.

## Verification Results

- `npm ci` → `typecheck` → `lint` → `build` → `vitest`: all pass after changes.
- CI/local parity confirmed: workflows use only `npm ci` + existing npm scripts
  (`lint`, `typecheck`, `build`, `verify`, `audit:prod`, `smoke:deploy`, `test:e2e*`).
  `npm install` in CI is used only for global tooling (`vercel`, `cyclonedx-npm`)
  and a `--package-lock-only` refresh in security-scan — legitimate.
- All npm scripts referenced by CI exist in `package.json`. ✔

## Remaining Issues (documented, intentionally deferred)

| Issue | Severity | Disposition |
|---|---|---|
| `uuid <11.1.1` moderate vuln via `@capacitor/cli` → `xcode` | Moderate | **Accepted risk.** Mobile build toolchain only — never shipped in the browser bundle or executed in production. Fixing requires `npm audit fix --force` to a nightly CLI — destabilizing. CI gate (`--audit-level=high`) passes. Revisit in Phase 18 (mobile) when Capacitor is next touched. |
| 11 ESLint `react-hooks/exhaustive-deps` warnings | Low | Behavior-affecting; deferred to Phase 11 (error handling) / Phase 13–14 where the owning components are touched. |
| `inlineDynamicImports` deprecation warning in build | Low | Emitted by `vite-plugin-pwa` internals (injectManifest), not our config. Track upstream; no action available in-repo. |
| `.env.example` drift (6 referenced vars missing, 3 listed vars unreferenced) | High | Deferred to **Phase 19** (Environment & Secrets Certification) as assigned by the blueprint. Recorded in BASELINE.md §5. |
| `@capacitor/android`, `@capacitor/ios`, `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/local-notifications`, `@capacitor/push-notifications` have no `src` imports | Low | **Kept intentionally** — Capacitor platform/plugin packages are consumed by the native build toolchain, not by JS imports. To be revalidated in Phase 18 (PWA/Mobile). |

## Deferred to Later Phases (per blueprint ownership)

- `@ts-nocheck` (73) / `any` (457) → Phase 10
- Large components → Phase 14
- Duplicate contract components → Phase 13
- E2E execution → Phase 16 (blocked: browsers + credentials)

## Certification Statement

The repository is **reproducibly buildable** from a clean environment. Phase 1 gate met.
