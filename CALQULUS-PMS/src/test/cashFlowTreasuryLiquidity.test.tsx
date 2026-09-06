import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Cash Flow Treasury & Liquidity Control", () => {
  const root = path.resolve(process.cwd());
  it("ships the treasury migration and manager control RPCs", () => {
    const sql = fs.readFileSync(path.join(root, "supabase/migrations/20260904000043_cash_flow_treasury_liquidity_control.sql"), "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.treasury_control_settings");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_manager_treasury_control");
    expect(sql).toContain("la.account_code='1100'");
    expect(sql).toContain("b.status='approved'");
  });
  it("keeps the dashboard wired to the new control centre", () => {
    const dashboard = fs.readFileSync(path.join(root, "src/features/dashboard/pages/Dashboard.tsx"), "utf8");
    expect(dashboard).toContain("CashFlowTreasuryLiquidityCenter");
  });
});
