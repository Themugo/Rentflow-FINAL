import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DESK_NAV_ACTIVE, SIDEBAR_NAV_ACTIVE } from "@/core/design/deskNav";

describe("Phase 10 desk polish", () => {
  it("selects navigation with interactive blue, not portal fill", () => {
    expect(DESK_NAV_ACTIVE).toContain("bg-primary/10");
    // Navy rail: unmistakable solid blue selected state.
    expect(SIDEBAR_NAV_ACTIVE).toContain("bg-primary/85");
    expect(SIDEBAR_NAV_ACTIVE).toContain("text-primary-foreground");
    expect(DESK_NAV_ACTIVE).not.toContain("portal-accent");
    expect(SIDEBAR_NAV_ACTIVE).not.toContain("portal-accent");
  });

  it("does not fill the manager rail with portal accent", () => {
    const source = readFileSync(join(process.cwd(), "src/shared/components/layout/Sidebar.tsx"), "utf8");
    expect(source).not.toContain("portal-accent-muted");
    expect(source).toContain("sidebarNavClass");
  });

  it("keeps the unused marketing canvas as a re-export of the live homepage", () => {
    const source = readFileSync(join(process.cwd(), "src/features/marketing/MarketingWebsite.tsx"), "utf8");
    expect(source).toContain("PublicLandingPage");
    expect(source).not.toMatch(/\bemerald-\d/);
    expect(source).not.toContain("bg-slate-950");
  });
});
