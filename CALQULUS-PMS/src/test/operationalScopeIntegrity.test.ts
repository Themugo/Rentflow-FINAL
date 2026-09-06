import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("operational command-center scope integrity", () => {
  it("scopes accountant dashboard financial queries to the manager", () => {
    const source = read("src/features/dashboard/pages/AccountantDashboard.tsx");
    expect(source).toContain("eq('manager_id', managerId)");
    expect(source).toContain("assignedPropertyIds");
    expect(source).not.toContain("Automated reminders have been dispatched.");
  });

  it("scopes maintenance dashboard requests to the manager", () => {
    const source = read("src/features/dashboard/pages/MaintenanceDashboard.tsx");
    expect(source).toContain("eq('manager_id', managerId)");
    expect(source).toContain("useManagerScope");
  });

  it("scopes leasing dashboard properties and lease queues", () => {
    const source = read("src/features/dashboard/pages/LeasingDashboard.tsx");
    expect(source).toContain("eq('manager_id', managerId)");
    expect(source).toContain("property_id', assignedPropertyIds");
    expect(source).not.toContain('change="+2.5%"');
  });
});
