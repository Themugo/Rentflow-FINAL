import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ADMIN_SURFACE_ACCENT,
  WEBHOST_ROUTES,
  webhostSurface,
  webhostSurfaceLabel,
} from "@/features/webhost/lib/webhostPaths";
import { roleRouteConfigs } from "@/app/routes";

const root = resolve(__dirname, "..");

function source(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("admin + webhost identities", () => {
  it("has an indigo admin accent token alongside the teal webhost accent", () => {
    const css = source("index.css");
    expect(css).toContain("--calqulus-indigo: #4658C9");
    expect(css).toContain("--calqulus-teal-deep: #2C9183");
    expect(ADMIN_SURFACE_ACCENT).toBe("var(--calqulus-indigo)");
  });

  it("splits surfaces: control-plane is infrastructure, admin is platform control", () => {
    expect(webhostSurface("/webhost")).toBe("control-plane");
    expect(webhostSurface("/webhost/applications")).toBe("control-plane");
    expect(webhostSurface("/webhost/applications/calqulus-pms")).toBe("control-plane");
    expect(webhostSurface("/webhost/deployments")).toBe("control-plane");
    expect(webhostSurface("/webhost/operations")).toBe("control-plane");
    for (const adminPath of [
      "/webhost/organizations",
      "/webhost/organizations/abc",
      "/webhost/users",
      "/webhost/subscriptions",
      "/webhost/audit",
      "/webhost/security",
      "/webhost/settings",
      "/webhost/issues",
    ]) {
      expect(webhostSurface(adminPath)).toBe("admin");
    }
  });

  it("labels surfaces for the header breadcrumb", () => {
    expect(webhostSurfaceLabel("control-plane")).toBe("WebHost");
    expect(webhostSurfaceLabel("admin")).toBe("Admin");
  });
});

describe("webhost layout — control plane vs administration", () => {
  const layout = source("features/webhost/components/WebhostLayout.tsx");
  // Nav groups/items now live in the shared navigation module; WebhostLayout
  // only owns the visibility/permission gating for them.
  const nav = source("shared/navigation/portalNavigation.ts");

  it("groups nav into Control plane / Administration / Account", () => {
    for (const group of ['"Control plane"', '"Administration"', '"Account"']) {
      expect(nav).toContain(`label: ${group}`);
    }
  });

  it("prioritizes Applications, Deployments, Operations on the control plane", () => {
    const controlPlane = nav.split('"Control plane"')[1]?.split('"Administration"')[0] ?? "";
    for (const item of ['"Dashboard"', '"Applications"', '"Deployments"', '"Operations"']) {
      expect(controlPlane).toContain(`label: ${item}`);
    }
  });

  it("keeps admin control (orgs, users, subscriptions, audit, security) in Administration", () => {
    const admin = nav.split('"Administration"')[1]?.split('"Account"')[0] ?? "";
    for (const item of ['"Organizations"', '"Users"', '"Subscriptions"', '"Audit Log"', '"Security"']) {
      expect(admin).toContain(`label: ${item}`);
    }
  });

  it("applies the indigo accent only on admin surfaces", () => {
    expect(layout).toContain('surface === "admin"');
    expect(layout).toContain("ADMIN_SURFACE_ACCENT");
    expect(layout).toContain("webhostSurfaceLabel(surface)");
  });
});

describe("status vocabulary — never colour alone", () => {
  const cell = source("features/webhost/components/operations/ServiceStatusCell.tsx");

  it("renders dot + icon + text label for every status", () => {
    expect(cell).toContain("never colour alone");
    expect(cell).toContain("StatusIcon");
    expect(cell).toContain("meta.label");
    expect(cell).toContain("meta.dot");
  });

  it("uses the four canonical statuses", () => {
    const infra = source("features/webhost/lib/infrastructure.ts");
    for (const status of ["operational", "warning", "degraded", "down"]) {
      expect(infra).toContain(`${status}:`);
    }
    for (const label of ['"Operational"', '"Warning"', '"Degraded"', '"Down"']) {
      expect(infra).toContain(`label: ${label}`);
    }
  });
});

describe("secrets never reach the screen", () => {
  it("audit log viewers mask metadata through the shared secrets lib", () => {
    for (const rel of [
      "features/webhost/components/ActivityLog.tsx",
      "features/webhost/components/SecurityAuditLogs.tsx",
    ]) {
      const src = source(rel);
      expect(src).toContain("stringifyMasked");
      expect(src).not.toContain("JSON.stringify(entry.metadata");
      expect(src).not.toContain("JSON.stringify(log.metadata");
      expect(src).not.toContain("JSON.stringify(selectedLog.metadata");
    }
  });

  it("error logs use the shared isSecretKey — no duplicated pattern", () => {
    const src = source("features/webhost/components/ErrorLogsTab.tsx");
    expect(src).toContain("import { isSecretKey } from '@/features/webhost/lib/secrets'");
    expect(src).not.toContain("const isSecretKey =");
  });

  it("the secret pattern covers passwords, tokens, api keys, private keys, secrets", () => {
    const secrets = source("features/webhost/lib/secrets.ts");
    for (const shape of ["password", "secret", "token", "api[_-]?key", "private[_-]?key"]) {
      expect(secrets).toContain(shape);
    }
  });
});

describe("authorization model unchanged", () => {
  it("all webhost routes stay protected", () => {
    const config = roleRouteConfigs.find((entry) => entry.role === "webhost");
    const desk = (config?.routes ?? []).filter((route) => route.path.startsWith("/webhost") && route.path !== "/webhost/invite");
    for (const route of desk) {
      if (route.redirect) continue;
      expect(route.protected).toBe(true);
    }
  });

  it("permission-gated pages keep their gates", () => {
    expect(source("features/webhost/pages/AdminOrganizations.tsx")).toContain('permission="can_manage_managers"');
    expect(source("features/webhost/pages/AdminSubscriptions.tsx")).toContain('permission="can_manage_billing"');
    expect(source("features/webhost/pages/AdminAuditLog.tsx")).toContain('permission="can_view_activity_logs"');
  });

  it("no route changes were introduced — paths match the existing route map", () => {
    const config = roleRouteConfigs.find((entry) => entry.role === "webhost");
    const paths = (config?.routes ?? []).map((route) => route.path);
    for (const expected of Object.values(WEBHOST_ROUTES)) {
      expect(paths).toContain(expected);
    }
  });
});

describe("webhost control plane — no fabricated health", () => {
  it("deployments and history are declared not instrumented, never invented", () => {
    const infra = source("features/webhost/lib/infrastructure.ts");
    expect(infra).toContain("DEPLOYMENTS_NOT_INSTRUMENTED");
    const deployments = source("features/webhost/pages/AdminDeployments.tsx");
    expect(deployments).toContain("Not recorded");
    expect(deployments).toContain("Current live build");
  });

  it("admin tables stay compact technical tables", () => {
    for (const rel of [
      "features/webhost/pages/AdminApplications.tsx",
      "features/webhost/pages/AdminDeployments.tsx",
      "features/webhost/pages/AdminDashboard.tsx",
    ]) {
      const src = source(rel);
      expect(src).toContain("<table");
      expect(src).toContain("font-mono");
    }
  });
});
