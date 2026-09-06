import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("dashboard command center initiative", () => {
  it("shares property data between the property overview and occupancy chart", () => {
    const hook = read("features/dashboard/hooks/useDashboardData.ts");
    expect(read("features/dashboard/components/PropertiesOverview.tsx")).toContain("useDashboardProperties");
    expect(read("features/dashboard/components/OccupancyChart.tsx")).toContain("useDashboardProperties");
    expect(hook).toContain("dashboardDataKeys");
  });

  it("shares scoped tenant resolution between invoice-driven dashboard views", () => {
    const hook = read("features/dashboard/hooks/useDashboardData.ts");
    expect(read("features/dashboard/components/UpcomingPayments.tsx")).toContain("useDashboardTenantIds");
    expect(read("features/dashboard/components/RevenueChart.tsx")).toContain("useDashboardTenantIds");
    expect(hook).toContain('"tenant-ids"');
  });

  it("uses the dashboard cache as the realtime invalidation boundary", () => {
    const dashboard = read("features/dashboard/pages/Dashboard.tsx");
    expect(dashboard).toContain('queryKey: ["dashboard"]');
    expect(dashboard).toContain("setTimeout");
  });

  it("does not create component-level realtime subscriptions for shared property and payment views", () => {
    expect(read("features/dashboard/components/PropertiesOverview.tsx")).not.toContain("postgres_changes");
    expect(read("features/dashboard/components/UpcomingPayments.tsx")).not.toContain("postgres_changes");
    expect(read("features/dashboard/components/RevenueChart.tsx")).not.toContain("postgres_changes");
    expect(read("features/dashboard/components/OccupancyChart.tsx")).not.toContain("postgres_changes");
  });
});


describe("dashboard shared data boundaries", () => {
  it("reuses shared tenant scope for arrears instead of fetching tenant ids locally", () => {
    expect(read("features/dashboard/components/ArrearsHeatMap.tsx")).toContain("useDashboardTenantIds");
    expect(read("features/dashboard/components/ArrearsHeatMap.tsx")).not.toContain('.from("tenants")');
  });

  it("reuses shared property data for maintenance scope instead of fetching property names locally", () => {
    expect(read("features/dashboard/components/OpenMaintenancePreview.tsx")).toContain("useDashboardProperties");
    expect(read("features/dashboard/components/OpenMaintenancePreview.tsx")).not.toContain('.from("properties")');
  });
});


describe("dashboard intelligence presentation boundaries", () => {
  it("surfaces collections pulse from existing dashboard stats", () => {
    const dashboard = read("features/dashboard/pages/Dashboard.tsx");
    expect(dashboard).toContain("Collections pulse");
    expect(dashboard).toContain("stats.outstandingRent");
  });

  it("prioritizes lower-occupancy properties without adding a data query", () => {
    const properties = read("features/dashboard/components/PropertiesOverview.tsx");
    expect(properties).toContain("sort((a, b) =>");
    expect(properties).toContain("Needs occupancy attention");
    expect(properties).not.toContain("supabase.from");
  });
});
