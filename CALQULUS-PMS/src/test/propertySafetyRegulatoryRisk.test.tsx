import { describe, expect, it } from "vitest";
import fs from "node:fs";

const migration=fs.readFileSync("supabase/migrations/20260904000051_property_safety_regulatory_risk_remediation.sql","utf8");
const component=fs.readFileSync("src/features/dashboard/components/PropertySafetyRegulatoryRiskCenter.tsx","utf8");
const dashboard=fs.readFileSync("src/features/dashboard/pages/Dashboard.tsx","utf8");

describe("Property safety regulatory risk controls",()=>{
 it("creates certificate and risk/remediation primitives",()=>{expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.property_safety_certificates");expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.property_risk_register");expect(migration).toContain("create_property_risk_atomic");expect(migration).toContain("link_property_risk_maintenance_atomic");expect(migration).toContain("transition_property_risk_atomic");});
 it("enforces manager-scoped reads and restricted writes",()=>{expect(migration).toContain("ENABLE ROW LEVEL SECURITY");expect(migration).toContain("REVOKE ALL ON public.property_safety_certificates, public.property_risk_register FROM PUBLIC, anon");expect(migration).toContain("GRANT SELECT ON public.property_safety_certificates, public.property_risk_register TO authenticated");});
 it("keeps remediation on existing maintenance architecture",()=>{expect(migration).toContain("maintenance_request_id uuid REFERENCES public.maintenance_requests");expect(component).toContain("existing inspection, asset, maintenance, SLA, procurement and financial controls");expect(dashboard).toContain("PropertySafetyRegulatoryRiskCenter");});
});
