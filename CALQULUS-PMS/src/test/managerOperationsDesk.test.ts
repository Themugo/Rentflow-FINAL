import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("Manager operations desk initiative", () => {
  it("organizes the manager dashboard into focused operational workspaces", () => {
    const dashboard = src("src/features/dashboard/pages/Dashboard.tsx");
    expect(dashboard).toContain("Operations desk");
    expect(dashboard).toContain("Command center");
    expect(dashboard).toContain("Collections");
    expect(dashboard).toContain("Portfolio");
    expect(dashboard).toContain("Operations");
    expect(dashboard).toContain("Controls");
    expect(dashboard).toContain('role="tablist"');
    expect(dashboard).toContain('role="tab"');
    expect(dashboard).toContain("PortfolioOperationsControlCenter");
    expect(dashboard).toContain("ManagementComplianceAssuranceCenter");
    expect(dashboard).toContain("PropertyRevenueLeaseOptimization");
    expect(dashboard).toContain("MaintenanceSlaVendorDispatchAssuranceCenter");
  });

  it("keeps the manager shell compatible with dashboard header naming and exposes a bounded property book", () => {
    const layout = src("src/features/manager/components/ManagerLayout.tsx");
    expect(layout).toContain("subtitle?: string");
    expect(layout).toContain("headerActions?: ReactNode");
    expect(layout).toContain("useManagerPropertiesSimple");
    expect(layout).toContain('label: "Property book"');
    expect(layout).toContain("properties.slice(0, 12)");
    expect(layout).toContain('`/properties/${property.id}`');
    expect(layout).toContain("navGroups={managerNavGroups}");
  });
});
