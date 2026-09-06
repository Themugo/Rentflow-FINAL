# Phase 130–131 Runbook

1. Run `npm run audit:runtime-update-policy`.
2. Run `npm run audit:security-regression-matrix`.
3. After a reviewed security state, run `npm run capture:security-regression-baseline` and commit the baseline.
4. On subsequent releases run `npm run audit:security-regression-diff`.
5. In CI, enable registry-backed runtime checks and `npm audit --audit-level=high`.
6. Never replace `EXTERNAL_REQUIRED` with a manual PASS; provide real staging/production evidence instead.
