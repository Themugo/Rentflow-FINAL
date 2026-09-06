import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Dashboard operational truthfulness", () => {
  it("does not ship fabricated leasing KPI movement", () => {
    const source = read("src/features/dashboard/pages/LeasingDashboard.tsx");
    expect(source).not.toContain('change="+2.5%"');
  });

  it("derives maintenance dispatch and resolution metrics from maintenance records", () => {
    const source = read("src/features/dashboard/pages/MaintenanceDashboard.tsx");
    expect(source).toContain("provider_started_at");
    expect(source).toContain("differenceInMinutes");
    expect(source).toContain("avgDispatchHours");
    expect(source).not.toContain("avgResponseHours: 3.2");
    expect(source).not.toContain("resolutionRate: 94.8");
  });

  it("uses recorded invoice history for the accountant trend", () => {
    const source = read("src/features/dashboard/pages/AccountantDashboard.tsx");
    expect(source).toContain("gte('paid_date'");
    expect(source).toContain("financialTrends");
    expect(source).not.toContain("1_250_000");
    expect(source).not.toContain("1,250,000");
    expect(source).not.toContain("reconciliationRate: 98.4");
    expect(source).not.toContain("collectionRate: 92.5");
  });

  it("does not present unsupported support satisfaction or response metrics as facts", () => {
    const source = read("src/features/dashboard/pages/SupportDashboard.tsx");
    expect(source).not.toContain("csatScore: 98.2");
    expect(source).not.toContain("avgFirstResponseMins: 14");
    expect(source).not.toContain("resolvedToday: 24");
    expect(source).toContain("Support-specific ticket resolution is not tracked");
  });
});
