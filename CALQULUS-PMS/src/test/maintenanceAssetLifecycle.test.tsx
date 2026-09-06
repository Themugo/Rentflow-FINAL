import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
describe("maintenance asset lifecycle initiative",()=>{
  it("adds the canonical asset migration and dashboard center",()=>{
    expect(fs.existsSync(path.join(root,"supabase/migrations/20260904000049_maintenance_asset_register_condition_lifecycle_intelligence.sql"))).toBe(true);
    expect(fs.existsSync(path.join(root,"src/features/dashboard/components/MaintenanceAssetLifecycleCenter.tsx"))).toBe(true);
    const dashboard=fs.readFileSync(path.join(root,"src/features/dashboard/pages/Dashboard.tsx"),"utf8");
    expect(dashboard).toContain("MaintenanceAssetLifecycleCenter");
  });
  it("keeps asset intelligence linked to existing maintenance and financial sources",()=>{
    const sql=fs.readFileSync(path.join(root,"supabase/migrations/20260904000049_maintenance_asset_register_condition_lifecycle_intelligence.sql"),"utf8");
    expect(sql).toContain("maintenance_requests");
    expect(sql).toContain("maintenance_preventive_plans");
    expect(sql).toContain("expenditures");
    expect(sql).toContain("get_manager_maintenance_asset_lifecycle_control");
    expect(sql).toContain("SECURITY DEFINER SET search_path = ''");
  });
});
