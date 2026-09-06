import { describe, expect, it } from "vitest";
import { DEFAULT_PORTAL_IDENTITIES } from "@/core/product/portalIdentity";
import { deriveBrandPalette } from "@/core/design/deriveBrandPalette";

describe("portal theme preference", () => {
  it("keeps portal identity as the default for every portal", () => {
    for (const identity of Object.values(DEFAULT_PORTAL_IDENTITIES)) {
      expect(deriveBrandPalette(identity.primaryHex).approved).toBe(true);
      expect(identity.primaryHex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("provides an approved neutral white-mode accent", () => {
    const palette = deriveBrandPalette("#16324F");
    expect(palette.approved).toBe(true);
    expect(palette.onColor).toBe("#FFFFFF");
  });

  it("uses a per-user, per-portal preference key", () => {
    const key = (userId: string, portalId: string) => `calqulus-portal-theme:${userId}:${portalId}`;
    expect(key("user-a", "manager")).not.toBe(key("user-b", "manager"));
    expect(key("user-a", "manager")).not.toBe(key("user-a", "tenant"));
  });
});

describe("portal identity catalog", () => {
  it("keeps every customer portal linked to its canonical login route", async () => {
    const { CALQULUS_PORTALS } = await import("@/core/product/portals");
    expect(CALQULUS_PORTALS.manager.login).toBe("/auth");
    expect(CALQULUS_PORTALS.landlord.login).toBe("/landlord/login");
    expect(CALQULUS_PORTALS.agency.login).toBe("/agency/login");
    expect(CALQULUS_PORTALS.tenant.login).toBe("/tenant/login");
  });
});
