# Phase 136–137 Hardening Summary

Phase 136 adds a fail-closed production evidence ingestion boundary. External evidence is schema-validated, secret-key scanned, hashed, and represented by metadata rather than copied into the repository.

Phase 137 adds an independent attestation boundary. The attestation must bind to the exact ingested evidence hash and the attestor must be distinct from the deployment/evidence operator.

Both controls preserve `EXTERNAL_REQUIRED` when real infrastructure evidence is absent. Neither control fabricates production proof or performs production changes.
