import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("Phase 11 responsive certification contracts", () => {
  it("keeps dialogs inset on small screens instead of edge-to-edge", () => {
    const dialog = src("src/shared/components/ui/dialog.tsx");
    expect(dialog).toContain("w-[min(32rem,calc(100vw-1.5rem))]");
    expect(dialog).toContain("max-h-[min(90vh,calc(100dvh-1.5rem))]");
  });

  it("does not clip page titles — titles wrap, they do not truncate", () => {
    const header = src("src/shared/components/layout/PageHeader.tsx");
    expect(header).toContain("break-words");
    expect(header).not.toMatch(/page-title[^\n]*truncate/);
  });

  it("reflows manager search instead of locking a 256px field at tablet widths", () => {
    const header = src("src/shared/components/layout/Header.tsx");
    expect(header).toContain("hidden lg:flex");
    expect(header).toContain("lg:hidden");
    expect(header).not.toMatch(/hidden md:flex[\s\S]*w-64/);
  });

  it("gives tenant amounts a wrapping tabular display", () => {
    const home = src("src/features/tenant-portal/components/TenantHome.tsx");
    expect(home).toContain("amount-display");
    expect(home).toContain("PAY RENT");
    expect(home).not.toMatch(/text-4xl font-bold tracking-tight/);
  });

  it("keeps all five tenant mobile nav labels visible", () => {
    // The mobile nav items live in the shared navigation module; rendering
    // (and the "no truncate" contract) is owned by the shared desk shell,
    // which every portal's mobile nav — including the tenant's — renders through.
    const nav = src("src/shared/navigation/portalNavigation.ts");
    expect(nav).toContain('label: "Home"');
    expect(nav).toContain('label: "Bills"');
    expect(nav).toContain('label: "Fix"');
    expect(nav).toContain('label: "Docs"');
    expect(nav).toContain('label: "Me"');
    const shell = src("src/shared/components/layout/PortalDeskShell.tsx");
    const mobileNavRender = shell.split("visibleMobileNav.map")[1]?.split("</nav>")[0] ?? "";
    expect(mobileNavRender).toContain("{item.label}");
    expect(mobileNavRender).not.toContain("truncate");
  });

  it("does not hide the maintenance property column in the design preview", () => {
    const preview = src("src/features/design-preview/pages/DesignPreview.tsx");
    expect(preview).toContain("Ridgeview · 2B");
    expect(preview).not.toMatch(/TableHead className="hidden sm:table-cell">Property/);
    expect(preview).toContain("grid-cols-2 gap-2 sm:grid-cols-4");
  });

  it("scales page titles down on phones without dropping the type token", () => {
    const css = src("src/index.css");
    expect(css).toContain("font-size: 1.75rem");
    expect(css).toContain(".amount-display");
    expect(css).toContain(".chart-frame");
    expect(css).toContain("--breakpoint-xs: 24.375rem");
  });
});
