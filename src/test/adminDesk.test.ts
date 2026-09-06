import { describe, expect, it } from "vitest";
import {
  WEBHOST_LOGIN,
  WEBHOST_OPS_ROUTES,
  WEBHOST_ROUTES,
  isWebhostDeskPath,
  isWebhostPublicPath,
  webhostApplicationPath,
  webhostOrganizationPath,
  WEBHOST_SURFACE_IDENTITY,
} from "@/features/webhost/lib/webhostPaths";
import { assembleAdminHealthProbes, PAYMENTS_HEALTH_DETAIL, type ComponentProbe } from "@/features/webhost/lib/adminHealth";
import { parseLogRow, parseLogRows } from "@/features/webhost/lib/operations";
import { isSecretKey, maskSecrets, stringifyMasked } from "@/features/webhost/lib/secrets";
import {
  countProbed,
  DEPLOYMENTS_NOT_INSTRUMENTED,
  deriveSystemStatus,
  getApplicationFacts,
  getApplicationRuntime,
  getNonSecretConfig,
  probeToInfraStatus,
} from "@/features/webhost/lib/infrastructure";
import { groupSecurityEvents, isTenantEntityType } from "@/features/webhost/lib/adminSecurity";
import { pickRoleForPath } from "@/features/auth/lib/roleResolution";
import { roleRouteConfigs } from "@/app/routes";
import { CALQULUS_PORTAL_ACCENT } from "@/shared/theme/tokens";

describe("webhost desk paths", () => {
  it("treats named pages as the platform admin desk", () => {
    expect(isWebhostDeskPath(WEBHOST_ROUTES.dashboard)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_ROUTES.organizations)).toBe(true);
    expect(isWebhostDeskPath(webhostOrganizationPath("abc"))).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_ROUTES.users)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_ROUTES.subscriptions)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_ROUTES.audit)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_ROUTES.security)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_ROUTES.settings)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_ROUTES.brand)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_OPS_ROUTES.issues)).toBe(true);
  });

  it("does not treat login as the desk", () => {
    expect(isWebhostPublicPath(WEBHOST_LOGIN)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_LOGIN)).toBe(false);
    expect(isWebhostDeskPath("/properties")).toBe(false);
  });
});

describe("webhost role routing", () => {
  const manager = { role: "manager" as const, tenant_id: null, approval_status: "approved" as const };
  const webhost = { role: "webhost" as const, tenant_id: null, approval_status: "approved" as const };

  it("keeps a dual-role user on platform admin desk pages", () => {
    expect(pickRoleForPath([manager, webhost], WEBHOST_ROUTES.dashboard, "u1", false).role).toBe("webhost");
    expect(pickRoleForPath([manager, webhost], webhostOrganizationPath("org1"), "u1", false).role).toBe("webhost");
    expect(pickRoleForPath([manager, webhost], "/properties", "u1", false).role).toBe("manager");
  });

  it("registers every named platform admin page", () => {
    const config = roleRouteConfigs.find((c) => c.role === "webhost");
    const paths = (config?.routes ?? []).map((r) => r.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        WEBHOST_ROUTES.dashboard,
        WEBHOST_ROUTES.applications,
        "/webhost/applications/:appId",
        WEBHOST_ROUTES.deployments,
        WEBHOST_ROUTES.operations,
        WEBHOST_ROUTES.organizations,
        "/webhost/organizations/:userId",
        WEBHOST_ROUTES.users,
        WEBHOST_ROUTES.subscriptions,
        WEBHOST_ROUTES.audit,
        WEBHOST_ROUTES.security,
        WEBHOST_ROUTES.settings,
        WEBHOST_ROUTES.brand,
      ]),
    );
  });

  it("treats application and deployment pages as the desk", () => {
    expect(isWebhostDeskPath(WEBHOST_ROUTES.applications)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_ROUTES.deployments)).toBe(true);
    expect(isWebhostDeskPath(WEBHOST_ROUTES.operations)).toBe(true);
    expect(isWebhostDeskPath(webhostApplicationPath("calqulus-pms"))).toBe(true);
    expect(webhostApplicationPath("calqulus-pms")).toBe("/webhost/applications/calqulus-pms");
  });
});

describe("platform admin identity", () => {
  it("keeps the platform portal teal while giving WebHost and Admin distinct surface identities", () => {
    expect(CALQULUS_PORTAL_ACCENT.platform_admin.hex).toBe("#2C9183");
    expect(CALQULUS_PORTAL_ACCENT.platform_admin.label).toBe("Teal");
    expect(WEBHOST_SURFACE_IDENTITY["control-plane"].accent).toBe("#2C9183");
    expect(WEBHOST_SURFACE_IDENTITY.admin.accent).toBe("#4658C9");
    expect(WEBHOST_SURFACE_IDENTITY["control-plane"].backgroundImageSlot).toBe("office");
    expect(WEBHOST_SURFACE_IDENTITY.admin.backgroundImageSlot).toBe("commercial");
  });
});

describe("tenant firewall on audit rows", () => {
  it("hides tenant entity types from the security slice", () => {
    expect(isTenantEntityType("tenant")).toBe(true);
    expect(isTenantEntityType("tenant_invitation")).toBe(true);
    expect(isTenantEntityType("manager")).toBe(false);

    const grouped = groupSecurityEvents([
      { action: "login_failed", entity_type: "user" },
      { action: "login_success", entity_type: "session" },
      { action: "failed_login", entity_type: "tenant" },
      { action: "permission_updated", entity_type: "admin_permissions" },
      { action: "error:edge", entity_type: "system" },
      { action: "warning:queue", entity_type: "tenant_lease" },
    ]);

    expect(grouped.counts.failedLogins).toBe(1);
    expect(grouped.counts.authEvents).toBe(2);
    expect(grouped.counts.permissionEvents).toBe(1);
    expect(grouped.counts.alerts).toBe(1);
    expect(grouped.visible.some((row) => isTenantEntityType(row.entity_type))).toBe(false);
  });
});

describe("system health probes", () => {
  it("never marks payments or notifications as healthy", () => {
    const probes = assembleAdminHealthProbes({
      local: [
        {
          component: "supabase",
          status: "healthy",
          lastChecked: "2026-08-20T00:00:00.000Z",
          latency: 12,
        },
      ],
      edge: {
        checks: {
          database: { status: "healthy", latencyMs: 8 },
          storage: { status: "healthy", latencyMs: 20 },
          edgeFunctions: { status: "healthy", latencyMs: 15 },
        },
      },
      edgeReachable: true,
      edgeError: "",
    });

    const byId = Object.fromEntries(probes.map((probe) => [probe.id, probe]));
    expect(byId.database.status).toBe("healthy");
    expect(byId.api.status).toBe("healthy");
    expect(byId.storage.status).toBe("healthy");
    expect(byId.payments.status).toBe("unavailable");
    expect(byId.payments.detail).toBe(PAYMENTS_HEALTH_DETAIL);
    expect(byId.notifications.status).toBe("unavailable");
  });

  it("leaves storage unprobed when health-check omits it", () => {
    const probes = assembleAdminHealthProbes({
      local: [],
      edge: { checks: { database: { status: "degraded" } } },
      edgeReachable: true,
      edgeError: "",
    });
    const storage = probes.find((probe) => probe.id === "storage");
    expect(storage?.status).toBe("unavailable");
    expect(storage?.detail).toBe("No live probe");
  });
});

describe("infrastructure status vocabulary", () => {
  const probe = (id: ComponentProbe["id"], status: ComponentProbe["status"]): ComponentProbe => ({
    id,
    label: id,
    status,
    detail: "",
  });

  it("maps probe states to the four control-center states", () => {
    expect(probeToInfraStatus("healthy")).toBe("operational");
    expect(probeToInfraStatus("degraded")).toBe("degraded");
    expect(probeToInfraStatus("unhealthy")).toBe("down");
    expect(probeToInfraStatus("unavailable")).toBe("warning");
  });

  it("rolls probes into worst-of system status", () => {
    expect(deriveSystemStatus([])).toBe("warning");
    expect(deriveSystemStatus([probe("database", "healthy"), probe("api", "healthy")])).toBe("operational");
    expect(deriveSystemStatus([probe("database", "healthy"), probe("api", "unavailable")])).toBe("warning");
    expect(deriveSystemStatus([probe("database", "degraded"), probe("api", "unavailable")])).toBe("degraded");
    expect(deriveSystemStatus([probe("database", "unhealthy"), probe("api", "healthy")])).toBe("down");
  });

  it("counts only services with a live probe", () => {
    const counts = countProbed([
      probe("database", "healthy"),
      probe("api", "unavailable"),
      probe("payments", "unavailable"),
    ]);
    expect(counts).toEqual({ probed: 1, total: 3 });
  });
});

describe("application facts", () => {
  it("reads environment, domain, protocol, and backend from real sources", () => {
    const facts = getApplicationFacts(
      { PROD: true, VITE_SUPABASE_URL: "https://example.supabase.co" },
      { hostname: "www.calqulus.site", protocol: "https:" },
    );
    expect(facts).toEqual({
      name: "CALQULUS PMS",
      version: "1.0.0",
      environment: "production",
      domain: "www.calqulus.site",
      protocol: "https",
      backendProject: "example.supabase.co",
      backendConfigured: true,
    });
  });

  it("never fabricates a backend project from placeholder env", () => {
    const facts = getApplicationFacts(
      { PROD: false, VITE_SUPABASE_URL: "https://placeholder.supabase.co" },
      { hostname: "localhost", protocol: "http:" },
    );
    expect(facts.backendConfigured).toBe(false);
    expect(facts.backendProject).toBe("Not configured");
    expect(facts.environment).toBe("development");
  });
});


describe("application runtime", () => {
  const probe = (id: ComponentProbe["id"], status: ComponentProbe["status"]): ComponentProbe => ({
    id,
    label: id,
    status,
    detail: "",
  });
  const facts = getApplicationFacts(
    { PROD: true, VITE_SUPABASE_URL: "https://example.supabase.co" },
    { hostname: "www.calqulus.site", protocol: "https:" },
  );

  it("rolls live probe health into the application row", () => {
    const app = getApplicationRuntime([probe("database", "healthy"), probe("api", "healthy")], facts);
    expect(app.id).toBe("calqulus-pms");
    expect(app.health).toBe("operational");
    expect(app.servicesReporting).toBe(2);
    expect(app.servicesTotal).toBe(2);
  });

  it("marks the application down when a service is unhealthy", () => {
    const app = getApplicationRuntime([probe("database", "unhealthy")], facts);
    expect(app.health).toBe("down");
  });
});

describe("non-secret configuration", () => {
  it("lists only safe entries and never keys or tokens", () => {
    const facts = getApplicationFacts(
      { PROD: true, VITE_SUPABASE_URL: "https://example.supabase.co" },
      { hostname: "www.calqulus.site", protocol: "https:" },
    );
    const config = getNonSecretConfig(facts);
    const joined = JSON.stringify(config).toLowerCase();
    expect(joined).not.toContain("anon");
    expect(joined).not.toContain("secret");
    expect(joined).not.toContain("token");
    expect(joined).not.toContain("service_role");
    expect(config.find((e) => e.key === "Backend project")?.value).toBe("example.supabase.co");
  });
});

describe("deployment history", () => {
  it("is explicitly not instrumented", () => {
    expect(DEPLOYMENTS_NOT_INSTRUMENTED).toContain("not instrumented");
  });
});

describe("log parsing", () => {
  it("parses structured observability rows from activity_logs", () => {
    const row = parseLogRow({
      id: "1",
      action: "error:auth:login failed",
      entity_label: "login failed",
      metadata: { component: "auth", message: "wrong password" },
      created_at: "2026-08-23T01:00:00.000Z",
    });
    expect(row).not.toBeNull();
    expect(row?.level).toBe("error");
    expect(row?.source).toBe("auth");
  });

  it("drops rows that are not structured logs rather than fabricating", () => {
    expect(parseLogRow(id("warning:queue"))).toBeNull();
    expect(parseLogRow(id("error:unkind"))).toBeNull();
  });

  it("skips nulls when batch parsing", () => {
    const rows = [
      { id: "a", action: "info:app:init", entity_label: "init", metadata: null, created_at: "t" },
      { id: "b", action: "plain", entity_label: "plain", metadata: null, created_at: "t" },
    ];
    const parsed = parseLogRows(rows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].level).toBe("info");
  });

  function id(action: string) {
    return { id: "x", action, entity_label: action, metadata: null, created_at: "t" };
  }
});

describe("secret masking", () => {
  it("detects secret-shaped keys", () => {
    expect(isSecretKey("password")).toBe(true);
    expect(isSecretKey("api_key")).toBe(true);
    expect(isSecretKey("service_role")).toBe(true);
    expect(isSecretKey("component")).toBe(false);
  });

  it("redacts secrets in metadata", () => {
    const out = maskSecrets({ component: "auth", api_key: "sk-live" });
    expect(out.api_key).toBe("[redacted]");
    expect(out.component).toBe("auth");
  });

  it("serializes without leaking secrets", () => {
    const s = stringifyMasked({ token: "t", ok: "v" });
    expect(s).not.toContain('t"');
    expect(s).toContain("[redacted]");
  });
});
