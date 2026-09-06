import { describe, expect, it } from "vitest";
import { dashboardDataKeys } from "@/features/dashboard/hooks/useDashboardData";

describe("Dashboard Command Center data boundaries", () => {
  it("keeps activity and tenant overview under the dashboard invalidation namespace", () => {
    expect(dashboardDataKeys.recentActivity("manager", "a,b")).toEqual(["dashboard", "recent-activity", "manager", "a,b"]);
    expect(dashboardDataKeys.tenantsOverview("manager", "a,b")).toEqual(["dashboard", "tenants-overview", "manager", "a,b"]);
  });

  it("keeps assigned-property scope in dashboard detail keys", () => {
    expect(dashboardDataKeys.recentActivity("manager", "")).not.toEqual(dashboardDataKeys.recentActivity("manager", "property-1"));
    expect(dashboardDataKeys.tenantsOverview("manager", "")).not.toEqual(dashboardDataKeys.tenantsOverview("manager", "property-1"));
  });
});
