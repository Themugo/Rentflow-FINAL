# CALQULUS MASTER BRAND IDENTITY & NAVBAR/FOOTER STANDARDIZATION — Audit Report

**Date:** 2026-08-22
**Mandate:** One unified CALQULUS visual identity across the whole system. No app rebuild, no duplicate components, no second design system, no business-logic/route/auth changes.

## Phase A — Audit findings

| Surface | Canonical component | Status before |
|---|---|---|
| App sidebar | `src/shared/components/layout/Sidebar.tsx` | ONE component, but light/surface background |
| App header | `src/shared/components/layout/Header.tsx` | ONE component (rendered via `Layout.tsx`), white top bar |
| Marketing header | `PublicHeader.tsx` (only via `PublicShell`) | ONE component |
| Marketing footer | `PublicFooter.tsx` (only via `PublicShell`) | ONE component |
| App footer | `layout/Footer.tsx` (via `Layout.tsx`) | ONE component, compact variant |
| Logo/wordmark | `shared/components/branding/BrandMark.tsx` | ONE component; `inverse` variant already existed |
| Portal accent | `[data-portal]` → `--portal-accent` | landlord = success green, agency = warning amber (status colors used as brand) |
| Shell preview | `AuthenticatedShellPreview.tsx` | Light sidebar with per-portal accent fills, drifted from live chrome |
| `layout/Header.tsx` orphan? | Rendered by `Layout.tsx` line 96 | NOT orphaned — confirmed single renderer |

### Hardcoded brand-color sweep
- Arbitrary hex Tailwind utilities: **none** in `src`.
- Inline `style` hex in `chart.tsx`: recharts **selector strings** (`[stroke='#ccc']`) — classified DATA, not brand.
- Inline `style` hex in `PropertyCollectionStatement.tsx`: financial statement **cell-highlight semantics** (arrears/vacant/zebra striping of a ledger) — classified DATA, not brand.

## Changes applied (brand identity enforcement)

1. **App sidebar → CALQULUS navy chrome** (`src/index.css`): `--sidebar-*` tokens now resolve to `--calqulus-navy-950` background, `--calqulus-text-on-navy` / `--calqulus-text-on-navy-muted` text, `--calqulus-navy-800` accent/border, `--calqulus-primary-light` ring. One chrome for every portal — no per-portal sidebar systems.
2. **Sidebar selected state → unmistakable blue wash** (`src/core/design/deskNav.ts`): `SIDEBAR_NAV_ACTIVE = bg-primary/85 text-primary-foreground`. Idle = slate-on-navy with navy-800 hover. Portal color stays on the 2px `PortalAccentBar` stripe only.
3. **BrandMark inverse on navy** (`Sidebar.tsx`): brand wordmark stays readable on navy chrome.
4. **Portal accents use blue/navy family, never status colors**: landlord `success green → info blue (#3E6FAE)`, agency `warning amber → navy-600 (#426B94)`. Updated in `src/index.css` `[data-portal]` and `src/shared/theme/tokens.ts` (`CALQULUS_PORTAL_ACCENT`, added `CALQULUS_COLOR.navy600`). Manager stays primary blue; tenant slate-navy; platform_admin navy-600.
5. **Design-preview shell mirror realigned** (`AuthenticatedShellPreview.tsx`): same navy chrome + blue active state as the live sidebar; primary CTA uses the standard `Button` (no inline accent fills).
6. **Test contracts updated** (`designTokens.test.ts`, `productPolish.test.ts`): assert the new portal accents and navy-rail selected state.

## What was deliberately NOT done

- No redesign of page content, dashboards, routes, or homepage.
- No new components; no second design system; no business-logic changes.
- PublicHeader/PublicFooter and the app Header/Footer remain single canonical implementations (light surfaces, token-driven) — they already comply.
- Status colors (green/amber/red) stay exclusively semantic (success/warning/danger).

## Verification

- `npx tsc --noEmit` — PASS
- `npx eslint src` — 0 errors
- `npx vitest run` — 952 passed, 1 skipped (81 files)
- `npm run build` — exit 0
- `npx playwright test e2e/a11y.spec.ts` (chromium + webkit) — 11 passed each
- `npx playwright test e2e/shell-preview.spec.ts e2e/design-preview.spec.ts` — 24 passed
- Visual spot-check of design-preview shell (manager + tenant): navy sidebar, slate-on-navy idle text, blue selected wash, white content surface, no contrast regressions.
