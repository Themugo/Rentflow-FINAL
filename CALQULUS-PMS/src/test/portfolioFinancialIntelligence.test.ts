import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("portfolio financial intelligence", () => {
  it("defines the canonical financial intelligence RPC", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260904000021_portfolio_financial_intelligence.sql"), "utf8");
    expect(sql).toContain("get_manager_portfolio_financial_intelligence");
    expect(sql).toContain("arrears_aging");
    expect(sql).toContain("property_performance");
    expect(sql).toContain("cash_flow_forecast");
    expect(sql).toContain("SET search_path=''");
  });
  it("uses the canonical RPC from the dashboard component", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/dashboard/components/PortfolioFinancialIntelligence.tsx"), "utf8");
    expect(source).toContain('supabase.rpc("get_manager_portfolio_financial_intelligence"');
  });
});
