import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const nav = readFileSync(resolve(root, "src/shared/navigation/portalNavigation.ts"), "utf8");
const dashboard = readFileSync(resolve(root, "src/features/agency/pages/AgencyDashboard.tsx"), "utf8");
const paths = readFileSync(resolve(root, "src/features/agency/lib/agencyPaths.ts"), "utf8");
const routes = readFileSync(resolve(root, "src/app/routes.ts"), "utf8");

describe("Agency portal UX and workflow sweep", () => {
  it("keeps one canonical Agency navigation definition", () => {
    expect(nav).toContain("export const AGENCY_NAV_GROUPS");
    expect(nav.match(/export const AGENCY_NAV_GROUPS/g)?.length).toBe(1);
    expect(nav).toContain('label: "Agency controls"');
  });

  it("keeps dashboard language aligned with configurable client mandates", () => {
    expect(dashboard).toContain("follows client mandate");
    expect(dashboard).toContain("Recorded collections versus outstanding invoices across the client book");
    expect(dashboard).toContain("Agency controls");
  });

  it("keeps every Agency navigation destination on the canonical route surface", () => {
    const hrefs = [...nav.matchAll(/href:\s*(AGENCY(?:_OPS)?_ROUTES\.[A-Za-z0-9_]+)/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(10);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(paths).toContain(`${href.split(".")[1]}`);
    expect(routes).toContain("AgencyDashboard");
    expect(routes).toContain("AgencySettings");
  });

  it("does not introduce a second Agency portal shell", () => {
    const shellImports = nav.match(/PortalDeskNavGroup/g)?.length ?? 0;
    expect(shellImports).toBeGreaterThan(0);
    expect(dashboard).toContain("<AgencyLayout");
  });
});
