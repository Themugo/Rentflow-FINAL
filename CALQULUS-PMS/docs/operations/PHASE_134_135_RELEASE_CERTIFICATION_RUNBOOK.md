# Phases 134–135 Release Certification Runbook

1. Deploy the exact certified release commit to staging.
2. Run staging migration, smoke, authenticated role certification, and restore verification.
3. Run production deployment and migration through the approved external pipeline.
4. Export only identifiers/timestamps/operator records; never export credentials.
5. Set the required environment variables and run `npm run capture:external-evidence-binding`.
6. Run `npm run audit:external-evidence-binding`.
7. Run `npm run audit:production-release-certification`.
8. Proceed only when the certification reports `PRODUCTION_RELEASE_CERTIFIED`.

The packaged/offline workspace is expected to remain `EXTERNAL_REQUIRED` until these real external events occur.
