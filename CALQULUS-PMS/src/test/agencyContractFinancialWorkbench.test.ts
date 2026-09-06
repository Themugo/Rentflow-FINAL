import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("Agency contract + financial workbench source contract", () => {
  it("exposes Agency-owned contract, charge, evidence and close controls", () => {
    const sql = read("supabase/migrations/20260906000003_agency_contract_rules_financial_workbench.sql");
    expect(sql).toContain("agency_contract_rules");
    expect(sql).toContain("agency_charge_catalog");
    expect(sql).toContain("agency_payment_evidence");
    expect(sql).toContain("agency_financial_periods");
    expect(sql).toContain("save_agency_member_permissions_atomic");
    expect(sql).toContain("close_agency_financial_period_atomic");
  });

  it("enforces fine-grained contract capabilities and keeps evidence separate from Agency cash", () => {
    const sql = read("supabase/migrations/20260906000004_agency_contract_runtime_controls.sql");
    expect(sql).toContain("management_modules");
    expect(sql).toContain("agency_collects");
    expect(sql).toContain("destination_type<>'agency'");
    expect(sql).toContain("get_agency_financial_ledger");
  });

  it("separates external settlements from Agency cash and supports controlled period reopening", () => {
    const sql = read("supabase/migrations/20260906000005_agency_external_settlement_and_financial_controls.sql");
    expect(sql).toContain("agency_evidence_id");
    expect(sql).toContain("agency_property_in_scope");
    expect(sql).toContain("agency_split_collection_percent");
    expect(sql).toContain("reopen_agency_financial_period_atomic");
    expect(sql).toContain("issue_payment_receipt_atomic");
    expect(sql).toContain("External settlement evidence accepted");
  });

  it("provides a human-readable Agency configuration and financial workbench", () => {
    const settings = read("src/features/agency/components/AgencyOperationsCenter.tsx");
    const billing = read("src/features/agency/components/AgencyFinancialWorkbench.tsx");
    expect(settings).toContain("Client Contracts");
    expect(settings).toContain("Charges");
    expect(settings).toContain("Team Permissions");
    expect(billing).toContain("Payment Evidence");
    expect(billing).toContain("Close Books");
    expect(billing).toContain("Excel / CSV");
    expect(billing).toContain("agency-payment-evidence");
    expect(billing).toContain("Evidence source");
    expect(billing).toContain("Close Agency books");
  });
});
