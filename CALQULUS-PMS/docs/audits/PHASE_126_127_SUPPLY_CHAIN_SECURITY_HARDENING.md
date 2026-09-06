# Phases 126–127 — Supply-Chain Security Hardening

## Phase 126 — SBOM & Vulnerability Governance
Added a deterministic CycloneDX 1.5 SBOM generated from the committed npm lockfile, a reproducibility audit, and a vulnerability-governance policy. CI executes `npm audit --audit-level=high`; repository-only runs never fabricate vulnerability results when registry access is unavailable.

## Phase 127 — Secret/Credential Supply-Chain Scanning
Added a repository secret scanner covering private keys, provider tokens, cloud access keys and JWT-like credentials while excluding dependency/build directories and its own generated report. Findings fail the gate and the scanner does not treat ordinary variable names as secrets.

## Release gate
The CI release-integrity workflow now requires dependency provenance, SBOM integrity, secret scanning, vulnerability governance, npm high-severity audit, and signed release-manifest integrity before its repository gate passes.
