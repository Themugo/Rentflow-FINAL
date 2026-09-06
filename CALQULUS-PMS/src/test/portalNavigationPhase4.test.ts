import { describe, expect, it } from "vitest";
import {
  AGENCY_NAV_GROUPS,
  LANDLORD_NAV_GROUPS,
  TENANT_MOBILE_NAV,
  TENANT_NAV_GROUPS,
  WEBHOST_NAV_GROUPS,
  isAgencyNavActive,
  isTenantNavActive,
} from "@/shared/navigation/portalNavigation";
import { roleRouteConfigs, designPreviewPublicRoutes } from "@/app/routes";

function flatten(groups: { items: { href: string }[] }[]) {
  return groups.flatMap((group) => group.items.map((item) => item.href));
}

describe("Phase 4 portal navigation convergence", () => {
  it("keeps one canonical nav definition per portal shell", () => {
    expect(flatten(AGENCY_NAV_GROUPS)).toEqual([
      "/agency",
      "/agency/clients",
      "/agency/portfolio",
      "/agency/tenants",
      "/agency/leases",
      "/agency/billing",
      "/agency/water-billing",
      "/agency/statements",
      "/agency/invites",
      "/agency/vacation-notices",
      "/agency/maintenance",
      "/agency/reports",
      "/agency/settings",
    ]);
    expect(flatten(LANDLORD_NAV_GROUPS)).toEqual([
      "/landlord/dashboard",
      "/landlord/portfolio",
      "/landlord/financials",
      "/landlord/statements",
      "/landlord/maintenance",
      "/landlord/documents",
      "/landlord/settings",
    ]);
    expect(flatten(TENANT_NAV_GROUPS)).toEqual([
      "/portal",
      "/portal/payments",
      "/portal/contracts",
      "/portal/maintenance",
      "/portal/receipts",
      "/portal/documents",
      "/portal/profile",
    ]);
    expect(flatten(WEBHOST_NAV_GROUPS)).toContain("/webhost/unattached-tenants");
    expect(new Set(flatten(AGENCY_NAV_GROUPS)).size).toBe(flatten(AGENCY_NAV_GROUPS).length);
    expect(new Set(flatten(LANDLORD_NAV_GROUPS)).size).toBe(flatten(LANDLORD_NAV_GROUPS).length);
    expect(new Set(flatten(TENANT_NAV_GROUPS)).size).toBe(flatten(TENANT_NAV_GROUPS).length);
  });

  it("preserves special active-route semantics", () => {
    expect(isAgencyNavActive("/agency/portfolio", "/agency/properties/abc")).toBe(true);
    expect(isAgencyNavActive("/agency/clients", "/agency/landlords")).toBe(true);
    expect(isTenantNavActive("/portal/contracts", "/portal/lease")).toBe(true);
    expect(isTenantNavActive("/portal", "/portal/payments")).toBe(false);
  });

  it("keeps role route tables free of exact duplicate paths", () => {
    for (const config of roleRouteConfigs) {
      const paths = config.routes.map((route) => route.path);
      expect(new Set(paths).size, config.role).toBe(paths.length);
    }
  });

  it("keeps primary navigation targets represented by the owning role route table", () => {
    const byRole = new Map(roleRouteConfigs.map((config) => [config.role, new Set(config.routes.map((route) => route.path))]));
    const checks = [
      ["agency", flatten(AGENCY_NAV_GROUPS)],
      ["landlord", flatten(LANDLORD_NAV_GROUPS)],
      ["tenant", flatten(TENANT_NAV_GROUPS)],
      ["webhost", flatten(WEBHOST_NAV_GROUPS)],
    ] as const;

    for (const [role, hrefs] of checks) {
      const routes = byRole.get(role);
      expect(routes, role).toBeDefined();
      for (const href of hrefs) {
        expect(routes?.has(href), `${role}: ${href}`).toBe(true);
      }
    }
  });

  it("uses the canonical design-preview route set instead of redefining it", () => {
    expect(designPreviewPublicRoutes).toHaveLength(7);
    expect(new Set(designPreviewPublicRoutes.map((route) => route.path)).size).toBe(7);
  });

  it("keeps tenant mobile navigation intentionally limited", () => {
    expect(TENANT_MOBILE_NAV.map((item) => item.href)).toEqual([
      "/portal",
      "/portal/payments",
      "/portal/maintenance",
      "/portal/documents",
      "/portal/profile",
    ]);
  });
});
