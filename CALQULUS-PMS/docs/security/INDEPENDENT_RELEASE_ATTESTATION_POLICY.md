# Independent Release Attestation Policy

Production release certification requires an independent attestation bound to the exact hash of the ingested production evidence.

Required external values:

- attestation ID
- independent attestor
- attestation timestamp
- attestation scope
- SHA-256 of the ingested evidence

The attestor must differ from the deployment/evidence operator. Optional cryptographic signatures may be supplied by the external release system; this repository never stores private signing keys.

Missing external attestation is `EXTERNAL_REQUIRED`. A hash mismatch is a release-blocking failure.
