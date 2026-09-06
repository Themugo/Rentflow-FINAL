import { describe, it, expect } from "vitest";
import {
  BRAND_CHART_COLORS,
  CHART_STATUS_COLORS,
  brandChartColor,
} from "@/shared/lib/chartColors";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";

describe("BRAND_CHART_COLORS", () => {
  it("leads with the interactive-blue primary token", () => {
    expect(BRAND_CHART_COLORS[0]).toBe(CALQULUS_COLOR.primary);
  });

  it("places secondary navy second for identity series", () => {
    expect(BRAND_CHART_COLORS[1]).toBe(CALQULUS_COLOR.navySecondary);
  });

  it("contains a fixed palette of 8 colors", () => {
    expect(BRAND_CHART_COLORS).toHaveLength(8);
  });

  it("reserves success for positive values", () => {
    expect(BRAND_CHART_COLORS).toContain(CALQULUS_COLOR.success);
  });

  it("reserves danger for negative values", () => {
    expect(BRAND_CHART_COLORS).toContain(CALQULUS_COLOR.danger);
  });
});

describe("CHART_STATUS_COLORS", () => {
  it("maps positive to the success token", () => {
    expect(CHART_STATUS_COLORS.positive).toBe(CALQULUS_COLOR.success);
  });

  it("maps warning to the warning token", () => {
    expect(CHART_STATUS_COLORS.warning).toBe(CALQULUS_COLOR.warning);
  });

  it("maps negative to the danger token", () => {
    expect(CHART_STATUS_COLORS.negative).toBe(CALQULUS_COLOR.danger);
  });

  it("maps neutral to muted text", () => {
    expect(CHART_STATUS_COLORS.neutral).toBe(CALQULUS_COLOR.textMuted);
  });
});

describe("brandChartColor", () => {
  it("returns the first palette color for index 0", () => {
    expect(brandChartColor(0)).toBe(BRAND_CHART_COLORS[0]);
  });

  it("returns the last palette color for the maximum in-bounds index", () => {
    expect(brandChartColor(BRAND_CHART_COLORS.length - 1)).toBe(
      BRAND_CHART_COLORS[BRAND_CHART_COLORS.length - 1]
    );
  });

  it("wraps around to the start when the index equals the palette length", () => {
    expect(brandChartColor(BRAND_CHART_COLORS.length)).toBe(BRAND_CHART_COLORS[0]);
  });

  it("wraps around correctly for large indices", () => {
    expect(brandChartColor(BRAND_CHART_COLORS.length + 3)).toBe(BRAND_CHART_COLORS[3]);
  });

  it("wraps around for a multiple of the palette length", () => {
    expect(brandChartColor(BRAND_CHART_COLORS.length * 2)).toBe(BRAND_CHART_COLORS[0]);
  });
});
