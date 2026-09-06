import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("CALQULUS mobile application experience", () => {
  it("gives every authenticated portal a thumb-first bottom navigation", () => {
    const navigation = read("shared/navigation/portalNavigation.ts");
    expect(navigation).toContain("export const MANAGER_MOBILE_NAV");
    expect(navigation).toContain("export const AGENCY_MOBILE_NAV");
    expect(navigation).toContain("export const LANDLORD_MOBILE_NAV");
    expect(navigation).toContain("export const TENANT_MOBILE_NAV");
    expect(navigation).toContain("export const WEBHOST_MOBILE_NAV");
  });

  it("uses the shared app shell instead of separate mobile shells", () => {
    const shell = read("shared/components/layout/PortalDeskShell.tsx");
    expect(shell).toContain("mobile-app-surface");
    expect(shell).toContain("mobileNavLabel");
    expect(shell).toContain("Open ${mobileNavLabel} menu");
    expect(shell).toContain("slice(0, 4)");
    expect(shell).toContain("MoreHorizontal");
  });

  it("removes desktop page chrome and reserves space for phone navigation", () => {
    const shell = read("shared/components/layout/PortalDeskShell.tsx");
    expect(shell).toContain('mobileNav && "hidden md:block"');
    expect(shell).toContain('mobileNav && "mobile-app-surface"');
    expect(shell).toContain('mobileContentPadding');
  });

  it("protects touch behavior and mobile viewport ergonomics", () => {
    const css = read("index.css");
    expect(css).toContain("overscroll-behavior-y: none");
    expect(css).toContain("-webkit-tap-highlight-color: transparent");
    expect(css).toContain("input, select, textarea");
    expect(css).toContain("font-size: 16px");
    expect(css).toContain("100dvh");
  });
});
