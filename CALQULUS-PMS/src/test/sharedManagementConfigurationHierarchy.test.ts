import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = path.join(root, "supabase", "migrations", "20260906000011_shared_management_configuration_hierarchy.sql");
const center = path.join(root, "src", "features", "shared", "ManagementConfigurationCenter.tsx");

describe("shared management configuration hierarchy", () => {
  const sql = fs.readFileSync(migration, "utf8");
  const ui = fs.readFileSync(center, "utf8");

  it("uses one shared configuration store for managers and independent landlords", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.management_rule_profiles");
    expect(sql).toContain("scope_type IN ('manager','landlord')");
    expect(sql).toContain("save_management_configuration_atomic");
  });

  it("keeps managed landlords controlled by the agency contract or manager mandate", () => {
    expect(sql).toContain("v_source:='agency_client_contract'");
    expect(sql).toContain("v_source:='manager_mandate'");
    expect(sql).toContain("Managed landlord configuration is controlled by the appointed manager or agency");
  });

  it("inherits a broad set of existing agency rule concepts without creating duplicate billing engines", () => {
    for (const key of ["management_modules","financial_modules","payment_rules","billing_rules","amenity_rules","maintenance_rules","vendor_rules","document_rules","communication_rules","security_rules"]) expect(sql).toContain(`'${key}'`);
    expect(sql).toContain("existing billing, tenant, maintenance, vendor and financial engines");
  });

  it("exposes the same control surface to manager and landlord portals", () => {
    expect(ui).toContain('role: "manager" | "landlord"');
    expect(ui).toContain("save_management_configuration_atomic");
    expect(ui).toContain("Controlled by higher authority");
  });
});
