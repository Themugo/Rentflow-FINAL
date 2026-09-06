import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

describe("Phase 37-38 core portfolio mutation integrity", () => {
  it("defines atomic property lifecycle RPCs and revokes direct authenticated writes", () => {
    const sql = read("supabase/migrations/20260903000020_core_portfolio_lifecycle_atomic.sql");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.save_property_atomic");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.deactivate_property_atomic");
    expect(sql).toContain("REVOKE INSERT,UPDATE,DELETE ON public.properties FROM authenticated;");
    expect(sql).toContain("check_tier_allows_property");
    expect(sql).toContain("FOR UPDATE");
  });

  it("defines atomic unit lifecycle RPCs and synchronizes rent configuration transactionally", () => {
    const sql = read("supabase/migrations/20260903000020_core_portfolio_lifecycle_atomic.sql");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.save_unit_atomic");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.deactivate_unit_atomic");
    expect(sql).toContain("REVOKE INSERT,UPDATE,DELETE ON public.units FROM authenticated;");
    expect(sql).toContain("REVOKE INSERT,UPDATE,DELETE ON public.unit_charge_configs FROM authenticated;");
    expect(sql).toContain("A unit with this number already exists");
  });

  it("makes tenant-to-unit assignment atomic", () => {
    const sql = read("supabase/migrations/20260903000020_core_portfolio_lifecycle_atomic.sql");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.assign_tenant_to_unit_atomic");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.unassign_tenant_from_unit_atomic");
    expect(sql).toContain("Unit already has an active tenant");
  });

  it("moves active property and unit mutation entry points to RPCs", () => {
    const properties = read("src/features/properties/pages/Properties.tsx");
    const detail = read("src/features/properties/pages/PropertyDetail.tsx");
    const units = read("src/features/units/components/UnitManagement.tsx");
    expect(properties).toContain("supabase.rpc('create_property_atomic'");
    expect(properties).toContain("supabase.rpc('update_property_atomic'");
    expect(properties).toContain("supabase.rpc('transition_property_atomic'");
    expect(detail).toContain("supabase.rpc('assign_tenant_unit_atomic'");
    expect(detail).toContain("supabase.rpc('unassign_tenant_atomic'");
    expect(units).toContain("supabase.rpc('save_unit_atomic'");
    expect(units).toContain("supabase.rpc('transition_unit_atomic'");
    expect(units).not.toContain(".from('units')\n      .update({ status: 'inactive' })");
  });
});
