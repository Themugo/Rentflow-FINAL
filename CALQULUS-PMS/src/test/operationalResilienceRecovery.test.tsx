import { describe, expect, it } from "vitest";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260905000001_operational_resilience_recovery_assurance.sql", "utf8");
const component = fs.readFileSync("src/features/dashboard/components/OperationalResilienceRecoveryAssuranceCenter.tsx", "utf8");
const dashboard = fs.readFileSync("src/features/dashboard/pages/Dashboard.tsx", "utf8");

describe("Operational resilience and recovery assurance", () => {
  it("creates continuity and drill primitives", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.business_continuity_plans");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.recovery_drills");
    expect(migration).toContain("upsert_business_continuity_plan_atomic");
    expect(migration).toContain("record_recovery_drill_atomic");
    expect(migration).toContain("get_manager_recovery_assurance");
  });

  it("enforces manager-scoped reads and restricted direct writes", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON public.business_continuity_plans, public.recovery_drills FROM PUBLIC, anon");
    expect(migration).toContain("GRANT SELECT ON public.business_continuity_plans, public.recovery_drills TO authenticated");
    expect(migration).toContain("public.can_manage_property_scope(p_manager_id)");
  });

  it("reuses canonical document evidence and does not claim infrastructure restore proof", () => {
    expect(migration).toContain("public.landlord_documents");
    expect(migration).toContain("Does not prove infrastructure backup/PITR capability");
    expect(component).toContain("not proof of infrastructure backup or PITR restore capability");
  });

  it("is integrated into the manager dashboard", () => {
    expect(dashboard).toContain("OperationalResilienceRecoveryAssuranceCenter");
  });
});
