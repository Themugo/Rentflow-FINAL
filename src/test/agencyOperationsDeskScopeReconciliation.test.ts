import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("Agency operations desk scope reconciliation", () => {
  it("provides a membership-validated portfolio snapshot for agency staff", () => {
    const sql = read("supabase/migrations/20260906000014_agency_operations_scope_reconciliation.sql");
    const hook = read("src/features/agency/lib/useAgencyPortfolio.ts");
    expect(sql).toContain("get_agency_portfolio_snapshot");
    expect(sql).toContain("agency_id_for_user(v_uid)");
    expect(sql).toContain("agency_members");
    expect(sql).toContain("pl.manager_id = v_manager");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.get_agency_portfolio_snapshot()");
    expect(hook).toContain('rpc("get_agency_portfolio_snapshot")');
    expect(hook).not.toContain('.eq("manager_id", user.id)');
  });

  it("removes the Manager activity feed from the Agency command centre", () => {
    const dashboard = read("src/features/agency/pages/AgencyDashboard.tsx");
    const activity = read("src/features/agency/components/AgencyActivityLog.tsx");
    const sql = read("supabase/migrations/20260906000014_agency_operations_scope_reconciliation.sql");
    expect(dashboard).toContain("AgencyActivityLog");
    expect(dashboard).not.toContain("ManagerActivityLog");
    expect(activity).toContain('rpc("get_agency_activity_log"');
    expect(read("src/features/agency/pages/AgencyClientDetail.tsx")).not.toContain("ManagerActivityLog");
    expect(read("src/features/agency/components/AgencyFinancialWorkbench.tsx")).toContain('rpc("get_agency_payment_invoice_options"');
    expect(read("src/features/agency/components/AgencyOperationsCenter.tsx")).not.toContain('.from("property_landlords")');
    expect(sql).toContain("can_view_activity_logs");
    expect(sql).toContain("Agency activity permission required");
  });
});
