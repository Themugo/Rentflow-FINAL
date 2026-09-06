# Portfolio Operations Control Centre

## Delivered
- Added a manager dashboard control centre combining existing authoritative dashboard statistics with the canonical payment exception queue.
- Surfaces collections/arrears, maintenance, lease renewals, vacancies and payment exceptions in one operational view.
- Reuses existing dashboard stats and the existing `get_payment_exception_control_center` RPC; no duplicate property, lease or maintenance data queries were introduced.
- Provides direct navigation from each active exception category to the existing operational screen.
- Preserves the existing detailed attention queue and specialist dashboards underneath the new summary layer.

## Verification
- `audit-migration-chain.mjs`: PASS — 174 migrations, 0 unexpected duplicates, 0 ordering warnings.
- `cross-role-isolation-audit.mjs`: PASS.
- `audit-deployment-controls.mjs`: PASS.
- Full TypeScript/Vitest/build not claimed because dependencies are not installed in the packaged workspace.
- Live migration reconciliation remains a deployment gate.
