import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sidebar = readFileSync("src/shared/components/layout/Sidebar.tsx", "utf8");
const shell = readFileSync("src/shared/components/layout/PortalDeskShell.tsx", "utf8");

describe("phases 170-171 navigation role and information architecture", () => {
  it("communicates the active workspace before role-specific navigation", () => {
    expect(sidebar).toContain('"Platform control"');
    expect(sidebar).toContain('"Agency workspace"');
    expect(sidebar).toContain('"Landlord workspace"');
    expect(sidebar).toContain('"Tenant workspace"');
    expect(sidebar).toContain('"Property management"');
  });

  it("gives each portal navigation group an accessible heading relationship", () => {
    expect(shell).toContain("aria-labelledby={groupId}");
    expect(shell).toContain('id={groupId}');
  });

  it("keeps keyboard focus visible on portal navigation links", () => {
    expect(shell).toContain("focus-visible:ring-2");
    expect(shell).toContain("aria-current={active ? \"page\" : undefined}");
  });
});
