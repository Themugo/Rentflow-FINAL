# Runtime Dependency Update Policy

## Purpose
Prevent dependency upgrades from bypassing lockfile integrity, security review, or release evidence.

## Rules
1. `package-lock.json` is authoritative for reproducible installation and must remain lockfile v3.
2. Intentional dependency updates must change `package.json` and `package-lock.json` together.
3. Major-version updates require explicit review before production promotion.
4. Minor/patch updates still require CI dependency provenance, SBOM, secret-supply-chain, and vulnerability checks.
5. Git/file/link dependencies require explicit review and are not silently accepted as normal registry dependencies.
6. Registry freshness and vulnerability results are external evidence and must never be fabricated in an offline workspace.
7. A failed local policy audit blocks release certification.
