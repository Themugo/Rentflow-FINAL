import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("portfolio operations control centre", () => {
  it("reuses dashboard stats and the canonical payment exception RPC", () => {
    const component = read("features/dashboard/components/PortfolioOperationsControlCenter.tsx");
    expect(component).toContain("ManagerDashboardStats");
    expect(component).toContain('get_payment_exception_control_center');
  });
  it("is integrated into the manager dashboard", () => {
    const dashboard = read("features/dashboard/pages/Dashboard.tsx");
    expect(dashboard).toContain("PortfolioOperationsControlCenter");
    expect(dashboard).toContain("stats={stats}");
  });
  it("does not duplicate portfolio queries for properties, leases or maintenance", () => {
    const component = read("features/dashboard/components/PortfolioOperationsControlCenter.tsx");
    expect(component).not.toContain('.from("properties")');
    expect(component).not.toContain('.from("leases")');
    expect(component).not.toContain('.from("maintenance_requests")');
  });
});
