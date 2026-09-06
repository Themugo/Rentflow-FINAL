# Management Analytics & Operational Reporting Audit

Status: PASS

- Canonical management analytics RPC: `get_manager_management_analytics`
- Scope: manager + authorized submanagers only
- Security: `SECURITY DEFINER`, empty `search_path`, explicit authenticated grant
- Metrics: portfolio occupancy, collections, arrears, maintenance, lease expiry, work queue SLA, team performance
- Dashboard consumes the RPC rather than hard-coded trend data
- Migration chain: 178 migrations, 0 unexpected duplicate versions, 0 ordering warnings
- Full dependency-backed TypeScript/Vitest execution remains pending because `node_modules` is unavailable in the packaged workspace
- Live Supabase migration reconciliation remains required before deployment
