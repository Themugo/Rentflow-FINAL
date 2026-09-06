# Security Regression Matrix

The matrix is the release-security control plane for repository-local security checks. It is fail-closed for `FAIL` and `UNKNOWN` results and preserves `EXTERNAL_REQUIRED` for infrastructure-dependent evidence.

## Baseline / diff
`capture:security-regression-baseline` stores a reviewed matrix snapshot. `audit:security-regression-diff` compares the current matrix with that snapshot and blocks any regression from `PASS` to `FAIL` or `UNKNOWN`.

Baseline capture must only be performed after the matrix has been reviewed. External-required checks remain external-required in the baseline.
