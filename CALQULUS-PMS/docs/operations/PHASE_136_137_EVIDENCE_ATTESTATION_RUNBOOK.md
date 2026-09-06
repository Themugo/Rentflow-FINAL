# Phases 136–137 — Production Evidence Ingestion & Independent Attestation

## Phase 136

1. Obtain deployment/migration/staging/restore/approval evidence from the real release systems.
2. Save a sanitized JSON evidence bundle outside source control.
3. Set `PRODUCTION_EVIDENCE_FILE` to that file.
4. Run `npm run ingest:production-evidence`.
5. Run `npm run audit:production-evidence-ingestion`.
6. Review `docs/audits/PRODUCTION_EVIDENCE_INGESTION.json`.

## Phase 137

1. Have an independent release operator/approver attest to the exact ingestion evidence hash.
2. Supply `INDEPENDENT_ATTESTATION_ID`, `INDEPENDENT_ATTESTOR`, `INDEPENDENT_ATTESTED_AT`, `ATTESTATION_SCOPE`, and `ATTESTATION_EVIDENCE_SHA256`.
3. Run `npm run capture:independent-attestation`.
4. Run `npm run audit:independent-attestation`.
5. Re-run production certification and release reconciliation.

No step in this runbook executes a migration, deployment, restore or rollback.
