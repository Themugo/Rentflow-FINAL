# Phase 118–119 Hardening Record

Phase 118 adds candidate-vs-certified artifact drift detection. It re-hashes the deployment manifest and checks release commit identity when available.

Phase 119 adds a repository-side rollback readiness gate. It checks the presence of recovery tooling and evidence dependencies while keeping real backup/restore claims external-only.

These controls are fail-closed for detected artifact drift and remain explicit about evidence that cannot be proven from the repository alone.
