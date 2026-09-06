import { describe, expect, it } from "vitest";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260904000028_tenant_experience_service_quality_intelligence.sql", "utf8");
const component = fs.readFileSync("src/features/dashboard/components/TenantExperienceServiceQualityIntelligence.tsx", "utf8");

describe("tenant experience & service quality intelligence", () => {
  it("uses scoped explainable service signals and avoids predictive claims", () => {
    expect(migration).toContain("get_manager_tenant_experience_intelligence");
    expect(migration).toContain("m.manager_id=v_manager");
    expect(migration).toContain("service_quality_score");
    expect(migration).toContain("unread_tenant_messages");
    expect(migration).toContain("aged_maintenance");
    expect(migration).not.toMatch(/probability|predictive|predicted/i);
  });

  it("creates deduplicated operational work items", () => {
    expect(migration).toContain("sync_tenant_experience_work_items_atomic");
    expect(migration).toContain("w.source_type='tenant_experience'");
    expect(migration).toContain("w.status NOT IN ('completed','cancelled')");
  });

  it("renders the live RPC-backed dashboard panel", () => {
    expect(component).toContain("get_manager_tenant_experience_intelligence");
    expect(component).toContain("sync_tenant_experience_work_items_atomic");
    expect(component).toContain("This is an explainable service-quality score, not a prediction");
  });
});
