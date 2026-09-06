import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { roleRouteConfigs } from "@/app/routes";
import { WEBHOST_ROUTES } from "@/features/webhost/lib/webhostPaths";
import {
  isUnattached,
  unattachedReason,
  summarizeQueue,
  UNATTACHED_REASON_LABEL,
} from "@/features/webhost/lib/unattachedTenants";

const root = resolve(__dirname, "..");
const migration = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260827000000_platform_authority_system_admin.sql"),
  "utf8",
);
const acceptSource = readFileSync(
  resolve(__dirname, "../../supabase/functions/accept-admin-invitation/index.ts"),
  "utf8",
);
const layoutSource = readFileSync(
  resolve(root, "features/webhost/components/WebhostLayout.tsx"),
  "utf8",
);

// ── Granular permission columns ─────────────────────────────────────────

describe("granular System Admin permission columns", () => {
  it("adds the four new flags to platform_admins", () => {
    for (const col of [
      "can_manage_agencies",
      "can_manage_organizations",
      "can_read_unattached_tenants",
      "can_resolve_unattached_tenants",
    ]) {
      expect(migration).toContain(col);
    }
  });

  it("adds the matching flags to admin_permissions (edge seed contract)", () => {
    for (const col of [
      "can_manage_agencies",
      "can_manage_organizations",
      "can_read_unattached_tenants",
      "can_resolve_unattached_tenants",
    ]) {
      expect(acceptSource).toContain(col);
    }
  });

  it("System Admin (admin tier) starts delegated-only: no billing/platform settings", () => {
    expect(acceptSource).toContain('can_manage_billing: operatorTier === "business"');
    expect(acceptSource).toContain('can_manage_platform_settings: operatorTier === "business"');
    expect(acceptSource).not.toContain('can_manage_billing: true');
  });
});

// ── Tenant firewall: recovery RPCs are the ONLY tenant surface ──────────

describe("unattached-tenant recovery boundary", () => {
  it("defines unattached deterministically (manager OR property/unit missing)", () => {
    expect(isUnattached({ manager_id: null, property_id: "p", unit_id: "u" })).toBe(true);
    expect(isUnattached({ manager_id: "m", property_id: null, unit_id: "u" })).toBe(true);
    expect(isUnattached({ manager_id: "m", property_id: "p", unit_id: null })).toBe(true);
    expect(isUnattached({ manager_id: "m", property_id: "p", unit_id: "u" })).toBe(false);
  });

  it("explains each reason without exposing beyond the boundary", () => {
    expect(attachedReasonLabel({ manager_id: null })).toBe("No manager assigned");
    expect(attachedReasonLabel({ manager_id: "m", property_id: null })).toBe("Property or unit not assigned");
    expect(attachedReasonLabel({ manager_id: "m", property_id: "p", unit_id: "u" })).toBe("Attached");
  });

  it("summarizes the queue with counts per reason", () => {
    const summary = summarizeQueue([
      { tenant_id: "1", tenant_name: "A", tenant_email: "a@x.com", manager_id: null, property_id: null, unit_id: null, property_label: null, unit_label: null, status: "unattached" },
      { tenant_id: "2", tenant_name: "B", tenant_email: "b@x.com", manager_id: "m", property_id: "p", unit_id: null, property_label: "P", unit_label: null, status: "unattached" },
    ]);
    expect(summary.hasQueue).toBe(true);
    expect(summary.total).toBe(2);
    expect(summary.byReason.no_manager).toBe(1);
    expect(summary.byReason.incomplete_placement).toBe(1);
  });

  it("resolve is gated to webhost owner/business or a granted System Admin", () => {
    expect(migration).toContain('pa.admin_type IN (\'owner\', \'business\')');
    expect(migration).toContain("can_resolve_unattached_tenants = true");
    expect(migration).toMatch(/RAISE EXCEPTION 'Unauthorized[^']*'/i);
  });

  it("list is webhost/System Admin only via SECURITY DEFINER", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("user_is_platform_admin_any");
    expect(migration).toContain("RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'");
  });
});

function attachedReasonLabel(t: { manager_id?: string | null; property_id?: string | null; unit_id?: string | null }): string {
  return UNATTACHED_REASON_LABEL[unattachedReason(t)];
}

// ── Frontend wiring ─────────────────────────────────────────────────────

describe("System Admin frontend surface", () => {
  it("registers the unattached-tenants route, protected, in the webhost config", () => {
    const config = roleRouteConfigs.find((entry) => entry.role === "webhost");
    const route = (config?.routes ?? []).find((r) => r.path === "/webhost/unattached-tenants");
    expect(route).toBeTruthy();
    expect(route?.protected).toBe(true);
  });

  it("exposes the path constant", () => {
    expect(WEBHOST_ROUTES.unattachedTenants).toBe("/webhost/unattached-tenants");
  });

  it("nav item is present and gated by the recovery permission", () => {
    // The nav label lives in the shared navigation module; the gating logic
    // (which decides whether that item is shown) stays in the layout.
    const navSource = readFileSync(resolve(root, "shared/navigation/portalNavigation.ts"), "utf8");
    expect(navSource).toContain('label: "Unattached tenants"');
    expect(layoutSource).toContain("can_read_unattached_tenants");
    expect(layoutSource).toContain("isSuperAdmin");
  });

  it("admin page never reads the tenants table directly — only the RPC", () => {
    const page = readFileSync(resolve(root, "features/webhost/pages/AdminUnattachedTenants.tsx"), "utf8");
    expect(page).toContain('supabase.rpc("list_unattached_tenants")');
    expect(page).toContain('supabase.rpc("resolve_unattached_tenant"');
    expect(page).not.toContain('.from("tenants")');
    expect(page).not.toContain('.from("invoices")');
    expect(page).not.toContain('.from("leases")');
  });

  it("keeps tenant privacy: no tenant PII block on the desk", () => {
    // The desk-level tenant firewall remains in lib (no PII-only browser).
    const desk = readFileSync(resolve(root, "features/webhost/components/ActivityLog.tsx"), "utf8");
    expect(desk).toContain("stringifyMasked");
  });
});