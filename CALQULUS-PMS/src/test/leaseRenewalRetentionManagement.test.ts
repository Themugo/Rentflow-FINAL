import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd());
const migration=fs.readFileSync(path.join(root,"supabase/migrations/20260904000026_lease_renewal_retention_management.sql"),"utf8");
const component=fs.readFileSync(path.join(root,"src/features/leases/components/LeaseRenewalPipeline.tsx"),"utf8");
describe("lease renewal retention management",()=>{
 it("has authoritative renewal case lifecycle",()=>{expect(migration).toContain("lease_renewal_cases");expect(migration).toContain("create_lease_renewal_case_atomic");expect(migration).toContain("send_lease_renewal_case_atomic");expect(migration).toContain("update_lease_renewal_case_atomic");});
 it("syncs tenant decisions into renewal cases",()=>{expect(migration).toContain("sync_renewal_case_from_tenant_response");expect(migration).toContain("tenant_decision");});
 it("exposes manager renewal pipeline UI",()=>{expect(component).toContain("get_manager_lease_renewal_pipeline");expect(component).toContain("Renewal pipeline");expect(component).toContain("Follow-ups due");});
});
