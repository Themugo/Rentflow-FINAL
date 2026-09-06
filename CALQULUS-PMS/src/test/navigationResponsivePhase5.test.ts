import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync("src/shared/components/layout/PortalDeskShell.tsx", "utf8");
const sidebar = readFileSync("src/shared/components/layout/Sidebar.tsx", "utf8");

describe("navigation and responsive shell phase 5", () => {
  it("keeps portal navigation mobile-first and keyboard accessible", () => {
    expect(shell).toContain('aria-label={`${navLabel} mobile`}');
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
    expect(shell).toContain("safe-area-bottom");
    expect(shell).toContain("lg:hidden");
  });

  it("keeps manager sidebar collapsible without changing navigation data", () => {
    expect(sidebar).toContain("setCollapsed");
    expect(sidebar).toContain("aria-expanded={!collapsed}");
    expect(sidebar).toContain("onClick={handleNavClick}");
  });
});
