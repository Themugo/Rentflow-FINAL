import { describe, expect, it } from "vitest";
import fs from "node:fs";

const dashboard = fs.readFileSync("src/features/dashboard/pages/Dashboard.tsx", "utf8");
const stats = fs.readFileSync("src/features/dashboard/lib/dashboardStats.ts", "utf8");

describe("dashboard performance safeguards", () => {
  it("uses the consolidated dashboard stats query path", () => {
    expect(dashboard).toContain("fetchManagerDashboardStats");
    expect(dashboard.match(/fetchManagerDashboardStats\(/g)?.length).toBe(1);
  });

  it("does not force a second stats request during manual refresh", () => {
    expect(dashboard).not.toContain("refetchStats");
    expect(dashboard).toContain("queryClient.invalidateQueries");
  });

  it("coalesces bursts of realtime changes", () => {
    expect(dashboard).toContain("realtimeRefreshTimer");
    expect(dashboard).toContain("setTimeout(() => {");
    expect(dashboard).toContain("}, 300);");
  });

  it("keeps the RPC-first and fallback architecture intact", () => {
    expect(stats).toContain("supabase.rpc('get_manager_dashboard_stats'");
    expect(stats).toContain("fetchDashboardStatsFallback(managerId)");
  });
});
