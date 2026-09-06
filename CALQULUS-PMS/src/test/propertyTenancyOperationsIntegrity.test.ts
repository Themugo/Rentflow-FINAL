import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = path.resolve(
  process.cwd(),
  "supabase/migrations/20260904000001_property_tenancy_operations_ecosystem.sql",
);

describe("property & tenancy operations ecosystem", () => {
  const sql = fs.readFileSync(migration, "utf8");

  it("defines the authoritative lifecycle RPCs", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.transition_lease_atomic");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.assign_tenant_unit_atomic");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.complete_unit_moveout");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.refresh_property_occupancy_atomic");
  });

  it("makes occupancy lease-driven", () => {
    expect(sql).toContain("SET status = 'occupied', monthly_rent = v_lease.monthly_rent");
    expect(sql).toContain("SET status = 'vacant', updated_at = now()");
    expect(sql).toContain("A pre-lease assignment never creates occupancy.");
  });

  it("guards one active lease/tenancy per unit and tenant", () => {
    expect(sql).toContain("leases_one_active_per_unit_uidx");
    expect(sql).toContain("tenancy_one_active_per_unit_uidx");
    expect(sql).toContain("tenancy_one_active_per_tenant_uidx");
    expect(sql).toContain("Tenant already has another active lease");
    expect(sql).toContain("Unit already has another active tenancy");
  });

  it("reconciles property counters after lifecycle changes", () => {
    expect(sql).toContain("units = (");
    expect(sql).toContain("occupied = (");
    expect(sql).toContain("revenue = (");
    expect(sql).toContain("PERFORM public.refresh_property_occupancy_atomic(v_lease.property_id)");
    expect(sql).toContain("PERFORM public.refresh_property_occupancy_atomic(v_property.id)");
  });

  it("archives lifecycle history rather than deleting it", () => {
    expect(sql).toContain("status = 'archived'");
    expect(sql).toContain("archived_at = now()");
    expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.unit_tenancy_history FROM authenticated");
  });
});

// The move-out UI must pass the manager scope rather than the acting user's
// auth id, otherwise submanager move-outs can target the wrong scope.
describe("move-out scope wiring", () => {
  it("uses manager scope for the lifecycle RPC", () => {
    const file = fs.readFileSync(
      path.resolve(process.cwd(), "src/features/tenants/components/MoveOutDialog.tsx"),
      "utf8",
    );
    expect(file).toContain("const { managerId } = useManagerScope();");
    expect(file).toContain("p_manager_id:        managerId ?? user!.id");
  });
});
