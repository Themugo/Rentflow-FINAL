# CALQULUS PMS — Executive Portfolio Intelligence & Decision Support

## Delivered

- Added `get_manager_executive_portfolio_intelligence` with manager/submanager authorization.
- Added explainable 0–100 portfolio risk scoring and inverse health score.
- Risk drivers: collections, vacancy, maintenance, SLA, lease renewals.
- Added prioritized management actions derived from live portfolio conditions.
- Added live Executive Portfolio Intelligence dashboard panel.
- Reused existing portfolio, invoice, maintenance, lease, and operational work data; no duplicate reporting tables.

## Verification

- Migration chain: PASS — 179 SQL migrations, 0 unexpected duplicates, 0 ordering warnings.
- Cross-role isolation: PASS in the existing static audit suite.
- Deployment controls: PASS in the existing static audit suite.
- Targeted source assertions: PASS (RPC scope, security-definer hardening, risk drivers/actions, live dashboard RPC).
- Full dependency-backed Vitest/build: NOT CLAIMED because `node_modules` is unavailable in the packaging workspace.
- Live migration reconciliation: REQUIRED before deployment.
- Remote production deployment: NOT CLAIMED.
