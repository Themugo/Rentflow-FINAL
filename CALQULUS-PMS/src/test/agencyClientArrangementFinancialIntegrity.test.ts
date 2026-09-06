import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = resolve(process.cwd(), "supabase/migrations/20260906000010_agency_client_arrangement_financial_integrity.sql");
const ui = resolve(process.cwd(), "src/features/agency/components/AgencyOperationsCenter.tsx");

describe("Agency client arrangement and financial integrity foundation", () => {
  const sql = readFileSync(migration, "utf8");
  const source = readFileSync(ui, "utf8");

  it("extends the existing agency contract rules rather than creating a parallel client model", () => {
    expect(sql).toContain("ALTER TABLE public.agency_contract_rules");
    expect(sql).toContain("get_effective_agency_client_arrangement");
    expect(sql).not.toContain("CREATE TABLE IF NOT EXISTS public.agency_client_");
  });

  it("captures owner versus agency authority explicitly", () => {
    expect(sql).toContain("owner_controls_collections");
    expect(sql).toContain("owner_controls_financials");
    expect(sql).toContain("owner_controls_distributions");
    expect(sql).toContain("agency_controls_operations");
    expect(sql).toContain("validate_agency_client_arrangement");
  });

  it("keeps the existing invoice/payment sources of truth", () => {
    expect(sql).toContain("assert_invoice_line_items_total");
    expect(sql).toContain("process_invoice_payment");
    expect(sql).toContain("snapshot_hash");
    expect(sql).not.toContain("CREATE TABLE IF NOT EXISTS public.agency_payments");
    expect(sql).not.toContain("CREATE TABLE IF NOT EXISTS public.agency_invoices");
  });

  it("exposes the authority matrix in the existing Agency configuration center", () => {
    expect(source).toContain("Client authority matrix");
    expect(source).toContain("Landlord controls collections");
    expect(source).toContain("Landlord controls financial wellbeing");
    expect(source).toContain("Landlord controls distributions");
    expect(source).toContain("Agency controls property operations");
  });
});
