# Agency Contract & Financial Controls Release

This release adds Agency-controlled contract rules, charge/expense catalogues, financial workbench and ledger exports, outside-source payment evidence, split/direct payment reconciliation, configurable Agency permissions, and month-end close/reopen controls.

Apply the Agency migrations in order after the project's existing migrations:
- 20260906000000_agency_service_model_matrix.sql
- 20260906000001_agency_service_runtime_enforcement.sql
- 20260906000002_agency_service_workflow_hardening.sql
- 20260906000003_agency_contract_rules_financial_workbench.sql
- 20260906000004_agency_contract_runtime_controls.sql
- 20260906000005_agency_external_settlement_and_financial_controls.sql

The Agency remains the operator of its own client contracts, permissions, billing rules and financial controls. CALQULUS provides the platform and audit-safe primitives.
