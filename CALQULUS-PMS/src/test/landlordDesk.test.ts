import { describe, expect, it } from "vitest";
import { isLandlordDeskPath, isLandlordPublicPath, LANDLORD_ROUTES, landlordPropertyPath } from "@/features/landlord/lib/landlordPaths";
import { pickRoleForPath } from "@/features/auth/lib/roleResolution";
import { roleRouteConfigs } from "@/app/routes";

describe("landlord desk paths", () => {
  it("treats portfolio and property detail as landlord desk", () => {
    expect(isLandlordDeskPath("/landlord/dashboard")).toBe(true);
    expect(isLandlordDeskPath("/landlord/portfolio")).toBe(true);
    expect(isLandlordDeskPath("/landlord/financials")).toBe(true);
    expect(isLandlordDeskPath("/landlord/statements")).toBe(true);
    expect(isLandlordDeskPath("/landlord/maintenance")).toBe(true);
    expect(isLandlordDeskPath("/landlord/documents")).toBe(true);
    expect(isLandlordDeskPath("/landlord/settings")).toBe(true);
    expect(isLandlordDeskPath(landlordPropertyPath("abc"))).toBe(true);
  });

  it("does not treat login, invitation, or the manager landlords list as the desk", () => {
    expect(isLandlordPublicPath("/landlord/login")).toBe(true);
    expect(isLandlordDeskPath("/landlord/login")).toBe(false);
    expect(isLandlordDeskPath("/landlord/invitation")).toBe(false);
    expect(isLandlordDeskPath("/landlord")).toBe(false);
    expect(isLandlordDeskPath("/landlords")).toBe(false);
    expect(isLandlordDeskPath("/properties")).toBe(false);
  });
});

describe("landlord role routing", () => {
  const manager = { role: "manager" as const, tenant_id: null, approval_status: "approved" as const };
  const landlord = { role: "landlord" as const, tenant_id: null, approval_status: "approved" as const };

  it("keeps a dual-role user on landlord desk pages", () => {
    expect(pickRoleForPath([manager, landlord], LANDLORD_ROUTES.portfolio, "u1", false).role).toBe("landlord");
    expect(pickRoleForPath([manager, landlord], landlordPropertyPath("p1"), "u1", false).role).toBe("landlord");
    expect(pickRoleForPath([manager, landlord], "/properties", "u1", false).role).toBe("manager");
  });

  it("registers every named landlord desk page", () => {
    const config = roleRouteConfigs.find((c) => c.role === "landlord");
    const paths = (config?.routes ?? []).map((r) => r.path);
    expect(paths).toEqual(expect.arrayContaining([
      LANDLORD_ROUTES.dashboard,
      LANDLORD_ROUTES.portfolio,
      "/landlord/properties/:id",
      LANDLORD_ROUTES.financials,
      LANDLORD_ROUTES.statements,
      LANDLORD_ROUTES.maintenance,
      LANDLORD_ROUTES.documents,
      LANDLORD_ROUTES.settings,
    ]));
  });
});
