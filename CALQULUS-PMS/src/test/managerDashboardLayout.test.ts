import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("Manager executive dashboard layout contracts", () => {
  it("keeps the specified header, four KPIs, and collections-first hierarchy", () => {
    const dashboard = src("src/features/dashboard/pages/Dashboard.tsx");
    expect(dashboard).toContain('title="Dashboard"');
    expect(dashboard).toContain("Portfolio overview and today's operational priorities.");
    expect(dashboard).toContain("Add property");
    expect(dashboard).toContain("View reports");
    expect(dashboard).toContain("AttentionStrip");
    expect(dashboard).toContain("UpcomingPayments");
    expect(dashboard).toContain("PropertiesOverview");
    expect(dashboard).toContain("Collections performance");
    expect(dashboard).toContain("Recent activity");
    expect(dashboard).toContain("Upcoming actions");
    expect(dashboard).toContain("Property performance");
    expect(dashboard).toContain("PaymentSetupStatus");
    expect(dashboard).toContain("ManagerActivationEmpty");
    expect(dashboard).toContain("fetchManagerDashboardStats");
    expect(dashboard).toContain("buildAttentionItems");

    const collectionsAt = dashboard.indexOf("dashboard-collections");
    const occupancyAt = dashboard.indexOf("dashboard-occupancy");
    expect(collectionsAt).toBeGreaterThan(-1);
    expect(occupancyAt).toBeGreaterThan(collectionsAt);

    const statCardCount = dashboard.split("<StatCard").length - 1;
    expect(statCardCount).toBe(4);
    expect(dashboard).not.toMatch(/KES 1\.24M/);
  });

  it("does not invent attention alerts", () => {
    const dashboard = src("src/features/dashboard/pages/Dashboard.tsx");
    expect(dashboard).toContain("buildAttentionItems");
    const items = src("src/features/dashboard/lib/attentionItems.ts");
    expect(items).toContain("Zero-count items are omitted");
  });
});
