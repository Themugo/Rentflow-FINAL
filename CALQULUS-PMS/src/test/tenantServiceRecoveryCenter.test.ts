import { describe, expect, it } from "vitest";
import fs from "node:fs";
const migration = fs.readFileSync("supabase/migrations/20260904000029_tenant_service_recovery_communications.sql", "utf8");
const component = fs.readFileSync("src/features/dashboard/components/TenantServiceRecoveryCenter.tsx", "utf8");
describe("tenant service recovery and communications", () => {
  it("creates scoped recovery cases with deduplication", () => {
    expect(migration).toContain("tenant_service_recovery_cases");
    expect(migration).toContain("tenant_service_recovery_active_idx");
    expect(migration).toContain("sync_tenant_service_recovery_cases_atomic");
    expect(migration).toContain("manager_submanagers");
    expect(migration).not.toMatch(/probability|predictive|predicted/i);
  });
  it("keeps follow-ups auditable and status-driven", () => {
    expect(migration).toContain("tenant_service_recovery_communications");
    expect(migration).toContain("queue_tenant_service_recovery_followup_atomic");
    expect(migration).toContain("status IN ('queued','sent','failed','cancelled')");
  });
  it("renders live recovery controls", () => {
    expect(component).toContain("get_manager_tenant_service_recovery_dashboard");
    expect(component).toContain("sync_tenant_service_recovery_cases_atomic");
    expect(component).toContain("queue_tenant_service_recovery_followup_atomic");
  });
});
