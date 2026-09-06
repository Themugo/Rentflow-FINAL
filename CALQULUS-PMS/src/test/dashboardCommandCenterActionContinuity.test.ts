import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Dashboard command-center action continuity", () => {
  it("routes maintenance preview rows into the existing priority-aware maintenance queue", () => {
    const source = read("src/features/dashboard/components/OpenMaintenancePreview.tsx");
    expect(source).toContain("/maintenance?priority=");
    expect(source).toContain("Prioritise urgent work");
  });

  it("lets maintenance consume dashboard priority deep links without replacing its existing lane model", () => {
    const source = read("src/features/maintenance/pages/Maintenance.tsx");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("priorityFilter");
    expect(source).toContain("matchesPriority");
    expect(source).toContain("matchesMaintenanceLane");
  });

  it("routes upcoming payments into the existing billing status filter", () => {
    const source = read("src/features/dashboard/components/UpcomingPayments.tsx");
    expect(source).toContain("/billing?filter=");
    expect(source).toContain("Review billing queue");
  });

  it("connects dashboard section aria labels to actual heading ids", () => {
    const source = read("src/features/dashboard/pages/Dashboard.tsx");
    for (const id of [
      "dashboard-kpi",
      "dashboard-collections-pulse",
      "dashboard-attention",
      "dashboard-collections",
      "dashboard-occupancy",
      "dashboard-maintenance",
      "dashboard-properties",
      "dashboard-activity",
      "dashboard-upcoming",
    ]) {
      expect(source).toContain(`aria-labelledby="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });
});
