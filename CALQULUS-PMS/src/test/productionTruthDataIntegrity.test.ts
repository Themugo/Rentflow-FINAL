import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const executive = fs.readFileSync(path.join(root, "src/shared/components/bi/ExecutiveAnalyticsWorkspace.tsx"), "utf8");

describe("production truth and data integrity hardening", () => {
  it("uses the authoritative management analytics RPC", () => {
    expect(executive).toContain('get_manager_management_analytics');
    expect(executive).toContain('useManagerScope');
    expect(executive).not.toContain('KES 6,850,000');
    expect(executive).not.toContain('94.8%');
    expect(executive).not.toContain('96.2%');
    expect(executive).not.toContain('KES 245,000');
  });

  it("does not present fabricated predictive claims", () => {
    expect(executive).not.toContain('projected AI forecast');
    expect(executive).not.toContain('Predictive occupancy');
    expect(executive).not.toContain('probability');
  });

  it("removes unreferenced mock analytics components", () => {
    expect(fs.existsSync(path.join(root, "src/features/webhost/components/OccupancyForecastingDashboard.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(root, "src/features/webhost/components/TenantLTVAnalytics.tsx"))).toBe(false);
  });
});
