# Rollback Matrix

| Failure | Action |
|---|---|
| Frontend-only regression | Revert application release; retain DB migrations if schema remains backward compatible |
| RPC/application incompatibility | Stop promotion; restore compatible application build before any destructive DB action |
| Migration failure on staging | Fix forward in a new migration; never edit an already-applied migration |
| Migration failure in production | Stop; preserve DB state; use the recovery plan/PITR procedure rather than ad-hoc reversal |
| Financial inconsistency | Freeze affected workflow and reconcile from immutable/audited transaction records |
| Storage namespace breach | Disable affected upload path and rotate/restrict policies; preserve evidence |

**Rule:** CALQULUS migrations are forward-only once applied to a shared environment. A rollback is primarily a release rollback or database recovery operation, not an automatic `down` migration.
