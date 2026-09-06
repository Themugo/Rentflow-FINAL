import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";
import {
  getContrastRatio,
  meetsWCAG_AA,
  MIN_TOUCH_TARGET_SIZE,
  RECOMMENDED_TOUCH_TARGET_SIZE,
} from "@/shared/lib/accessibility";

const src = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

/** On-surface amber used by `.text-warning` — the muted amber token itself. */
const WARNING_TEXT = "#855512";

describe("Phase 12 accessibility certification contracts", () => {
  it("sizes default and icon buttons to the 44px recommended touch target", () => {
    const button = src("src/shared/components/ui/button.tsx");
    expect(button).toContain('default: "min-h-11 h-11 px-4 py-2"');
    expect(button).toContain('icon:    "min-h-11 min-w-11 h-11 w-11 rounded-md"');
    expect(button).toContain('aria-hidden="true"');
    expect(RECOMMENDED_TOUCH_TARGET_SIZE).toBe(44);
    expect(MIN_TOUCH_TARGET_SIZE).toBe(24);
  });

  it("keeps checkboxes and radios at least 24px for WCAG 2.5.8", () => {
    expect(src("src/shared/components/ui/checkbox.tsx")).toContain("h-6 w-6");
    expect(src("src/shared/components/ui/radio-group.tsx")).toContain("h-6 w-6");
  });

  it("gives table column headers scope and select triggers a visible focus ring", () => {
    const table = src("src/shared/components/ui/table.tsx");
    expect(table).toContain('scope = "col"');
    const select = src("src/shared/components/ui/select.tsx");
    expect(select).toContain("min-h-11");
    expect(select).toContain("focus-visible:ring-2");
    expect(select).not.toMatch(/focus:ring-2 focus:ring-ring/);
  });

  it("uses a span badge and a non-heading alert title", () => {
    const badge = src("src/shared/components/ui/badge.tsx");
    expect(badge).toContain("HTMLSpanElement");
    expect(badge).toContain("return <span");
    const alert = src("src/shared/components/ui/alert.tsx");
    expect(alert).toContain('role="alert"');
    expect(alert).not.toContain("<h5");
  });

  it("labels dialog and sheet close controls for screen readers", () => {
    const dialog = src("src/shared/components/ui/dialog.tsx");
    expect(dialog).toContain("sr-only");
    expect(dialog).toContain(">Close<");
    expect(dialog).toContain("h-11 w-11");
    const sheet = src("src/shared/components/ui/sheet.tsx");
    expect(sheet).toContain("sr-only");
    expect(sheet).toContain(">Close<");
  });

  it("exposes charts as labelled images", () => {
    const chart = src("src/shared/components/ui/chart.tsx");
    expect(chart).toContain('role="img"');
    expect(chart).toContain('aria-label="Chart"');
  });

  it("marks the current page on every portal nav", () => {
    // Manager keeps its own Sidebar; the landlord/agency/webhost/tenant desks
    // were centralized onto the shared PortalDeskShell, which carries the
    // aria-current marking for all of them.
    expect(src("src/shared/components/layout/Sidebar.tsx")).toContain('aria-current={active ? "page" : undefined}');
    expect(src("src/shared/components/layout/PortalDeskShell.tsx")).toContain('aria-current={active ? "page" : undefined}');
    for (const layout of [
      "src/features/landlord/components/LandlordLayout.tsx",
      "src/features/agency/components/AgencyLayout.tsx",
      "src/features/webhost/components/WebhostLayout.tsx",
      "src/features/tenant-portal/components/TenantLayout.tsx",
    ]) {
      expect(src(layout)).toContain("PortalDeskShell");
    }
  });

  it("keeps skip links on public, design-preview, and every desk", () => {
    expect(src("src/features/marketing/components/PublicShell.tsx")).toContain("Skip to content");
    expect(src("src/features/design-preview/pages/DesignPreview.tsx")).toContain("Skip to main content");
    expect(src("src/features/design-preview/pages/ShellPreviewPage.tsx")).toContain("Skip to main content");
    expect(src("src/features/design-preview/pages/ManagerDashboardPreviewPage.tsx")).toContain("Skip to main content");
    expect(src("src/features/design-preview/pages/ManagerPropertiesPreviewPage.tsx")).toContain("Skip to main content");
    expect(src("src/features/design-preview/pages/ManagerTenantsPreviewPage.tsx")).toContain("Skip to main content");
    expect(src("src/shared/components/layout/Layout.tsx")).toContain("Skip to main content");
    // The landlord/agency/webhost/tenant desks render through the shared
    // PortalDeskShell, which owns the skip link for all of them now.
    expect(src("src/shared/components/layout/PortalDeskShell.tsx")).toContain("Skip to main content");
    for (const layout of [
      "src/features/landlord/components/LandlordLayout.tsx",
      "src/features/agency/components/AgencyLayout.tsx",
      "src/features/webhost/components/WebhostLayout.tsx",
      "src/features/tenant-portal/components/TenantLayout.tsx",
    ]) {
      expect(src(layout)).toContain("PortalDeskShell");
    }
  });

  it("makes lease filter cards and tenant inbox cards keyboard-activatable", () => {
    const leases = src("src/features/leases/pages/Leases.tsx");
    expect(leases).toContain("onActivateKey");
    expect(leases).toContain('role="button"');
    expect(leases).toContain("aria-pressed");
    const inbox = src("src/features/tenant-portal/pages/TenantInbox.tsx");
    expect(inbox).toContain("onActivateKey");
    expect(inbox).toContain('role="button"');
  });

  it("wires form errors and labels without changing field behaviour", () => {
    const auth = src("src/features/auth/pages/Auth.tsx");
    expect(auth).toContain('aria-invalid={!!signupEmailError}');
    expect(auth).toContain('id="signup-email-error"');
    expect(auth).toContain('role="alert"');
    const statement = src("src/features/landlord/components/LandlordFinancialStatement.tsx");
    expect(statement).toContain('htmlFor="statement-period"');
    expect(statement).toContain('id="statement-period"');
    const units = src("src/features/units/components/UnitManagement.tsx");
    expect(units).toContain('htmlFor="bulk-prefix"');
    expect(units).toContain('id="bulk-prefix"');
  });

  it("respects reduced motion", () => {
    const css = src("src/index.css");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms !important");
  });

  it("meets WCAG AA contrast for body, muted, success, danger, and interactive blue", () => {
    const { textPrimary, textMuted, success, danger, primary, white, background } = CALQULUS_COLOR;
    expect(meetsWCAG_AA(textPrimary, white)).toBe(true);
    expect(meetsWCAG_AA(textPrimary, background)).toBe(true);
    expect(meetsWCAG_AA(textMuted, white)).toBe(true);
    expect(meetsWCAG_AA(textMuted, background)).toBe(true);
    expect(meetsWCAG_AA(success, white)).toBe(true);
    expect(meetsWCAG_AA(danger, white)).toBe(true);
    expect(meetsWCAG_AA(primary, white)).toBe(true);
    expect(meetsWCAG_AA(white, primary)).toBe(true);
    expect(meetsWCAG_AA(white, CALQULUS_COLOR.navyPrimary)).toBe(true);
  });

  it("keeps the locked warning fill and uses a darker amber for small text", () => {
    expect(CALQULUS_COLOR.warning).toBe("#A66A16");
    expect(getContrastRatio(CALQULUS_COLOR.warning, CALQULUS_COLOR.white)).toBeGreaterThanOrEqual(3);
    expect(meetsWCAG_AA(CALQULUS_COLOR.warning, CALQULUS_COLOR.white, true)).toBe(true);
    expect(meetsWCAG_AA(WARNING_TEXT, CALQULUS_COLOR.white)).toBe(true);
    expect(meetsWCAG_AA(WARNING_TEXT, CALQULUS_COLOR.background)).toBe(true);
    expect(src("src/index.css")).toContain("--warning-text: var(--calqulus-warning-text)");
    expect(src("src/index.css")).toContain("--primary-text: var(--calqulus-primary-active)");
    expect(src("src/index.css")).toContain("--success-text: var(--calqulus-success-text)");
    expect(src("src/index.css")).toContain("--destructive-text: var(--calqulus-danger-text)");
    expect(src("src/index.css")).toContain("color: var(--warning-text)");
    expect(meetsWCAG_AA(CALQULUS_COLOR.primaryActive, CALQULUS_COLOR.white)).toBe(true);
    expect(meetsWCAG_AA(CALQULUS_COLOR.primaryActive, CALQULUS_COLOR.background)).toBe(true);
  });
});
