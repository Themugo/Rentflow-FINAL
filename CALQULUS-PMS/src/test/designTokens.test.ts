import { describe, expect, it } from "vitest";
import { BRAND_CHART_COLORS, CHART_STATUS_COLORS } from "@/shared/lib/chartColors";
import { CALQULUS_BRAND, CALQULUS_COLOR, CALQULUS_DARK_MODE, CALQULUS_FIELD, CALQULUS_ICON, CALQULUS_PORTAL_ACCENT, CALQULUS_PWA, CALQULUS_RADIUS, CALQULUS_SHADOW, CALQULUS_SPACE, CALQULUS_TYPE } from "@/shared/theme/tokens";
import { FOCUS_RING_STYLES } from "@/shared/lib/accessibility";

describe("CALQULUS design tokens", () => {
  it("names the product CALQULUS PMS", () => {
    expect(CALQULUS_BRAND.name).toBe("CALQULUS");
    expect(CALQULUS_BRAND.product).toBe("CALQULUS PMS");
    expect(CALQULUS_BRAND.iconFamily).toBe("lucide-react");
  });

  it("uses interactive blue as primary, not gold or cyan", () => {
    expect(CALQULUS_COLOR.primary).toBe("#123FB7");
    expect(CALQULUS_COLOR.primaryHover).toBe("#0F35A0");
    expect(CALQULUS_COLOR.primaryActive).toBe("#0B2B7A");
    expect(CALQULUS_COLOR.accent).toBe(CALQULUS_COLOR.primary);
    expect(CALQULUS_COLOR.primary).not.toBe("#C9A84C");
    expect(CALQULUS_COLOR.primary).not.toBe("#1AD4E4");
  });

  it("establishes navy as chrome, not a page fill", () => {
    // Deep navy is remapped to the mid step — darkest scale is out of chrome.
    expect(CALQULUS_COLOR.navyDeep).toBe("#31577E");
    expect(CALQULUS_COLOR.navyPrimary).toBe("#173650");
    expect(CALQULUS_COLOR.navySecondary).toBe("#31577E");
    expect(CALQULUS_COLOR.navyDeep).not.toBe("#0B2239");
    expect(CALQULUS_COLOR.navyDeep).not.toBe("#000000");
    expect(CALQULUS_COLOR.navyPrimary).not.toBe("#000000");
  });

  it("keeps light surfaces as the production background", () => {
    expect(CALQULUS_COLOR.background).toBe("#F6F8FB");
    expect(CALQULUS_COLOR.surface).toBe("#FFFFFF");
    expect(CALQULUS_COLOR.surfaceElevated).toBe("#F6F8FB");
    expect(CALQULUS_COLOR.white).toBe("#FFFFFF");
  });

  it("defines the full semantic palette", () => {
    expect(CALQULUS_COLOR.success).toBe("#2F8061");
    expect(CALQULUS_COLOR.warning).toBe("#A66A16");
    expect(CALQULUS_COLOR.danger).toBe("#B94A48");
    expect(CALQULUS_COLOR.info).toBe("#3E6FAE");
    expect(CALQULUS_COLOR.border).toBe("#DCE5EF");
    expect(CALQULUS_COLOR.textPrimary).toBe("#102A43");
    expect(CALQULUS_COLOR.textMuted).toBe("#5F7185");
    expect(CALQULUS_COLOR.focus).toBe(CALQULUS_COLOR.primary);
    expect(CALQULUS_COLOR.glow).toBe("#123FB7");
    expect(CALQULUS_COLOR.spark).toBe("#FFF4DF");
  });

  it("aligns PWA chrome with the live brand", () => {
    expect(CALQULUS_PWA.themeColor).toBe(CALQULUS_COLOR.navyPrimary);
    expect(CALQULUS_PWA.backgroundColor).toBe(CALQULUS_COLOR.background);
    expect(CALQULUS_PWA.themeColor).not.toBe("#C9A84C");
    expect(CALQULUS_PWA.backgroundColor).not.toBe("#0A1628");
  });

  it("classifies dark mode as dormant light-mirror", () => {
    expect(CALQULUS_DARK_MODE.status).toBe("dormant");
    expect(CALQULUS_DARK_MODE.productionExperience).toBe("light-desk");
    expect(CALQULUS_DARK_MODE.marketingChrome).toBe("navy-mid");
    expect(CALQULUS_DARK_MODE.cssStrategy).toBe("light-mirror");
  });

  it("keeps a shared interactive-blue focus ring, not a per-portal ring", () => {
    expect(FOCUS_RING_STYLES.default.outline).toContain(CALQULUS_COLOR.focus);
    expect(FOCUS_RING_STYLES.highContrast.outline).toContain(CALQULUS_COLOR.navyDeep);
  });

  it("exposes portal accents without replacing the desk system", () => {
    expect(CALQULUS_PORTAL_ACCENT.manager.hex).toBe("#356FE5");
    expect(CALQULUS_PORTAL_ACCENT.manager.label).toBe("Blue");
    expect(CALQULUS_PORTAL_ACCENT.landlord.hex).toBe("#2F9B74");
    expect(CALQULUS_PORTAL_ACCENT.landlord.label).toBe("Emerald");
    expect(CALQULUS_PORTAL_ACCENT.agency.hex).toBe("#123FB7");
    expect(CALQULUS_PORTAL_ACCENT.agency.label).toBe("CALQULUS Blue");
    expect(CALQULUS_PORTAL_ACCENT.tenant.hex).toBe("#7C5FD3");
    expect(CALQULUS_PORTAL_ACCENT.tenant.label).toBe("Violet");
    expect(CALQULUS_PORTAL_ACCENT.platform_admin.hex).toBe("#2C9183");
    expect(CALQULUS_PORTAL_ACCENT.platform_admin.label).toBe("Teal");
  });

  it("exposes spacing, radius, shadow, type, and field tokens", () => {
    expect(CALQULUS_SPACE[4]).toBe("1rem");
    expect(CALQULUS_RADIUS.card).toBe("0.75rem");
    expect(CALQULUS_SHADOW.card).toContain("16, 42, 67");
    expect(CALQULUS_TYPE.pageTitle).toBe("type-page-title");
    expect(CALQULUS_FIELD.error).toContain("text-destructive");
    expect(CALQULUS_ICON.md).toBe("h-4 w-4");
  });
});

describe("chart palette follows tokens", () => {
  it("leads with primary interactive blue", () => {
    expect(BRAND_CHART_COLORS[0]).toBe(CALQULUS_COLOR.primary);
  });

  it("does not introduce decorative indigo or sky leftovers", () => {
    expect(BRAND_CHART_COLORS).not.toContain("#4F46E5");
    expect(BRAND_CHART_COLORS).not.toContain("#7DD3FC");
  });

  it("maps status colors to semantic tokens", () => {
    expect(CHART_STATUS_COLORS.positive).toBe(CALQULUS_COLOR.success);
    expect(CHART_STATUS_COLORS.warning).toBe(CALQULUS_COLOR.warning);
    expect(CHART_STATUS_COLORS.negative).toBe(CALQULUS_COLOR.danger);
  });
});

describe("index.css Tailwind v4 production safety", () => {
  it("does not @apply custom type classes that break vite build", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    for (const name of ["page-title", "section-title", "card-title-exec", "metric-value", "meta-text"]) {
      expect(css).not.toMatch(new RegExp(`@apply\\s+${name}\\b`));
    }
  });

  it("keeps CSS variables in lockstep with the TypeScript palette", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    // Canonical --calqulus-* tokens carry the literal hex; semantic tokens
    // reference them so there is a single source of truth.
    expect(css).toContain(`--calqulus-primary: ${CALQULUS_COLOR.primary}`);
    expect(css).toContain(`--calqulus-navy-700: ${CALQULUS_COLOR.navySecondary}`);
    // navy-950 step stays in the scale but is no longer mapped into chrome.
    expect(css).toContain(`--calqulus-navy-950: #0B2239`);
    expect(css).toContain(`--calqulus-navy-900: ${CALQULUS_COLOR.navyPrimary}`);
    expect(css).toContain(`--calqulus-success: ${CALQULUS_COLOR.success}`);
    expect(css).toContain(`--calqulus-warning: ${CALQULUS_COLOR.warning}`);
    expect(css).toContain(`--calqulus-danger: ${CALQULUS_COLOR.danger}`);
    expect(css).toContain(`--calqulus-background: ${CALQULUS_COLOR.background}`);
    expect(css).toContain(`--calqulus-border: ${CALQULUS_COLOR.border}`);
    expect(css).toContain(`--calqulus-text: ${CALQULUS_COLOR.textPrimary}`);
    expect(css).toContain(`--calqulus-text-muted: ${CALQULUS_COLOR.textMuted}`);
    expect(css).toContain(`--calqulus-info: ${CALQULUS_COLOR.info}`);
    expect(css).toContain("--primary: var(--calqulus-primary)");
    expect(css).toContain("--navy-deep: var(--calqulus-navy-700)");
    expect(css).toContain("--background: var(--calqulus-background)");
    expect(css).toContain("--border: var(--calqulus-border)");
    expect(css).toContain("--foreground: var(--calqulus-text)");
    expect(css).toContain("--muted-foreground: var(--calqulus-text-muted)");
    expect(css).toContain("--ring: var(--calqulus-primary)");
    expect(css).toContain(`[data-portal="manager"] { --portal-accent: var(--calqulus-manager)`);
    expect(css).toContain(`[data-portal="landlord"] { --portal-accent: var(--calqulus-emerald)`);
    expect(css).toContain(`[data-portal="agency"] { --portal-accent: var(--calqulus-primary)`);
    expect(css).toContain(`[data-portal="tenant"] { --portal-accent: var(--calqulus-violet)`);
    expect(css).toContain(`[data-portal="platform_admin"] { --portal-accent: var(--calqulus-teal-deep)`);
  });
});
