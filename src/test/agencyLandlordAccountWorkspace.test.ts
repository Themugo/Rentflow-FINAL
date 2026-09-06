import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Agency landlord account workspace", () => {
  it("provisions landlord relationships through a service-role-only RPC", () => {
    const sql = read("supabase/migrations/20260906000013_agency_landlord_account_provisioning.sql");
    expect(sql).toContain("provision_agency_landlord_links_atomic");
    expect(sql).toContain("auth.role() <> 'service_role'");
    expect(sql).toContain("p.manager_id IS DISTINCT FROM p_agency_user_id");
    expect(sql).toContain("property_landlords");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.provision_agency_landlord_links_atomic");
  });

  it("keeps account creation server-side and uses secure activation instead of exposing passwords", () => {
    const fn = read("supabase/functions/create-agency-landlord-account/index.ts");
    expect(fn).toContain("auth.admin.createUser");
    expect(fn).toContain("role: \"landlord\"");
    expect(fn).toContain("account_activations");
    expect(fn).toContain("randomPassword");
    expect(fn).not.toContain("password: body.password");
    expect(fn).toContain("provision_agency_landlord_links_atomic");
  });

  it("keeps the agency landlord book hierarchical and property-aware", () => {
    const page = read("src/features/agency/pages/AgencyClients.tsx");
    const hook = read("src/features/agency/lib/useAgencyPortfolio.ts");
    const layout = read("src/features/agency/components/AgencyLayout.tsx");
    expect(page).toContain("Create landlord account");
    expect(page).toContain("Properties & occupants");
    expect(page).toContain("Search landlord or location");
    expect(page).toContain("property.tenantCount");
    expect(hook).toContain('from("tenants")');
    expect(hook).toContain("tenantCountByProperty");
    expect(layout).toContain("Landlord book");
    expect(layout).toContain("agencyClientPath(client.id)");
  });

  it("keeps dashboard command tabs tied to canonical routes", () => {
    const dashboard = read("src/features/agency/pages/AgencyDashboard.tsx");
    expect(dashboard).toContain("Agency command tabs");
    expect(dashboard).toContain("Operational pulse");
    expect(dashboard).toContain("AGENCY_OPS_ROUTES.maintenance");
    expect(dashboard).toContain("AGENCY_ROUTES.settings");
  });
});
