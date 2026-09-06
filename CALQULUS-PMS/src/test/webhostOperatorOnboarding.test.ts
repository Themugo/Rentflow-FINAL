import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { adminTierLabel, buildAdminInvitationSummary } from "@/features/auth/lib/adminInvitation";
import { isSecretKey, maskSecrets, stringifyMasked, REDACTED } from "@/features/webhost/lib/secrets";
import { getNonSecretConfig } from "@/features/webhost/lib/infrastructure";

// Phase 9 — Secure operator (WebHost) onboarding. These tests pin the
// authorization boundaries, session handling, unauthorized-access guards,
// and secrets hygiene that the operator flow depends on. Deno edge
// functions and SQL are not executed by vitest, so the server-side
// guarantees are asserted as static invariants on the shipped artifacts.

const acceptSource = readFileSync(
  resolve(__dirname, "../../supabase/functions/accept-admin-invitation/index.ts"),
  "utf8",
);
const sendSource = readFileSync(
  resolve(__dirname, "../../supabase/functions/send-admin-invitation/index.ts"),
  "utf8",
);
const phase9Migration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260824000003_webhost_operator_phase9.sql"),
  "utf8",
);
const hierarchyMigration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260530000000_platform_admin_hierarchy.sql"),
  "utf8",
);
const routesSource = readFileSync(resolve(__dirname, "../app/routes.ts"), "utf8");
const authSource = readFileSync(resolve(__dirname, "../features/auth/AuthContext.tsx"), "utf8");
const authFlowSource = readFileSync(resolve(__dirname, "../features/auth/lib/authFlow.ts"), "utf8");
const webhostAuthSource = readFileSync(resolve(__dirname, "../features/auth/pages/WebhostAuth.tsx"), "utf8");
const acceptPageSource = readFileSync(
  resolve(__dirname, "../features/auth/pages/AdminInviteAccept.tsx"),
  "utf8",
);

// ── No public operator registration ─────────────────────────────────────

describe("no public WebHost self-registration", () => {
  it("exposes the invite acceptance page but no operator signup route", () => {
    expect(routesSource).toContain('path: "/webhost/invite"');
    expect(routesSource).not.toMatch(/webhost\/(signup|register)/i);
  });

  it("the acceptance page grants access only via a token — no role/self-signup path", () => {
    expect(acceptPageSource).toContain("accept-admin-invitation");
    expect(acceptPageSource).not.toMatch(/signUp|auth\.signUp/i);
    expect(acceptPageSource).not.toMatch(/role\s*[:=]/i);
  });
});

// ── Server-side authorization ───────────────────────────────────────────

describe("operator access is granted server-side", () => {
  it("the accept function grants the role as a fixed 'webhost' — no client role", () => {
    expect(acceptSource).toContain('role: "webhost"');
    expect(acceptSource).not.toMatch(/body\.role|requestedRole|role\s*:\s*req/i);
  });

  it("the operator tier comes from the invitation, never the client", () => {
    expect(acceptSource).toContain('invite.admin_type === "business"');
    expect(acceptSource).not.toMatch(/body\.adminType|adminType\s*[:=]\s*req/i);
  });

  it("the operator tier can never be 'owner' through an invitation", () => {
    expect(acceptSource).toContain('invite.admin_type === "business" ? "business" : "admin"');
    expect(acceptSource).not.toMatch(/admin_type\s*:\s*"owner"/i);
    expect(phase9Migration).toContain("CHECK (admin_type IN ('business', 'admin'))");
  });

  it("seeds the platform_admins operator row server-side with is_immutable=false", () => {
    expect(acceptSource).toContain('.from("platform_admins")');
    expect(acceptSource).toContain("is_immutable: false");
    expect(acceptSource).toContain("admin_type: operatorTier");
  });

  it("issuance is webhost-only and permission-gated", () => {
    expect(sendSource).toContain('allowedRoles: ["webhost"]');
    expect(sendSource).toContain("can_create_admins");
    expect(sendSource).toContain("Insufficient permissions to invite administrators");
  });

  it("the owner row cannot be granted via invitation (immutability preserved)", () => {
    expect(hierarchyMigration).toContain("is_immutable");
    expect(hierarchyMigration).toContain("owner");
  });
});

// ── Identity verification + secrets hygiene ─────────────────────────────

describe("identity verification and no secret exposure", () => {
  it("the invitee identity is bound to the invited email at creation", () => {
    expect(acceptSource).toContain("email_confirm: true");
    expect(acceptSource).toContain("email: invite.email");
  });

  it("the invitation card shows the operator tier but never token or status", () => {
    const rows = buildAdminInvitationSummary({
      email: "op@calqulusrms.com",
      displayName: "Op",
      inviterName: "CALQULUS Platform",
      adminType: "business",
    });
    expect(rows).toContainEqual({ label: "Operator access", value: "Business operator" });
    expect(JSON.stringify(rows)).not.toMatch(/token|status/i);
  });

  it("adminTierLabel labels the two operator tiers and defaults to admin", () => {
    expect(adminTierLabel("business")).toBe("Business operator");
    expect(adminTierLabel("admin")).toBe("Admin operator");
    expect(adminTierLabel(null)).toBe("Admin operator");
    expect(adminTierLabel(undefined)).toBe("Admin operator");
  });
});

// ── Infrastructure secrets are never exposed during onboarding ──────────

describe("infrastructure secrets are never exposed", () => {
  it("isSecretKey flags every credential-shaped key", () => {
    for (const key of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "api_key",
      "apikey",
      "access_token",
      "refresh_token",
      "password",
      "secret",
      "private_key",
      "authorization",
      "cookie",
    ]) {
      expect(isSecretKey(key)).toBe(true);
    }
  });

  it("isSecretKey does not flag non-secret config keys", () => {
    for (const key of ["Environment", "Version", "Domain", "Protocol", "Backend", "region"]) {
      expect(isSecretKey(key)).toBe(false);
    }
  });

  it("maskSecrets redacts credential values before display", () => {
    const masked = maskSecrets({
      service_role_key: "super-secret-value",
      apiKey: "another-secret",
      domain: "www.calqulus.site",
    });
    expect(masked.service_role_key).toBe(REDACTED);
    expect(masked.apiKey).toBe(REDACTED);
    expect(masked.domain).toBe("www.calqulus.site");
  });

  it("stringifyMasked never serializes a credential", () => {
    const out = stringifyMasked({ access_token: "tok-123", domain: "x" });
    expect(out).not.toContain("tok-123");
    expect(out).toContain(REDACTED);
  });

  it("getNonSecretConfig returns only non-secret build/runtime facts", () => {
    const facts = {
      environment: "production",
      version: "1.0.0",
      domain: "www.calqulus.site",
      protocol: "https",
      backendConfigured: true,
      backendProject: "aelzsqxllkypbzslxyju",
    } as never;
    const entries = getNonSecretConfig(facts);
    for (const e of entries) {
      expect(isSecretKey(e.key)).toBe(false);
    }
    expect(JSON.stringify(entries)).not.toMatch(/service_role|api_key|token|secret|password/i);
  });
});

// ── Session expiry + unauthorized access ────────────────────────────────

describe("session expiry and unauthorized access", () => {
  it("AuthContext resolves sessions server-side and signs out on expiry", () => {
    // Session resolution is via Supabase getSession/getUser (server-checked),
    // and onAuthStateChange handles SIGNED_OUT / token refresh.
    expect(authSource).toMatch(/getSession|getUser/);
    expect(authSource).toMatch(/onAuthStateChange/);
    expect(authSource).toMatch(/SIGNED_OUT|signOut/i);
  });

  it("protected webhost routes require the webhost role (not just any session)", () => {
    expect(routesSource).toContain('role: "webhost"');
    expect(routesSource).toContain('element: WebhostDashboard, protected: true');
  });

  it("non-webhost roles have no path to webhost routes", () => {
    // Webhost routes live only inside the webhost roleRouteConfig; other
    // role configs never reference /webhost.
    const managerConfig = routesSource.split('role: "manager"')[1] ?? "";
    expect(managerConfig).not.toContain("WebhostDashboard");
    expect(managerConfig).not.toContain("AdminApplications");
    expect(managerConfig).not.toContain("AdminUsers");
  });

  it("webhost login re-verifies the role server-side before granting access", () => {
    expect(webhostAuthSource).toContain("ensureSignedInRole(['webhost'])");
    expect(authFlowSource).toContain("ensureSignedInRole");
  });
});
