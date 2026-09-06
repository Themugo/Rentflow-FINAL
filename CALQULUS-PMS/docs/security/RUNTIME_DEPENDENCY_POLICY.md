# Runtime Dependency Governance Policy

## Purpose

Keep CALQULUS PMS runtime dependencies reproducible, reviewable, and safe to promote.

## Mandatory controls

1. `package-lock.json` must remain npm lockfile version 3 and be committed with dependency changes.
2. Every direct production dependency must resolve through the committed lockfile.
3. Git, file, link, or custom registry dependencies require explicit security review before release.
4. Install lifecycle scripts (`preinstall`, `install`, `postinstall`) require review because they execute code during installation.
5. High/critical dependency vulnerabilities block CI unless remediated or formally waived with an owner and expiry date.
6. Major runtime dependency updates require compatibility review and regression evidence.
7. Minor/patch updates should be refreshed routinely, but update availability is registry-dependent and must never be fabricated offline.
8. Dependency reports must contain no credentials or registry tokens.

## Evidence model

Repository-side checks prove lockfile/provenance integrity. Registry-backed `npm outdated` and `npm audit` are authoritative only when run against the configured npm registry in CI or an approved connected environment.

An offline packaged workspace must report `EXTERNAL_REQUIRED` for registry-dependent evidence rather than claiming a false pass.
