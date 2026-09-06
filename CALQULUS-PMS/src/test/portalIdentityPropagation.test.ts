import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("portal identity propagation", () => {
  it("uses configured portal identity for shared login shells", () => {
    const source = readFileSync("src/features/auth/components/PortalLoginScreen.tsx", "utf8");
    expect(source).toContain("identities[portalId]");
    expect(source).toContain("identity?.primaryHex || accentHex");
    expect(source).toContain("identity?.backgroundImageUrl || backgroundImage");
    expect(source).toContain("identity?.shortName || portalName");
    expect(source).toContain("identity?.tagline || description");
  });

  it("uses configured accent for the Agency custom shell", () => {
    const source = readFileSync("src/features/auth/components/AgencyPortalChrome.tsx", "utf8");
    expect(source).toContain("const agencyAccent = identity.primaryHex || AGENCY_ACCENT");
  });
});
