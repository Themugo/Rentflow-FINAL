import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
const root=process.cwd();
const migration=fs.readFileSync(path.join(root,"supabase/migrations/20260904000027_tenant_retention_churn_intelligence.sql"),"utf8");
const component=fs.readFileSync(path.join(root,"src/features/dashboard/components/TenantRetentionChurnIntelligence.tsx"),"utf8");
describe("tenant retention and churn intelligence",()=>{
 it("uses explainable, scoped retention signals",()=>{expect(migration).toContain("get_manager_tenant_retention_intelligence");expect(migration).toContain("overdue_balance");expect(migration).toContain("maintenance_90d");expect(migration).toContain("negative_renewal_signals");expect(migration).toContain("manager_submanagers");expect(migration).not.toContain("probability");});
 it("exposes management retention dashboard",()=>{expect(component).toContain("Tenant retention intelligence");expect(component).toContain("Priority tenants");expect(component).toContain("Retention actions");expect(component).toContain("get_manager_tenant_retention_intelligence");});
});
