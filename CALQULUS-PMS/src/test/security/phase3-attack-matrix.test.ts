/**
 * Phase 3 security checks that do not claim live Postgres RLS certification.
 * Source/policy/helper verification only. Mocked Supabase queries are out of scope.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isDevAccessEnabledFromEnv,
  DEV_PRESET_ACCOUNTS,
} from "@/features/auth/lib/devAccess";
import { evaluateCanAccessProperty } from "@/features/auth/lib/permissions";
import { pickRoleForPath } from "@/features/auth/lib/roleResolution";

const ROOT = process.cwd();

function readRepo(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("Phase 3 — production bypass (attack 13)", () => {
  it("never enables dev access when PROD is true, even if the Vite flag is set", () => {
    expect(
      isDevAccessEnabledFromEnv({
        PROD: true,
        DEV: false,
        VITE_ENABLE_DEV_ACCESS: "true",
      }),
    ).toBe(false);
  });

  it("allows local Vite DEV when PROD is false", () => {
    expect(isDevAccessEnabledFromEnv({ PROD: false, DEV: true })).toBe(true);
  });

  it("honors an explicit VITE_ENABLE_DEV_ACCESS=false opt-out in local DEV", () => {
    expect(
      isDevAccessEnabledFromEnv({
        PROD: false,
        DEV: true,
        VITE_ENABLE_DEV_ACCESS: "false",
      }),
    ).toBe(false);
  });

  it("does not invent portal roles when bypass is off and the user has no roles", () => {
    const picked = pickRoleForPath([], "/webhost", "u1", false);
    expect(picked.role).toBe("tenant");
    expect(picked.approval_status).toBe("pending");
  });
});

describe("Phase 3 — frontend RBAC cannot grant cross-party property access", () => {
  const denyBase = {
    isManager: false,
    isLandlord: false,
    landlordPropertyIds: [] as string[],
    isSubmanager: false,
    submanagerPermissions: null,
  };

  it("denies a landlord property that is not in their linked set", () => {
    expect(
      evaluateCanAccessProperty("property-b", {
        ...denyBase,
        isLandlord: true,
        landlordPropertyIds: ["property-a"],
      }),
    ).toBe(false);
  });

  it("denies a restricted submanager on an unassigned property", () => {
    expect(
      evaluateCanAccessProperty("property-b", {
        ...denyBase,
        isSubmanager: true,
        submanagerPermissions: {
          can_view_properties: true,
          can_view_tenants: true,
          can_view_leases: true,
          can_view_invoices: true,
          can_view_maintenance: true,
          can_view_contracts: true,
          can_view_activity_logs: false,
          restrict_to_assigned_properties: true,
          can_record_payments: true,
          can_edit_tenants: false,
          can_manage_maintenance: false,
          can_create_invoices: false,
          can_approve_moveouts: false,
          can_send_notices: false,
          can_upload_documents: false,
          assigned_property_ids: ["property-a"],
          manager_id: "manager-a",
        },
      }),
    ).toBe(false);
  });
});

describe("Phase 3 — headers and CSP (source verified)", () => {
  const vercel = readRepo("vercel.json");

  it("sets HSTS, nosniff, Referrer-Policy, Permissions-Policy, and frame protections", () => {
    expect(vercel).toContain("Strict-Transport-Security");
    expect(vercel).toContain("X-Content-Type-Options");
    expect(vercel).toContain("Referrer-Policy");
    expect(vercel).toContain("Permissions-Policy");
    expect(vercel).toContain("X-Frame-Options");
    expect(vercel).toContain("frame-ancestors 'self'");
  });

  it("does not allow broad connect-src https: / wss:, script-src unsafe-eval, or style-src unsafe-inline", () => {
    expect(vercel).not.toContain("connect-src 'self' https: wss:");
    expect(vercel).not.toContain("'unsafe-eval'");
    expect(vercel).not.toMatch(/style-src 'self' 'unsafe-inline'/);
    expect(vercel).toContain("style-src-attr 'unsafe-inline'");
    expect(vercel).toContain("https://*.supabase.co");
  });
});

describe("Phase 3 — payment and edge-function source contracts", () => {
  it("overwrites JWT-path managerId with the caller scope (attacks 6, 8, 10)", () => {
    const src = readRepo("supabase/functions/process-payment/index.ts");
    expect(src).toContain("managerId = effectiveManagerId");
    expect(src).toContain("Forbidden: tenant is not in your managed portfolio");
    expect(src).toContain("Forbidden: tenant is outside your assigned properties");
  });

  it("rejects STK amounts that do not match invoice balances (attacks 6, 10)", () => {
    const src = readRepo("supabase/functions/initiate-mpesa-stk-push/index.ts");
    expect(src).toContain("Amount mismatch");
    expect(src).toContain("Only the tenant can initiate payment for their own bills");
  });

  it("requires record-payment callers to own the tenant and assigned property", () => {
    const src = readRepo("supabase/functions/record-payment/index.ts");
    expect(src).toContain('allowedRoles: ["manager", "submanager"]');
    expect(src).toContain("Tenant is outside your assigned properties");
    expect(src).toContain("p_manager_id: effectiveManagerId");
  });

  it("keeps CORS on an explicit origin allowlist (CSRF for browser callers)", () => {
    const src = readRepo("supabase/functions/_shared/cors.ts");
    expect(src).toContain("https://www.calqulus.site");
    expect(src).not.toMatch(/Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*/);
  });

  it("fails closed for demo seeding unless ENVIRONMENT is development", () => {
    const src = readRepo("supabase/functions/seed-demo-data/index.ts");
    expect(src).toContain("Fail closed");
    expect(src).toContain("This function requires service role authentication");
  });

  it("disables bootstrap-webhost outside local development and requires the service role", () => {
    const src = readRepo("supabase/functions/bootstrap-webhost/index.ts");
    expect(src).toContain("disabled outside local development");
    expect(src).toContain("service role authentication is required");
    const toml = readRepo("supabase/config.toml").replace(/\r\n/g, "\n");
    expect(toml).toMatch(/\[functions\.bootstrap-webhost\]\nverify_jwt = true/);
    expect(toml).toMatch(/\[functions\.seed-demo-data\]\nverify_jwt = true/);
  });
});

describe("Phase 3 — RLS policy source contracts (not live DB)", () => {
  it("scopes tenant rows to manager_id, assigned properties, or own tenant_id", () => {
    const sql = readRepo("supabase/migrations/20260506000012_complete_rbac_enforcement.sql");
    expect(sql).toContain("USING (manager_id = auth.uid())");
    expect(sql).toContain("submanager_property_assignments");
    expect(sql).toContain("tenant_reads_own_record");
    expect(sql).toContain("WHERE user_id = auth.uid() AND role = 'tenant'");
  });

  it("binds landlord finance RPCs to auth.uid() (attacks 2, 5)", () => {
    const sql = readRepo("supabase/migrations/20260819000000_phase2_landlord_finance_rpc.sql");
    expect(sql).toContain("IF p_landlord_user_id IS DISTINCT FROM auth.uid()");
    expect(sql).toContain("landlord_user_id = auth.uid()");
  });

  it("scopes private storage buckets by owner or manager relationship (attacks 11, 12)", () => {
    const sql = readRepo("supabase/migrations/20260811000002_storage_security_hardening.sql");
    expect(sql).toContain("tenant_photos_scoped_select");
    expect(sql).toContain("bucket_id = 'tenant-photos'");
    expect(sql).toContain("'contracts'");
    expect(sql).toContain("public = EXCLUDED.public");
  });

  it("restricts audit_logs INSERT to the caller uid", () => {
    const sql = readRepo("supabase/migrations/20260819000001_phase3_audit_log_insert.sql");
    expect(sql).toContain("WITH CHECK (user_id = auth.uid())");
  });

  it("binds tenant SELECT to caller_tenant_ids rather than email uniqueness", () => {
    const sql = readRepo("supabase/migrations/20260819000002_phase3_leftover_hardening.sql");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.caller_tenant_ids()");
    expect(sql).toContain("id IN (SELECT public.caller_tenant_ids())");
    expect(sql).toContain("SET public = false");
    expect(sql).toContain("profile_photos_authenticated_read");
  });
});

describe("Phase 3 — secrets scan (repo source, not node_modules)", () => {
  it("does not put a service-role key in the frontend client", () => {
    const client = readRepo("src/integrations/supabase/client.ts");
    expect(client.toUpperCase()).not.toContain("SERVICE_ROLE");
    expect(client).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./);
  });

  it("gates preset passwords behind import.meta.env.PROD so production DCE can drop them", () => {
    const src = readRepo("src/features/auth/lib/devAccess.ts");
    expect(src).toContain("import.meta.env.PROD");
    expect(src).toContain("if (env.PROD) return false");
  });

  it("gates DevPortalSwitcher preset passwords the same way", () => {
    const src = readRepo("src/shared/components/DevPortalSwitcher.tsx");
    expect(src).toContain("import.meta.env.PROD");
    expect(src).toMatch(/PRESET_ACCOUNTS[\s\S]*import\.meta\.env\.PROD/);
  });
});

describe("Phase 3 — vitest env note", () => {
  it("this test runner is not a production bundle; accounts may exist here", () => {
    expect(Array.isArray(DEV_PRESET_ACCOUNTS)).toBe(true);
  });
});
