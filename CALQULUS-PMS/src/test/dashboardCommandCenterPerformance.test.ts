import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("dashboard command center performance", () => {
  it("aggregates the six-month revenue chart from two bounded invoice requests", () => {
    const source = read("src/features/dashboard/components/RevenueChart.tsx");
    expect(source).toContain('gte("paid_date", firstMonth)');
    expect(source).toContain('gte("due_date", firstMonth)');
    expect(source).toContain("Promise.all([paidQuery, pendingQuery])");
    expect(source).not.toContain("for (let i = 5; i >= 0; i--)");
  });

  it("keeps occupancy drill-down inside existing property routes", () => {
    const source = read("src/features/dashboard/components/OccupancyChart.tsx");
    expect(source).toContain("/properties/${property.id}");
    expect(source).toContain("useDashboardProperties");
  });

  it("does not introduce a second dashboard realtime subscription layer", () => {
    const dashboard = read("src/features/dashboard/pages/Dashboard.tsx");
    const revenue = read("src/features/dashboard/components/RevenueChart.tsx");
    const occupancy = read("src/features/dashboard/components/OccupancyChart.tsx");
    expect((dashboard.match(/postgres_changes/g) || []).length).toBe(6);
    expect(revenue).not.toContain("postgres_changes");
    expect(occupancy).not.toContain("postgres_changes");
  });
});
