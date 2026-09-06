import { describe, expect, it } from "vitest";
import { EMPTY_DASHBOARD_STATS, shouldSkipUnscopedDashboardRpc } from "@/features/dashboard/lib/dashboardStats";
import { buildAttentionItems } from "@/features/dashboard/lib/attentionItems";

describe("shouldSkipUnscopedDashboardRpc", () => {
  it("skips the manager-wide RPC for property-restricted submanagers", () => {
    expect(shouldSkipUnscopedDashboardRpc({ restrictToAssignedProperties: true })).toBe(true);
    expect(
      shouldSkipUnscopedDashboardRpc({
        restrictToAssignedProperties: true,
        assignedPropertyIds: ["prop-1"],
      }),
    ).toBe(true);
  });

  it("allows the RPC for managers and unrestricted submanagers", () => {
    expect(shouldSkipUnscopedDashboardRpc()).toBe(false);
    expect(shouldSkipUnscopedDashboardRpc({})).toBe(false);
    expect(shouldSkipUnscopedDashboardRpc({ restrictToAssignedProperties: false })).toBe(false);
  });
});

describe("buildAttentionItems", () => {
  const formatCurrency = (value: number) => `KES ${value}`;

  it("omits zero-count items and ranks danger before warning", () => {
    const items = buildAttentionItems(
      {
        ...EMPTY_DASHBOARD_STATS,
        overdueInvoices: 2,
        arrearsTotal: 80000,
        vacantUnits: 3,
        totalUnits: 10,
        expiringLeases: 1,
        openMaintenanceCount: 4,
        urgentMaintenanceCount: 1,
        pendingDepositRefundsCount: 0,
      },
      formatCurrency,
    );

    expect(items.map((item) => item.id)).toEqual([
      "overdue",
      "urgent-maintenance",
      "open-maintenance",
      "expiring-leases",
      "vacant",
    ]);
    expect(items.find((item) => item.id === "refunds")).toBeUndefined();
    expect(items[0].cta).toBe("Collect");
    expect(items.find((item) => item.id === "open-maintenance")?.count).toBe(3);
  });

  it("returns an empty list when nothing needs attention", () => {
    expect(buildAttentionItems(EMPTY_DASHBOARD_STATS, formatCurrency)).toEqual([]);
  });
});
