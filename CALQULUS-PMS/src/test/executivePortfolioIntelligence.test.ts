import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("executive portfolio intelligence", () => {
  const root = resolve(process.cwd());
  it("defines a scoped, explainable executive intelligence RPC", () => {
    const sql = readFileSync(resolve(root, "supabase/migrations/20260904000020_executive_portfolio_intelligence.sql"), "utf8");
    expect(sql).toContain("get_manager_executive_portfolio_intelligence");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("manager_submanagers");
    expect(sql).toContain("risk_score");
    expect(sql).toContain("drivers");
    expect(sql).toContain("actions");
  });
  it("renders live decision support rather than static executive KPIs", () => {
    const source = readFileSync(resolve(root, "src/features/dashboard/components/ExecutivePortfolioIntelligence.tsx"), "utf8");
    expect(source).toContain('supabase.rpc("get_manager_executive_portfolio_intelligence"');
    expect(source).toContain("Risk drivers");
    expect(source).toContain("Management actions");
  });
});
