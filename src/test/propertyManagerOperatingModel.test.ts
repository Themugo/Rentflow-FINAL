import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("independent property manager operating model", () => {
  it("extends the existing manager-owner relationship instead of creating a second property system", () => {
    const migration = read("supabase/migrations/20260906000007_manager_operating_model.sql");
    expect(migration).toContain("property_landlord_id uuid NOT NULL REFERENCES public.property_landlords");
    expect(migration).toContain("property_id uuid NOT NULL REFERENCES public.properties");
    expect(migration).toContain("owner_user_id uuid NOT NULL REFERENCES auth.users");
  });

  it("supports owner-controlled finance with manager-led property operations", () => {
    const migration = read("supabase/migrations/20260906000007_manager_operating_model.sql");
    expect(migration).toContain("owner_controls_collections boolean NOT NULL DEFAULT true");
    expect(migration).toContain("owner_controls_financials boolean NOT NULL DEFAULT true");
    expect(migration).toContain("owner_controls_distributions boolean NOT NULL DEFAULT true");
    expect(migration).toContain("manager_can_manage_tenants boolean NOT NULL DEFAULT true");
    expect(migration).toContain("manager_can_manage_maintenance boolean NOT NULL DEFAULT true");
    expect(migration).toContain("manager_can_manage_vendors boolean NOT NULL DEFAULT true");
  });

  it("supports owner portal visibility and configurable reporting", () => {
    const migration = read("supabase/migrations/20260906000007_manager_operating_model.sql");
    const page = read("src/features/manager/pages/ManagementControl.tsx");
    expect(migration).toContain("owner_visibility jsonb");
    expect(migration).toContain("reporting_frequency text");
    expect(migration).toContain("reporting_delivery text");
    expect(migration).toContain("report_sections jsonb");
    expect(page).toContain("Owner visibility");
    expect(page).toContain("Report sections");
  });

  it("uses atomic server-side authority changes", () => {
    const migration = read("supabase/migrations/20260906000007_manager_operating_model.sql");
    const page = read("src/features/manager/pages/ManagementControl.tsx");
    expect(migration).toContain("save_manager_management_mandate_atomic");
    expect(migration).toContain("manager_property_authority");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.manager_management_mandates FROM authenticated, anon");
    expect(page).toContain("save_manager_management_mandate_atomic");
  });

  it("keeps management control out of the submanager route and exposes it to the manager", () => {
    const routes = read("src/app/routes.ts");
    const nav = read("src/shared/navigation/portalNavigation.ts");
    const sidebar = read("src/shared/components/layout/Sidebar.tsx");
    expect(routes).toContain('{ path: "/management-control", element: ManagementControl, protected: true }');
    expect(nav).toContain('{ label: "Management control", href: "/management-control"');
    expect(sidebar).toContain('!isSubmanager || item.href !== "/management-control"');
  });

  it("gives the manager dashboard an operating-model control surface", () => {
    const dashboard = read("src/features/dashboard/pages/Dashboard.tsx");
    const summary = read("src/features/manager/components/ManagerOperatingSummary.tsx");
    expect(dashboard).toContain("<ManagerOperatingSummary />");
    expect(dashboard).toContain("<ManagerLayout");
    expect(summary).toContain("Configure mandates");
  });
});
