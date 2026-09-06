import { describe, expect, it } from "vitest";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";
import { approvedBrandHex, deriveBrandPalette, isForbiddenFloor, mixHex } from "@/core/design/deriveBrandPalette";
import { PLATFORM_BRAND_CONFIG } from "@/core/brand/platformBrand";
import { CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";

describe("deriveBrandPalette", () => {
  it("approves CALQULUS interactive blue and derives hover/active/surface", () => {
    const palette = deriveBrandPalette(CALQULUS_COLOR.primary);
    expect(palette.approved).toBe(true);
    expect(palette.hex).toBe(CALQULUS_COLOR.primary);
    expect(palette.hover).not.toBe(palette.hex);
    expect(palette.active).not.toBe(palette.hex);
    expect(palette.surface).not.toBe(palette.hex);
  });

  it("rejects near-black floors", () => {
    expect(isForbiddenFloor("#000000")).toBe(true);
    expect(isForbiddenFloor("#040B16")).toBe(true);
    expect(isForbiddenFloor(CALQULUS_COLOR.navyDeep)).toBe(false);
    const palette = deriveBrandPalette("#000000");
    expect(palette.approved).toBe(false);
    expect(approvedBrandHex("#000000")).toBe(CALQULUS_COLOR.primary);
  });

  it("rejects colours that cannot sit on a white desk", () => {
    const palette = deriveBrandPalette("#FFFF00");
    expect(palette.approved).toBe(false);
    expect(palette.reasons.length).toBeGreaterThan(0);
    expect(approvedBrandHex("#FFFF00")).toBe(CALQULUS_COLOR.primary);
  });

  it("approves every Design Bible portal accent", () => {
    for (const accent of Object.values(CALQULUS_PORTAL_ACCENT)) {
      expect(deriveBrandPalette(accent.hex).approved).toBe(true);
    }
  });

  it("mixes towards white without leaving hex space", () => {
    expect(mixHex("#0000FF", "#FFFFFF", 0)).toBe("#0000FF");
    expect(mixHex("#0000FF", "#FFFFFF", 1)).toBe("#FFFFFF");
  });
});

describe("platform BrandConfig portal accents", () => {
  it("uses the Design Bible portal tokens", () => {
    expect(PLATFORM_BRAND_CONFIG.colors.portalAccents.manager).toBe(CALQULUS_PORTAL_ACCENT.manager.hex);
    expect(PLATFORM_BRAND_CONFIG.colors.portalAccents.landlord).toBe(CALQULUS_PORTAL_ACCENT.landlord.hex);
    expect(PLATFORM_BRAND_CONFIG.colors.portalAccents.agency).toBe(CALQULUS_PORTAL_ACCENT.agency.hex);
    expect(PLATFORM_BRAND_CONFIG.colors.portalAccents.tenant).toBe(CALQULUS_PORTAL_ACCENT.tenant.hex);
    expect(PLATFORM_BRAND_CONFIG.colors.portalAccents.platformAdmin).toBe(CALQULUS_PORTAL_ACCENT.platform_admin.hex);
  });
});
