import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("Phase 33-34 maintenance/expenditure lifecycle", () => {
  it("routes maintenance mutations through atomic RPCs", () => {
    const files = [
      "src/features/maintenance/pages/Maintenance.tsx",
      "src/features/tenant-portal/pages/TenantMaintenance.tsx",
      "src/features/services/pages/ServicesPage.tsx",
    ].map(read).join("\n");
    expect(files).not.toMatch(/from\([\"']maintenance_requests[\"']\)[\s\S]{0,400}\.(insert|update|delete|upsert)\(/);
    expect(files).toContain("create_maintenance_request_atomic");
    expect(files).toContain("transition_maintenance_request_atomic");
    expect(files).toContain("assign_maintenance_request_atomic");
  });

  it("routes expenditure writes through one manager-scoped RPC", () => {
    const ui = read("src/features/billing/hooks/useBillingData.ts");
    expect(ui).not.toMatch(/from\([\"']expenditures[\"']\)[\s\S]{0,400}\.(insert|update|delete|upsert)\(/);
    expect(ui).toContain("save_expenditure_atomic");
    const migration = read("supabase/migrations/20260903000017_expenditure_lifecycle_atomic.sql");
    expect(migration).toContain("UNIQUE INDEX");
    expect(migration).toContain("get_effective_manager_id()");
    expect(migration).toContain("REVOKE INSERT,UPDATE,DELETE ON public.expenditures FROM authenticated");
  });
});
