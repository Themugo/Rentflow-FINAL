import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate every dashboard-facing aggregate query after a mutation that
 * changes lease, property, unit, or maintenance state.
 *
 * Several list pages (Leases, Properties, Units, Maintenance) manage their
 * own data with plain useState + imperative fetch rather than React Query
 * mutations, so their writes never invalidated the Manager dashboard
 * (`['dashboard', 'stats', managerId]`, from useOptimizedQuery.ts) or the
 * Agency dashboard (`['agency-portfolio', userId]`, from
 * useAgencyPortfolio.ts) — both of which ARE React Query and cache with a
 * nonzero staleTime. Without this, a manager could terminate a lease or
 * resolve a maintenance request and still see stale KPIs on their own
 * dashboard until the staleTime lapsed or they refreshed the page.
 *
 * React Query matches queryKey prefixes by default, so invalidating the
 * short keys below covers every manager/user id without needing it here.
 */
export function invalidateDashboardQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["agency-portfolio"] });
}
