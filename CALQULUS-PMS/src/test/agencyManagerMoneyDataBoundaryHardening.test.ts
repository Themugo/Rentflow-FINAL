import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260906000008_agency_manager_money_data_boundary_hardening.sql"),
  "utf8",
);
const routes = fs.readFileSync(path.join(root, "src/app/routes.ts"), "utf8");


describe("agency + manager end-to-end money/data boundary hardening", () => {
  it("uses the existing payment engine instead of a second implementation", () => {
    expect(migration).toContain("ALTER FUNCTION public.process_payment_atomic(");
    expect(migration).toContain("RENAME TO process_payment_atomic_core");
    expect((migration.match(/CREATE OR REPLACE FUNCTION public\.process_payment_atomic\(/g) ?? []).length).toBe(1);
  });

  it("requires manager/submanager collection authority when a mandate governs the property", () => {
    expect(migration).toContain("manager_payment_authority_for_property");
    expect(migration).toContain("COALESCE(v_mandate.manager_can_collect,false)");
    expect(migration).toContain("COALESCE(sp.can_record_payments,false)=true");
  });

  it("preserves tenant and service-role payment paths", () => {
    expect(migration).toContain("v_is_service boolean := auth.role()='service_role'");
    expect(migration).toContain("v_is_tenant := EXISTS");
    expect(migration).toContain("ELSIF NOT v_is_tenant");
  });

  it("hardens the physical receipt money-capture surface with the same authority boundary", () => {
    expect(migration).toContain("guard_manager_physical_receipt_collection");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF manager_id,property_id,tenant_id,amount");
  });

  it("keeps Agency and Manager as distinct route domains", () => {
    expect(routes).toContain('role: "agency"');
    expect(routes).toContain('role: "manager"');
    expect(routes).toContain('path: "/agency"');
    expect(routes).toContain('path: "/management-control"');
  });
});
