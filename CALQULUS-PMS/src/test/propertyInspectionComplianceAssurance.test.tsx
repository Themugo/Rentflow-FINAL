import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
describe("property inspection compliance assurance initiative",()=>{
  it("adds the inspection and compliance migration plus dashboard center",()=>{
    expect(fs.existsSync(path.join(root,"supabase/migrations/20260904000050_property_inspections_compliance_condition_assurance.sql"))).toBe(true);
    expect(fs.existsSync(path.join(root,"src/features/dashboard/components/PropertyInspectionComplianceAssuranceCenter.tsx"))).toBe(true);
    expect(fs.readFileSync(path.join(root,"src/features/dashboard/pages/Dashboard.tsx"),"utf8")).toContain("PropertyInspectionComplianceAssuranceCenter");
  });
  it("reuses canonical maintenance, assets and evidence controls",()=>{
    const sql=fs.readFileSync(path.join(root,"supabase/migrations/20260904000050_property_inspections_compliance_condition_assurance.sql"),"utf8");
    expect(sql).toContain("maintenance_requests"); expect(sql).toContain("maintenance_assets"); expect(sql).toContain("landlord_documents");
    expect(sql).toContain("create_maintenance_request_atomic"); expect(sql).toContain("SECURITY DEFINER SET search_path = ''");
  });
});
