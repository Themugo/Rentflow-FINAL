import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Dashboard operational truth", () => {
  it("removes unsupported leasing trend claims", () => {
    expect(read("src/features/dashboard/pages/LeasingDashboard.tsx")).not.toContain('change="+2.5%"');
  });

  it("uses recorded maintenance timestamps instead of fabricated SLA metrics", () => {
    const source = read("src/features/dashboard/pages/MaintenanceDashboard.tsx");
    expect(source).toContain("provider_started_at");
    expect(source).toContain("differenceInMinutes");
    expect(source).not.toContain("avgResponseHours: 3.2");
    expect(source).not.toContain("resolutionRate: 94.8");
  });

  it("uses recorded invoice history instead of mock accountant trends", () => {
    const source = read("src/features/dashboard/pages/AccountantDashboard.tsx");
    expect(source).toContain("gte('paid_date'");
    expect(source).toContain("Recorded collections");
    expect(source).not.toContain("reconciliationRate: 98.4");
    expect(source).not.toContain("collectionRate: 92.5");
    expect(source).not.toContain("1_250_000");
  });

  it("does not present unsupported support satisfaction metrics", () => {
    const source = read("src/features/dashboard/pages/SupportDashboard.tsx");
    expect(source).not.toContain("csatScore: 98.2");
    expect(source).not.toContain("avgFirstResponseMins: 14");
    expect(source).not.toContain("resolvedToday: 24");
  });
});
