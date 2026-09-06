import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WEBHOST_NAV_GROUPS } from "@/shared/navigation/portalNavigation";
import { roleRouteConfigs } from "@/app/routes";

describe("WebHost master control room", () => {
  it("organizes the non-tenant platform control surface", () => {
    const labels = WEBHOST_NAV_GROUPS.map((group) => group.label);
    expect(labels).toEqual([
      "Master control",
      "Platform operations",
      "Commercial control",
      "Access & public experience",
      "Exceptions",
      "Account",
    ]);

    const hrefs = WEBHOST_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain("/webhost/users");
    expect(hrefs).toContain("/webhost/public-site");
    expect(hrefs).toContain("/webhost/billing-rules");
    expect(hrefs).toContain("/webhost/custom-pricing");
  });

  it("keeps navigation permissions aligned with route guards", () => {
    const routes = new Map(
      roleRouteConfigs.find((config) => config.role === "webhost")?.routes.map((route) => [route.path, route]),
    );
    for (const item of WEBHOST_NAV_GROUPS.flatMap((group) => group.items)) {
      if (!item.permission) continue;
      expect(routes.get(item.href)?.requirePermission, item.href).toBe(item.permission);
    }
  });

  it("keeps the dashboard framed as the platform-wide master control room", () => {
    const dashboard = readFileSync("src/features/webhost/pages/AdminDashboard.tsx", "utf8");
    expect(dashboard).toContain("Master platform control room");
    expect(dashboard).toContain("Master control room");
    expect(dashboard).toContain("People & organizations");
    expect(dashboard).toContain("Commercial control");
    expect(dashboard).toContain("Access & public experience");
    expect(dashboard).toContain("Tenant records are deliberately outside");
  });

  it("keeps non-tenant users as the explicit user-registry contract", () => {
    const users = readFileSync("src/features/webhost/pages/AdminUsers.tsx", "utf8");
    expect(users).toContain("Master user registry for every non-tenant account");
    expect(users).toContain("Tenant accounts are intentionally excluded");
  });
});
