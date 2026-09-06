# CALQULUS PMS — Operational Work Queue Completion

## Scope
Turns live portfolio exceptions into scoped, assignable and auditable operational work items without duplicating the existing billing, maintenance, lease or unit data models.

## Delivered
- `operation_work_items` table with manager scope, source identity, priority, status, assignee and completion audit fields.
- Active-source uniqueness prevents duplicate open work for the same source exception while allowing a closed item to recur if the underlying exception returns.
- `sync_operation_work_queue_atomic` converts overdue invoices, open maintenance, expiring leases, vacant units and payment exceptions into work items.
- `get_operation_work_queue` provides a manager/submanager scoped active queue.
- `assign_operation_work_item_atomic` restricts assignees to the manager/submanager team.
- `transition_operation_work_item_atomic` provides atomic open/in-progress/completed/cancelled transitions.
- Manager Dashboard now exposes the Operational Work Queue with Sync, Open, Start and Complete actions.

## Verification
- Migration chain: PASS (175 migrations; 0 unexpected duplicate versions; 0 ordering warnings).
- Cross-role isolation audit: PASS.
- Deployment controls: PASS.
- Full dependency-backed TypeScript/Vitest build was not claimed because the packaged workspace does not contain installed node_modules.
- Live migration reconciliation remains required before production deployment.
