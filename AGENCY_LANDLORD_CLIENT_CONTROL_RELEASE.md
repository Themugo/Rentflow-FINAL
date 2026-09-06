# Release: Agency → Landlord Client Control

This release advances the supplied CALQULUS master without replacing its existing Agency, landlord, tenant, manager, payment or ledger systems.

### Core principle
CALQULUS is the platform. Each Agency decides what it agrees with each landlord/client. The system enforces those chosen rules, effective dates, authority boundaries and accounting integrity.

### New hardening
- Explicit owner-vs-Agency authority matrix on existing client contract rules.
- Single effective arrangement resolver for runtime decisions.
- Manual-payment tolerance and expense-approval threshold.
- Duplicate active payment-reference guard using transactional advisory locking.
- Manual/external evidence acceptance blocked when it does not reconcile to the live invoice beyond the configured tolerance.
- Invoice line-item total integrity is deferred and enforced at transaction completion.
- Paid/cancelled invoice financial terms are immutable.
- Month-close snapshots receive a SHA-256 hash.

### Existing capabilities retained
- Agency contract rules and versioning.
- Agency/property/unit payment policy hierarchy.
- Agency charge catalogue.
- Invoice line items.
- Canonical payment lifecycle.
- Payment evidence queue.
- External/direct settlement handling.
- Financial ledger and close.
- Tenant-visible policy notices.

### No parallel systems
No second payment table, invoice table, receipt engine, ledger, tenant model or landlord model is introduced.
