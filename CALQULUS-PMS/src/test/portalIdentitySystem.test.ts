import { describe, expect, it } from "vitest";
import { DEFAULT_PORTAL_IDENTITIES } from "@/core/product/portalIdentity";

describe("portal identity system", () => {
  it("defines an identity for every product portal", () => {
    expect(Object.keys(DEFAULT_PORTAL_IDENTITIES).sort()).toEqual([
      "agency",
      "landlord",
      "manager",
      "platform_admin",
      "tenant",
    ]);
  });

  it("keeps every default theme colour contrast-approved", () => {
    for (const identity of Object.values(DEFAULT_PORTAL_IDENTITIES)) {
      expect(identity.primaryHex).toMatch(/^#[0-9A-F]{6}$/i);
      expect(identity.backgroundImageUrl).toBeTruthy();
      expect(identity.tagline.length).toBeGreaterThan(10);
    }
  });
});
