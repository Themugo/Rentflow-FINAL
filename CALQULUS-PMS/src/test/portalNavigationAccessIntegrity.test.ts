import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { roleRouteConfigs } from "@/app/routes";
import {
  AGENCY_NAV_GROUPS,
  LANDLORD_NAV_GROUPS,
  MANAGER_NAV_GROUPS,
  TENANT_NAV_GROUPS,
  WEBHOST_NAV_GROUPS,
} from "@/shared/navigation/portalNavigation";

function flatten(groups: { items: { href: string }[] }[]) {
  return groups.flatMap((group) => group.items.map((item) => item.href));
}

function routeSet(role: string) {
  const config = roleRouteConfigs.find((item) => item.role === role);
  expect(config, `missing route config for ${role}`).toBeDefined();
  return new Set(config?.routes.map((route) => route.path));
}

describe("Portal Navigation & Access Integrity", () => {
  it("uses the canonical portal navigation model in the legacy shared sidebar", () => {
    const sidebar = readFileSync("src/shared/components/layout/Sidebar.tsx", "utf8");
    expect(sidebar).toContain('from "@/shared/navigation/portalNavigation"');
    expect(sidebar).toContain("MANAGER_NAV_GROUPS");
    expect(sidebar).toContain("WEBHOST_NAV_GROUPS");
    expect(sidebar).toContain("AGENCY_NAV_GROUPS");
    expect(sidebar).toContain("LANDLORD_NAV_GROUPS");
    expect(sidebar).toContain("TENANT_NAV_GROUPS");
    expect(sidebar).not.toContain('const managerNavGroups: NavGroup[] = [');
    expect(sidebar).not.toContain('const agencyNavGroups: NavGroup[] = [');
  });

  it("keeps every primary portal nav target owned by that portal's route table", () => {
    const checks = [
      ["manager", MANAGER_NAV_GROUPS],
      ["agency", AGENCY_NAV_GROUPS],
      ["landlord", LANDLORD_NAV_GROUPS],
      ["tenant", TENANT_NAV_GROUPS],
      ["webhost", WEBHOST_NAV_GROUPS],
    ] as const;

    for (const [role, groups] of checks) {
      const routes = routeSet(role);
      for (const href of flatten(groups)) {
        expect(routes.has(href), `${role}: missing route ${href}`).toBe(true);
      }
    }
  });

  it("binds every permission-bearing webhost nav item to the same route guard", () => {
    const config = roleRouteConfigs.find((item) => item.role === "webhost");
    const routes = new Map(config?.routes.map((route) => [route.path, route]));
    for (const item of WEBHOST_NAV_GROUPS.flatMap((group) => group.items)) {
      if (!item.permission) continue;
      const route = routes.get(item.href);
      expect(route, `webhost: missing route ${item.href}`).toBeDefined();
      expect(route?.requirePermission, `webhost: ${item.href} permission drift`).toBe(item.permission);
    }
  });

  it("defines explicit wrong-portal redirects for every authenticated desk", () => {
    const expected: Record<string, string[]> = {
      manager: ["/agency/*", "/landlord/*", "/webhost/*"],
      submanager: ["/agency/*", "/landlord/*", "/portal/*", "/webhost/*"],
      agency: ["/", "/landlord/*", "/portal/*", "/webhost/*"],
      landlord: ["/", "/agency/*", "/portal/*", "/webhost/*"],
      tenant: ["/", "/agency/*", "/landlord/*", "/webhost/*"],
      webhost: ["/", "/agency/*", "/landlord/*", "/portal/*"],
    };

    for (const [role, paths] of Object.entries(expected)) {
      const config = roleRouteConfigs.find((item) => item.role === role);
      expect(config, role).toBeDefined();
      const redirects = new Map(config?.routes.filter((route) => route.redirect).map((route) => [route.path, route.redirect]));
      for (const path of paths) expect(redirects.has(path), `${role}: missing boundary ${path}`).toBe(true);
    }
  });

  it("does not duplicate canonical navigation targets within a portal", () => {
    for (const [role, groups] of [
      ["manager", MANAGER_NAV_GROUPS],
      ["agency", AGENCY_NAV_GROUPS],
      ["landlord", LANDLORD_NAV_GROUPS],
      ["tenant", TENANT_NAV_GROUPS],
      ["webhost", WEBHOST_NAV_GROUPS],
    ] as const) {
      const hrefs = flatten(groups);
      expect(new Set(hrefs).size, role).toBe(hrefs.length);
    }
  });
});
