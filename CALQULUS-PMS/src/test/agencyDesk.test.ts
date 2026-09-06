import { describe, expect, it } from "vitest";
import {
  AGENCY_LOGIN,
  AGENCY_ROUTES,
  agencyPropertyPath,
  isAgencyDeskPath,
  isAgencyPublicPath,
} from "@/features/agency/lib/agencyPaths";
import { deskPropertyPath } from "@/shared/components/layout/DeskEmbed";
import { pickRoleForPath } from "@/features/auth/lib/roleResolution";
import { roleRouteConfigs } from "@/app/routes";

describe("agency desk paths", () => {
  it("treats named pages as the agency desk", () => {
    expect(isAgencyDeskPath("/agency")).toBe(true);
    expect(isAgencyDeskPath(AGENCY_ROUTES.clients)).toBe(true);
    expect(isAgencyDeskPath(AGENCY_ROUTES.portfolio)).toBe(true);
    expect(isAgencyDeskPath(agencyPropertyPath("abc"))).toBe(true);
    expect(isAgencyDeskPath(AGENCY_ROUTES.tenants)).toBe(true);
    expect(isAgencyDeskPath(AGENCY_ROUTES.billing)).toBe(true);
    expect(isAgencyDeskPath(AGENCY_ROUTES.reports)).toBe(true);
    expect(isAgencyDeskPath(AGENCY_ROUTES.settings)).toBe(true);
  });

  it("does not treat login as the desk", () => {
    expect(isAgencyPublicPath(AGENCY_LOGIN)).toBe(true);
    expect(isAgencyDeskPath(AGENCY_LOGIN)).toBe(false);
    expect(isAgencyDeskPath("/properties")).toBe(false);
  });

  it("keeps property detail on the agency prefix when the desk is embedded", () => {
    expect(deskPropertyPath("abc")).toBe("/properties/abc");
    expect(deskPropertyPath("abc", { propertyBase: "/agency/properties" })).toBe(agencyPropertyPath("abc"));
    expect(deskPropertyPath("abc", { propertyBase: "/agency/properties", query: "tab=units" })).toBe(
      `${agencyPropertyPath("abc")}?tab=units`,
    );
  });
});

describe("agency role routing", () => {
  const manager = { role: "manager" as const, tenant_id: null, approval_status: "approved" as const };
  const agency = { role: "agency" as const, tenant_id: null, approval_status: "approved" as const };

  it("keeps a dual-role user on agency desk pages", () => {
    expect(pickRoleForPath([manager, agency], AGENCY_ROUTES.portfolio, "u1", false).role).toBe("agency");
    expect(pickRoleForPath([manager, agency], agencyPropertyPath("p1"), "u1", false).role).toBe("agency");
    expect(pickRoleForPath([manager, agency], "/properties", "u1", false).role).toBe("manager");
  });

  it("registers every named agency desk page", () => {
    const config = roleRouteConfigs.find((c) => c.role === "agency");
    const paths = (config?.routes ?? []).map((r) => r.path);
    expect(paths).toEqual(expect.arrayContaining([
      AGENCY_ROUTES.dashboard,
      AGENCY_ROUTES.clients,
      AGENCY_ROUTES.portfolio,
      "/agency/properties/:id",
      AGENCY_ROUTES.tenants,
      AGENCY_ROUTES.billing,
      AGENCY_ROUTES.reports,
      AGENCY_ROUTES.settings,
    ]));
  });
});
