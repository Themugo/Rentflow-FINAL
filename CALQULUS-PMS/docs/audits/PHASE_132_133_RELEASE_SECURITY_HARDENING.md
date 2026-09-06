# Phases 132–133 — Release Evidence Immutability + Consolidated CI Security Gate

## Phase 132 — Release Evidence Integrity

Introduces a SHA-256 evidence ledger covering the release evidence chain. The ledger records file hashes and byte counts and derives a canonical chain hash. The audit detects subsequent evidence mutation, deletion, or byte-count drift.

This is **tamper-evident**, not an external immutable archive. An independent copy, signed manifest, or external artifact store is still required for true release-grade immutability.

Commands:

```text
npm run capture:release-evidence-integrity
npm run audit:release-evidence-integrity
```

## Phase 133 — Consolidated Release Security Gate

Adds one deterministic repository gate that consumes the existing security controls instead of duplicating their implementation. It separates three states:

- `PASS` — every recorded control passes.
- `EXTERNAL_REQUIRED` — no repository security control failed, but infrastructure evidence is unavailable.
- `FAIL` — an actual regression or missing required repository control exists.

Command:

```text
npm run audit:release-security-gate
```

The gate does not manufacture staging, production, migration, restore, approval, or deployment evidence.
