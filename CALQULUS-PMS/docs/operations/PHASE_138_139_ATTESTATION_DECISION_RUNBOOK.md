# Phase 138–139 Runbook

1. Produce the independent attestation using the external release process.
2. Provide the Ed25519 public key and signature through environment variables or the controlled attestation record.
3. Run `npm run audit:attestation-signature`.
4. Run `npm run audit:final-production-decision`.
5. Investigate any `FAIL` before promotion.
6. If `EXTERNAL_REQUIRED` remains, obtain the missing staging/production evidence; do not override the gate.
7. Preserve the resulting JSON reports with the release evidence outside the repository when final certification is required.

No private key, password, access token or database credential belongs in the repository.
