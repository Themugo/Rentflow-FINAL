import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Portal entry visual contract", () => {
  const shared = readFileSync("src/features/auth/components/PortalLoginScreen.tsx", "utf8");
  it("keeps one shared full-bleed layout for all role-specific portal identities", () => {
    for (const token of ["portalId", "accentHex", "backgroundImage", "slogan", "features"]) expect(shared).toContain(token);
    expect(shared).toContain("min-h-screen");
    expect(shared).toContain("object-cover");
  });
  it("uses distinct configured portal identities", () => {
    const files = [
      ["agency", "AgencyPortalChrome.tsx"],
      ["manager", "ManagerPortalChrome.tsx"],
      ["landlord", "LandlordPortalChrome.tsx"],
      ["tenant", "TenantPortalChrome.tsx"],
    ] as const;
    for (const [portal, file] of files) {
      const source = readFileSync(`src/features/auth/components/${file}`, "utf8");
      expect(source).toContain(`portalId=\"${portal}\"`);
      expect(source).toContain("backgroundImage=");
      expect(source).toContain("slogan=");
    }
  });

  it("keeps the homepage and Agency entry aligned to the sharp CALQULUS blue", () => {
    const agency = readFileSync("src/features/auth/components/AgencyPortalChrome.tsx", "utf8");
    expect(agency).toContain("CALQULUS_PORTAL_ACCENT.agency.hex");
    expect(agency).toContain("AGENCY_ACCENT");
  });
});
